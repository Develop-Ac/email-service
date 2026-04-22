import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { DatabaseService } from '../../infrastructure/database/database.service';
import { RabbitMqService } from '../../infrastructure/rabbitmq/rabbitmq.service';
import { EMAIL_QUEUE } from '../../shared/rabbitmq/email-queue.constants';
import { OutboundMessagePayload } from '../../shared/rabbitmq/email-payloads';
import { parsePayload } from './consumer-helpers';

interface OutboundRecord {
  id: number;
  account_id: number;
  subject: string;
  body_text: string | null;
  body_html: string | null;
  header_json: Record<string, string>;
  recipients_json: Array<{ email: string; name?: string }>;
  cc_json: Array<{ email: string; name?: string }>;
  bcc_json: Array<{ email: string; name?: string }>;
}

interface AccountRecord {
  id: number;
  email_address: string;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  auth_secret_ref: string;
}

@Injectable()
export class OutboundQueueConsumer implements OnModuleInit {
  private readonly logger = new Logger(OutboundQueueConsumer.name);

  constructor(
    private readonly rabbitMqService: RabbitMqService,
    private readonly databaseService: DatabaseService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.rabbitMqService.consume(EMAIL_QUEUE.outbound, async (message) => {
      const payload = parsePayload<OutboundMessagePayload>(message);
      await this.handle(payload);
    });
  }

  private async handle(payload: OutboundMessagePayload): Promise<void> {
    const outboundResult = await this.databaseService.query<OutboundRecord>(
      `
      SELECT id, account_id, subject, body_text, body_html,
             COALESCE(header_json, '{}'::jsonb) AS header_json,
             recipients_json, cc_json, bcc_json
      FROM email_core.outbound_message
      WHERE id = $1
      `,
      [payload.outboundMessageId],
    );

    const outbound = outboundResult.rows[0];
    if (!outbound) return;

    const accountResult = await this.databaseService.query<AccountRecord>(
      `SELECT id, email_address, smtp_host, smtp_port, smtp_secure, auth_secret_ref FROM email_core.mail_account WHERE id = $1`,
      [outbound.account_id],
    );

    const account = accountResult.rows[0];
    if (!account) {
      await this.failOutbound(outbound.id, 'ACCOUNT_NOT_FOUND');
      return;
    }

    const [smtpUser, smtpPass] = this.parseCredentialRef(account.auth_secret_ref);
    if (!smtpUser || !smtpPass) {
      await this.failOutbound(outbound.id, 'SMTP_CREDENTIALS_NOT_AVAILABLE');
      return;
    }

    await this.databaseService.query(
      `UPDATE email_core.outbound_message SET send_status = 'SENDING', updated_at = NOW() WHERE id = $1`,
      [outbound.id],
    );

    const transporter = nodemailer.createTransport({
      host: account.smtp_host,
      port: account.smtp_port,
      secure: account.smtp_secure,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    try {
      const sent = await transporter.sendMail({
        from: account.email_address,
        to: outbound.recipients_json?.map((item) => (item.name ? `${item.name} <${item.email}>` : item.email)) ?? [],
        cc: outbound.cc_json?.map((item) => (item.name ? `${item.name} <${item.email}>` : item.email)) ?? [],
        bcc: outbound.bcc_json?.map((item) => (item.name ? `${item.name} <${item.email}>` : item.email)) ?? [],
        subject: outbound.subject,
        text: outbound.body_text ?? undefined,
        html: outbound.body_html ?? undefined,
        headers: outbound.header_json ?? undefined,
      });

      await this.databaseService.query(
        `
        UPDATE email_core.outbound_message
        SET send_status = 'SENT',
            provider_message_id = $2,
            sent_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
        `,
        [outbound.id, sent.messageId ?? null],
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
        VALUES ('email.sent', 'outbound_message', $1, $2::jsonb, 'PENDING')
        `,
        [
          String(outbound.id),
          JSON.stringify({
            outbound_message_id: outbound.id,
            account_id: outbound.account_id,
            provider_message_id: sent.messageId ?? null,
          }),
        ],
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'falha no envio SMTP';
      this.logger.error(`Falha de envio outbound ${outbound.id}: ${errorMessage}`);
      await this.failOutbound(outbound.id, errorMessage);
    }
  }

  private parseCredentialRef(authSecretRef: string): [string | null, string | null] {
    const split = authSecretRef.split(':');
    if (split.length >= 2) {
      return [split[0] ?? null, split.slice(1).join(':') || null];
    }

    return [process.env.SMTP_USER ?? null, process.env.SMTP_PASS ?? null];
  }

  private async failOutbound(outboundMessageId: number, reason: string): Promise<void> {
    await this.databaseService.query(
      `
      UPDATE email_core.outbound_message
      SET send_status = 'FAILED',
          retry_count = retry_count + 1,
          last_error_message = $2,
          updated_at = NOW()
      WHERE id = $1
      `,
      [outboundMessageId, reason],
    );
  }
}