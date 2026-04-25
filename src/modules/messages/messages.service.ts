import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../infrastructure/database/database.service';
import { PaginationQueryDto } from '../../shared/dto/pagination-query.dto';

export interface MessageRow {
  id: number;
  account_id: number;
  thread_id: number | null;
  internet_message_id: string | null;
  subject_raw: string | null;
  normalized_subject: string | null;
  from_address: string | null;
  body_text: string | null;
  body_html: string | null;
  parsing_status: string;
  direction: string;
  internal_date: string | null;
  received_at: string;
  has_attachments: boolean;
}

interface MessageDetailRow extends MessageRow {
  from_name: string | null;
  reply_to_address: string | null;
  sender_address: string | null;
  participants_json: unknown;
}

interface MessageAttachmentRow {
  id: number;
  file_name: string;
  mime_type: string | null;
  size_bytes: string | null;
  content_id: string | null;
  is_inline: boolean;
  storage_bucket: string;
  storage_key: string;
}

@Injectable()
export class MessagesService {
  constructor(private readonly databaseService: DatabaseService) {}

  private toParticipantGroups(value: unknown) {
    const groups = {
      to: [] as Array<{ email: string; name?: string }>,
      cc: [] as Array<{ email: string; name?: string }>,
      bcc: [] as Array<{ email: string; name?: string }>,
      replyTo: [] as Array<{ email: string; name?: string }>,
    };

    if (!Array.isArray(value)) {
      return groups;
    }

    for (const item of value) {
      if (!item || typeof item !== 'object') {
        continue;
      }

      const role = String((item as Record<string, unknown>).role ?? '').toUpperCase();
      const email = String((item as Record<string, unknown>).email ?? '').trim();
      const name = String((item as Record<string, unknown>).name ?? '').trim();

      if (!email) {
        continue;
      }

      const target =
        role === 'CC'
          ? groups.cc
          : role === 'BCC'
            ? groups.bcc
            : role === 'REPLY_TO'
              ? groups.replyTo
              : groups.to;

      target.push(name ? { email, name } : { email });
    }

    return groups;
  }

  async listMessages(query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;
    const search = query.query ? `%${query.query}%` : null;

    const result = await this.databaseService.query<MessageRow>(
      `
        SELECT id, account_id, thread_id, internet_message_id, subject_raw, normalized_subject, from_address,
               body_text, body_html, parsing_status, direction, internal_date::text, received_at::text, has_attachments
        FROM email_core.mail_message
        WHERE ($1::text IS NULL OR subject_raw ILIKE $1 OR body_text ILIKE $1 OR from_address ILIKE $1)
        ORDER BY COALESCE(internal_date, received_at) DESC, id DESC
        LIMIT $2 OFFSET $3
      `,
      [search, pageSize, offset],
    );

    return result.rows;
  }

  async getMessage(messageId: number) {
    const result = await this.databaseService.query<MessageDetailRow>(
      `
        SELECT id, account_id, thread_id, internet_message_id, subject_raw, normalized_subject, from_address,
               from_name, reply_to_address, sender_address,
               body_text, body_html, parsing_status, direction, internal_date::text, received_at::text, has_attachments,
               participants_json
        FROM email_core.mail_message
        WHERE id = $1
      `,
      [messageId],
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    const attachmentsResult = await this.databaseService.query<MessageAttachmentRow>(
      `
        SELECT id, file_name, mime_type, size_bytes::text, content_id, is_inline, storage_bucket, storage_key
        FROM email_core.mail_attachment
        WHERE message_id = $1
        ORDER BY id ASC
      `,
      [messageId],
    );

    const participants = this.toParticipantGroups(row.participants_json);

    return {
      ...row,
      to: participants.to,
      cc: participants.cc,
      bcc: participants.bcc,
      reply_to: participants.replyTo,
      attachments: attachmentsResult.rows.map((attachment) => ({
        id: attachment.id,
        file_name: attachment.file_name,
        mime_type: attachment.mime_type,
        size_bytes: attachment.size_bytes == null ? null : Number(attachment.size_bytes),
        content_id: attachment.content_id,
        is_inline: attachment.is_inline,
        storage_bucket: attachment.storage_bucket,
        storage_key: attachment.storage_key,
      })),
    };
  }

  async listUnlinked(query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const result = await this.databaseService.query<MessageRow>(
      `
        SELECT m.id, m.account_id, m.thread_id, m.internet_message_id, m.subject_raw, m.normalized_subject, m.from_address,
               m.body_text, m.body_html, m.parsing_status, m.direction, m.internal_date::text, m.received_at::text, m.has_attachments
        FROM email_core.mail_message m
        LEFT JOIN email_core.mail_link ml
          ON ml.target_type = 'MESSAGE' AND ml.target_id = m.id AND ml.is_active = true
        LEFT JOIN email_core.mail_link tl
          ON tl.target_type = 'THREAD' AND tl.target_id = m.thread_id AND tl.is_active = true
        WHERE ml.id IS NULL AND tl.id IS NULL
        ORDER BY COALESCE(m.internal_date, m.received_at) DESC, m.id DESC
        LIMIT $1 OFFSET $2
      `,
      [pageSize, offset],
    );

    return result.rows;
  }

  async deleteMessage(messageId: number) {
    const existing = await this.databaseService.query<{ id: number }>(
      `SELECT id FROM email_core.mail_message WHERE id = $1`,
      [messageId],
    );

    if (!existing.rows[0]) {
      throw new NotFoundException(`Mensagem ${messageId} não encontrada`);
    }

    const linked = await this.databaseService.query<{ id: number }>(
      `
        SELECT ml.id FROM email_core.mail_link ml
        WHERE ml.is_active = true
          AND (
            (ml.target_type = 'MESSAGE' AND ml.target_id = $1)
            OR (ml.target_type = 'THREAD' AND ml.target_id = (
              SELECT thread_id FROM email_core.mail_message WHERE id = $1
            ))
          )
        LIMIT 1
      `,
      [messageId],
    );

    if (linked.rows[0]) {
      throw new ConflictException('Mensagem possui vínculo ativo e não pode ser excluída');
    }

    await this.databaseService.query(
      `DELETE FROM email_core.mail_attachment WHERE message_id = $1`,
      [messageId],
    );

    await this.databaseService.query(
      `DELETE FROM email_core.mail_message WHERE id = $1`,
      [messageId],
    );

    return { ok: true, messageId };
  }
}