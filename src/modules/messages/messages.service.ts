import { Injectable } from '@nestjs/common';
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

@Injectable()
export class MessagesService {
  constructor(private readonly databaseService: DatabaseService) {}

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
    const result = await this.databaseService.query<MessageRow>(
      `
        SELECT id, account_id, thread_id, internet_message_id, subject_raw, normalized_subject, from_address,
               body_text, body_html, parsing_status, direction, internal_date::text, received_at::text, has_attachments
        FROM email_core.mail_message
        WHERE id = $1
      `,
      [messageId],
    );

    return result.rows[0] ?? null;
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
          ON ml.target_type = 'MESSAGE' AND ml.message_id = m.id AND ml.is_active = true
        LEFT JOIN email_core.mail_link tl
          ON tl.target_type = 'THREAD' AND tl.thread_id = m.thread_id AND tl.is_active = true
        WHERE ml.id IS NULL AND tl.id IS NULL
        ORDER BY COALESCE(m.internal_date, m.received_at) DESC, m.id DESC
        LIMIT $1 OFFSET $2
      `,
      [pageSize, offset],
    );

    return result.rows;
  }
}