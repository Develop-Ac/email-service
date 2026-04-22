import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../../infrastructure/database/database.service';
import { RabbitMqService } from '../../infrastructure/rabbitmq/rabbitmq.service';
import { EMAIL_QUEUE } from '../../shared/rabbitmq/email-queue.constants';
import { ThreadMessagePayload } from '../../shared/rabbitmq/email-payloads';
import { parsePayload } from './consumer-helpers';

interface MessageRecord {
  id: number;
  account_id: number;
  internet_message_id: string | null;
  in_reply_to: string | null;
  normalized_subject: string | null;
  internal_date: string | null;
  received_at: string;
}

@Injectable()
export class ThreadQueueConsumer implements OnModuleInit {
  private readonly logger = new Logger(ThreadQueueConsumer.name);

  constructor(
    private readonly rabbitMqService: RabbitMqService,
    private readonly databaseService: DatabaseService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.rabbitMqService.consume(EMAIL_QUEUE.thread, async (message) => {
      const payload = parsePayload<ThreadMessagePayload>(message);
      await this.handle(payload);
    });
  }

  private async handle(payload: ThreadMessagePayload): Promise<void> {
    const messageResult = await this.databaseService.query<MessageRecord>(
      `
      SELECT id, account_id, internet_message_id, in_reply_to, normalized_subject, internal_date::text, received_at::text
      FROM email_core.mail_message
      WHERE id = $1
      `,
      [payload.messageId],
    );

    const message = messageResult.rows[0];
    if (!message) return;

    let threadId: number | null = null;

    if (message.in_reply_to) {
      const parent = await this.databaseService.query<{ thread_id: number | null }>(
        `SELECT thread_id FROM email_core.mail_message WHERE internet_message_id = $1 AND account_id = $2 LIMIT 1`,
        [message.in_reply_to, message.account_id],
      );
      threadId = parent.rows[0]?.thread_id ?? null;
    }

    if (!threadId && message.normalized_subject) {
      const existing = await this.databaseService.query<{ id: number }>(
        `
        SELECT id
        FROM email_core.mail_thread
        WHERE account_id = $1 AND normalized_subject = $2
        ORDER BY last_message_at DESC NULLS LAST
        LIMIT 1
        `,
        [message.account_id, message.normalized_subject],
      );
      threadId = existing.rows[0]?.id ?? null;
    }

    if (!threadId) {
      const created = await this.databaseService.query<{ id: number }>(
        `
        INSERT INTO email_core.mail_thread (
          account_id,
          canonical_subject,
          normalized_subject,
          thread_key,
          status_code,
          first_message_at,
          last_message_at
        )
        VALUES ($1, $2, $3, $4, 'OPEN', COALESCE($5::timestamptz, NOW()), COALESCE($5::timestamptz, NOW()))
        RETURNING id
        `,
        [message.account_id, message.normalized_subject, message.normalized_subject, `th_${randomUUID()}`, message.internal_date],
      );

      threadId = created.rows[0].id;
    }

    await this.databaseService.query(
      `
      UPDATE email_core.mail_message
      SET thread_id = $2,
          parsing_status = 'THREADED',
          updated_at = NOW()
      WHERE id = $1
      `,
      [message.id, threadId],
    );

    await this.databaseService.query(
      `
      UPDATE email_core.mail_thread
      SET last_message_at = COALESCE($2::timestamptz, NOW()),
          updated_at = NOW()
      WHERE id = $1
      `,
      [threadId, message.internal_date],
    );

    await this.rabbitMqService.publish(EMAIL_QUEUE.link, {
      type: 'email.link.requested',
      correlationId: payload.correlationId,
      requestedAt: new Date().toISOString(),
      messageId: message.id,
      threadId,
    });
  }
}