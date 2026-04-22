import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '../../infrastructure/database/database.service';
import { RabbitMqService } from '../../infrastructure/rabbitmq/rabbitmq.service';
import { EMAIL_QUEUE } from '../../shared/rabbitmq/email-queue.constants';
import { EventPublishPayload } from '../../shared/rabbitmq/email-payloads';
import { parsePayload } from './consumer-helpers';

interface MailEventRecord {
  id: number;
  event_name: string;
  payload_json: Record<string, unknown>;
}

@Injectable()
export class EventPublishQueueConsumer implements OnModuleInit {
  private readonly logger = new Logger(EventPublishQueueConsumer.name);

  constructor(
    private readonly rabbitMqService: RabbitMqService,
    private readonly databaseService: DatabaseService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.rabbitMqService.consume(EMAIL_QUEUE.eventPublish, async (message) => {
      const payload = parsePayload<EventPublishPayload>(message);
      await this.handle(payload);
    });

    // Bootstrap de publicacao pendente para nao depender apenas de gatilhos da API
    await this.flushPendingEvents();
  }

  private async handle(payload: EventPublishPayload): Promise<void> {
    const eventResult = await this.databaseService.query<MailEventRecord>(
      `SELECT id, event_name, payload_json FROM email_core.mail_event WHERE id = $1`,
      [payload.eventId],
    );

    const event = eventResult.rows[0];
    if (!event) return;

    const queueName = `event.${event.event_name}`;
    await this.rabbitMqService.publish(queueName, {
      type: event.event_name,
      version: 1,
      correlation_id: payload.correlationId,
      occurred_at: new Date().toISOString(),
      payload: event.payload_json,
    });

    await this.databaseService.query(
      `
      UPDATE email_core.mail_event
      SET publish_status = 'PUBLISHED',
          published_at = NOW()
      WHERE id = $1
      `,
      [event.id],
    );
  }

  private async flushPendingEvents(): Promise<void> {
    const pending = await this.databaseService.query<{ id: number }>(
      `SELECT id FROM email_core.mail_event WHERE publish_status = 'PENDING' ORDER BY id ASC LIMIT 100`,
    );

    for (const row of pending.rows) {
      await this.rabbitMqService.publish(EMAIL_QUEUE.eventPublish, {
        type: 'email.event.publish.requested',
        correlationId: `boot-${row.id}`,
        requestedAt: new Date().toISOString(),
        eventId: row.id,
      });
    }

    this.logger.log(`Eventos pendentes enfileirados para publicacao: ${pending.rows.length}`);
  }
}