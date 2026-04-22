import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '../../infrastructure/database/database.service';
import { GarantiaClientService } from '../../infrastructure/garantia-client/garantia-client.service';
import { RabbitMqService } from '../../infrastructure/rabbitmq/rabbitmq.service';
import { EMAIL_QUEUE } from '../../shared/rabbitmq/email-queue.constants';
import { LinkMessagePayload } from '../../shared/rabbitmq/email-payloads';
import { extractGarantiaCode, parsePayload } from './consumer-helpers';

interface MessageForLink {
  id: number;
  thread_id: number | null;
  internet_message_id: string | null;
  subject_raw: string | null;
  body_text: string | null;
}

@Injectable()
export class LinkQueueConsumer implements OnModuleInit {
  private readonly logger = new Logger(LinkQueueConsumer.name);

  constructor(
    private readonly rabbitMqService: RabbitMqService,
    private readonly databaseService: DatabaseService,
    private readonly garantiaClientService: GarantiaClientService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.rabbitMqService.consume(EMAIL_QUEUE.link, async (message) => {
      const payload = parsePayload<LinkMessagePayload>(message);
      await this.handle(payload);
    });
  }

  private async handle(payload: LinkMessagePayload): Promise<void> {
    const result = await this.databaseService.query<MessageForLink>(
      `
      SELECT id, thread_id, internet_message_id, subject_raw, body_text
      FROM email_core.mail_message
      WHERE id = $1
      `,
      [payload.messageId],
    );

    const message = result.rows[0];
    if (!message) return;

    // 1) Herdanca por thread vinculada
    if (message.thread_id) {
      const inherited = await this.databaseService.query<{ entity_type: string; entity_id: string }>(
        `
        SELECT entity_type, entity_id
        FROM email_core.mail_link
        WHERE target_type = 'THREAD' AND target_id = $1 AND is_active = true
        ORDER BY id DESC
        LIMIT 1
        `,
        [message.thread_id],
      );

      const link = inherited.rows[0];
      if (link) {
        await this.createMessageLink(message, link.entity_type, link.entity_id, 'INHERITED', 'THREAD_INHERITANCE', 1);
        return;
      }
    }

    // 2) Codigo no assunto/corpo
    const code = extractGarantiaCode(message.subject_raw, message.body_text);
    if (!code) {
      await this.markManualReview(message.id, 'NO_CODE_FOUND');
      return;
    }

    try {
      const data = await this.garantiaClientService.findByCode(code);
      const items = (data?.items ?? []) as Array<{ garantiaId: number; permiteVinculoEmail: boolean }>;

      if (items.length !== 1 || !items[0].permiteVinculoEmail) {
        await this.markManualReview(message.id, items.length > 1 ? 'AMBIGUOUS_MATCH' : 'NO_VALID_MATCH');
        return;
      }

      const garantiaId = String(items[0].garantiaId);
      const validation = await this.garantiaClientService.validateLink(garantiaId, {
        source: 'EMAIL_SERVICE',
        messageId: message.internet_message_id,
        threadId: message.thread_id,
        linkMode: 'AUTO',
        reasonCode: 'MATCH_CODE',
        confidenceScore: 0.95,
        matchedValue: code,
      });

      if (!validation?.allowed) {
        await this.markManualReview(message.id, 'GUARANTEE_VALIDATION_DENIED');
        return;
      }

      await this.createMessageLink(message, 'GARANTIA', garantiaId, 'AUTO', 'BODY_CODE', 0.95, code);
    } catch (error) {
      this.logger.error(`Falha ao integrar com garantia-service para link: ${error}`);
      await this.markManualReview(message.id, 'GUARANTEE_SERVICE_UNAVAILABLE');
    }
  }

  private async createMessageLink(
    message: MessageForLink,
    entityType: string,
    entityId: string,
    mode: 'AUTO' | 'MANUAL' | 'INHERITED',
    source: 'THREAD_INHERITANCE' | 'SUBJECT_CODE' | 'BODY_CODE' | 'MANUAL',
    confidence: number,
    detectedCode?: string,
  ): Promise<void> {
    await this.databaseService.query(
      `
      INSERT INTO email_core.mail_link (
        target_type,
        target_id,
        entity_type,
        entity_id,
        link_mode,
        link_source,
        confidence_score,
        detected_code,
        reason_json,
        created_by_user_id,
        is_active
      )
      VALUES ('MESSAGE', $1, $2, $3, $4, $5, $6, $7::jsonb, 'system-worker', true)
      `,
      [message.id, entityType, entityId, mode, source, confidence, detectedCode ?? null, JSON.stringify({ source, mode })],
    );

    await this.databaseService.query(
      `UPDATE email_core.mail_message SET parsing_status = 'LINKED_AUTO', updated_at = NOW() WHERE id = $1`,
      [message.id],
    );

    await this.databaseService.query(
      `
      INSERT INTO email_core.mail_event (
        event_name,
        aggregate_type,
        aggregate_id,
        payload_json,
        publish_status
      )
      VALUES ('email.linked', 'mail_message', $1, $2::jsonb, 'PENDING')
      `,
      [
        String(message.id),
        JSON.stringify({
          message_id: message.id,
          thread_id: message.thread_id,
          entity_type: entityType,
          entity_id: entityId,
          link_mode: mode,
          link_source: source,
          confidence_score: confidence,
        }),
      ],
    );
  }

  private async markManualReview(messageId: number, reasonCode: string): Promise<void> {
    await this.databaseService.query(
      `UPDATE email_core.mail_message SET parsing_status = 'REVIEW_PENDING', updated_at = NOW() WHERE id = $1`,
      [messageId],
    );

    await this.databaseService.query(
      `
      INSERT INTO email_core.mail_event (
        event_name,
        aggregate_type,
        aggregate_id,
        payload_json,
        publish_status
      )
      VALUES ('email.link.failed', 'mail_message', $1, $2::jsonb, 'PENDING')
      `,
      [String(messageId), JSON.stringify({ message_id: messageId, failure_code: reasonCode, queued_for_manual_review: true })],
    );
  }
}