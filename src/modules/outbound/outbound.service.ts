import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../../infrastructure/database/database.service';
import { RabbitMqService } from '../../infrastructure/rabbitmq/rabbitmq.service';
import { EMAIL_QUEUE } from '../../shared/rabbitmq/email-queue.constants';
import { OutboundMessagePayload } from '../../shared/rabbitmq/email-payloads';
import { SendOutboundDto } from './dto/send-outbound.dto';

interface OutboundRow {
  id: number;
}

@Injectable()
export class OutboundService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly rabbitMqService: RabbitMqService,
  ) {}

  async send(dto: SendOutboundDto) {
    const insert = await this.databaseService.query<OutboundRow>(
      `
        INSERT INTO email_core.outbound_message (
          account_id,
          thread_id,
          parent_message_id,
          subject,
          body_text,
          body_html,
          header_json,
          recipients_json,
          cc_json,
          bcc_json,
          attachments_json,
          send_status,
          created_by_user_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb, 'PENDING', $12)
        RETURNING id
      `,
      [
        dto.accountId,
        dto.threadId ?? null,
        dto.parentMessageId ?? null,
        dto.subject,
        dto.bodyText ?? null,
        dto.bodyHtml ?? null,
        JSON.stringify(dto.headers ?? {}),
        JSON.stringify(dto.recipients),
        JSON.stringify(dto.cc ?? []),
        JSON.stringify(dto.bcc ?? []),
        JSON.stringify(dto.attachments ?? []),
        'system',
      ],
    );

    const payload: OutboundMessagePayload = {
      type: 'email.outbound.requested',
      correlationId: randomUUID(),
      requestedAt: new Date().toISOString(),
      outboundMessageId: insert.rows[0].id,
    };

    await this.rabbitMqService.publish(EMAIL_QUEUE.outbound, payload);

    return {
      outboundMessageId: insert.rows[0].id,
      queuePayload: payload,
    };
  }
}