import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '../../infrastructure/database/database.service';
import { RabbitMqService } from '../../infrastructure/rabbitmq/rabbitmq.service';
import { EMAIL_QUEUE } from '../../shared/rabbitmq/email-queue.constants';
import { ParseMessagePayload } from '../../shared/rabbitmq/email-payloads';
import { normalizeSubject, parsePayload } from './consumer-helpers';

@Injectable()
export class ParseQueueConsumer implements OnModuleInit {
  private readonly logger = new Logger(ParseQueueConsumer.name);

  constructor(
    private readonly rabbitMqService: RabbitMqService,
    private readonly databaseService: DatabaseService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.rabbitMqService.consume(EMAIL_QUEUE.parse, async (message) => {
      const payload = parsePayload<ParseMessagePayload>(message);
      await this.handle(payload);
    });
  }

  private async handle(payload: ParseMessagePayload): Promise<void> {
    const messageResult = await this.databaseService.query<{ subject_raw: string | null }>(
      `SELECT subject_raw FROM email_core.mail_message WHERE id = $1`,
      [payload.messageId],
    );

    if (!messageResult.rows[0]) {
      this.logger.warn(`Mensagem ${payload.messageId} nao encontrada para parsing.`);
      return;
    }

    const normalizedSubject = normalizeSubject(messageResult.rows[0].subject_raw);

    await this.databaseService.query(
      `
      UPDATE email_core.mail_message
      SET normalized_subject = $2,
          parsing_status = 'PARSED',
          updated_at = NOW()
      WHERE id = $1
      `,
      [payload.messageId, normalizedSubject],
    );

    await this.rabbitMqService.publish(EMAIL_QUEUE.thread, {
      type: 'email.thread.requested',
      correlationId: payload.correlationId,
      requestedAt: new Date().toISOString(),
      messageId: payload.messageId,
    });
  }
}