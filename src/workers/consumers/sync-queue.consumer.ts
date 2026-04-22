import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '../../infrastructure/database/database.service';
import { RabbitMqService } from '../../infrastructure/rabbitmq/rabbitmq.service';
import { EMAIL_QUEUE } from '../../shared/rabbitmq/email-queue.constants';
import { SyncAccountPayload } from '../../shared/rabbitmq/email-payloads';
import { parsePayload } from './consumer-helpers';

@Injectable()
export class SyncQueueConsumer implements OnModuleInit {
  private readonly logger = new Logger(SyncQueueConsumer.name);

  constructor(
    private readonly rabbitMqService: RabbitMqService,
    private readonly databaseService: DatabaseService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.rabbitMqService.consume(EMAIL_QUEUE.sync, async (message) => {
      const payload = parsePayload<SyncAccountPayload>(message);
      await this.handle(payload);
    });
  }

  private async handle(payload: SyncAccountPayload): Promise<void> {
    this.logger.log(`Processando sync solicitado para accountId=${payload.accountId}`);

    const result = await this.databaseService.query<{ id: number }>(
      `
      SELECT id
      FROM email_core.mail_message
      WHERE account_id = $1
      ORDER BY received_at DESC
      LIMIT 100
      `,
      [payload.accountId],
    );

    for (const row of result.rows) {
      await this.rabbitMqService.publish(EMAIL_QUEUE.parse, {
        type: 'email.parse.requested',
        correlationId: payload.correlationId,
        requestedAt: new Date().toISOString(),
        messageId: row.id,
      });
    }
  }
}