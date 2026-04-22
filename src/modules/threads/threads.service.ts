import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../infrastructure/database/database.service';
import { PaginationQueryDto } from '../../shared/dto/pagination-query.dto';

export interface ThreadRow {
  id: number;
  account_id: number;
  canonical_subject: string | null;
  normalized_subject: string | null;
  status_code: string;
  linked_entity_type: string | null;
  linked_entity_id: string | null;
  link_mode: string | null;
  link_confidence: string | null;
  first_message_at: string | null;
  last_message_at: string | null;
}

@Injectable()
export class ThreadsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async listThreads(query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;
    const search = query.query ? `%${query.query}%` : null;

    const result = await this.databaseService.query<ThreadRow>(
      `
        SELECT id, account_id, canonical_subject, normalized_subject, status_code, linked_entity_type, linked_entity_id,
               link_mode, link_confidence::text, first_message_at::text, last_message_at::text
        FROM email_core.mail_thread
        WHERE ($1::text IS NULL OR canonical_subject ILIKE $1 OR normalized_subject ILIKE $1)
        ORDER BY last_message_at DESC NULLS LAST, id DESC
        LIMIT $2 OFFSET $3
      `,
      [search, pageSize, offset],
    );

    return result.rows.map((row) => ({
      id: row.id,
      accountId: row.account_id,
      canonicalSubject: row.canonical_subject,
      normalizedSubject: row.normalized_subject,
      statusCode: row.status_code,
      linkedEntityType: row.linked_entity_type,
      linkedEntityId: row.linked_entity_id,
      linkMode: row.link_mode,
      linkConfidence: row.link_confidence,
      firstMessageAt: row.first_message_at,
      lastMessageAt: row.last_message_at,
    }));
  }

  async getThread(threadId: number) {
    const result = await this.databaseService.query<ThreadRow>(
      `
        SELECT id, account_id, canonical_subject, normalized_subject, status_code, linked_entity_type, linked_entity_id,
               link_mode, link_confidence::text, first_message_at::text, last_message_at::text
        FROM email_core.mail_thread
        WHERE id = $1
      `,
      [threadId],
    );

    return result.rows[0] ?? null;
  }
}