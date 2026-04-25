import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { PoolClient } from 'pg';
import { DatabaseService } from '../../infrastructure/database/database.service';
import { normalizeSubject } from '../../workers/consumers/consumer-helpers';
import {
  InboundAddressDto,
  InboundAttachmentDto,
  InboundFolderPresenceDto,
  IngestInboundMessageDto,
} from './dto/ingest-inbound-message.dto';

interface ExistingMessageRow {
  id: number;
  thread_id: number | null;
}

interface ExistingThreadRow {
  id: number;
}

interface ExistingFolderRow {
  id: number;
}

@Injectable()
export class InternalIngestService {
  constructor(private readonly databaseService: DatabaseService) {}

  async ingestInboundMessage(dto: IngestInboundMessageDto) {
    const messageFingerprint = this.buildMessageFingerprint(dto);
    const normalizedSubject = normalizeSubject(dto.subject);
    const headersJson = dto.headers ?? {};
    const participantsJson = this.buildParticipants(dto);
    const receivedAt = dto.receivedAt ?? dto.internalDate ?? new Date().toISOString();

    return this.databaseService.withTransaction(async (client) => {
      const existingMessage = await this.findExistingMessage(
        client,
        dto.accountId,
        dto.internetMessageId,
        messageFingerprint,
      );

      const messageId = existingMessage
        ? await this.updateMessage(client, existingMessage.id, dto, messageFingerprint, normalizedSubject, headersJson, participantsJson, receivedAt)
        : await this.insertMessage(client, dto, messageFingerprint, normalizedSubject, headersJson, participantsJson, receivedAt);

      const threadId = existingMessage?.thread_id ?? (await this.resolveThreadId(client, dto, normalizedSubject, receivedAt));

      await this.attachMessageToThread(client, messageId, threadId, dto.garantiaId ? 'LINKED_AUTO' : 'THREADED');
      await this.touchThread(client, threadId, dto.subject ?? null, normalizedSubject || null, receivedAt);

      let attachmentCount = 0;
      for (const attachment of dto.attachments ?? []) {
        await this.upsertAttachment(client, messageId, attachment);
        attachmentCount += 1;
      }

      for (const folderPresence of dto.folderPresence ?? []) {
        await this.upsertFolderPresence(client, dto.accountId, messageId, folderPresence);
      }

      if (dto.garantiaId) {
        await this.upsertGarantiaLink(client, threadId, dto.garantiaId, dto);
      }

      await this.insertReceivedEvent(client, messageId, threadId, dto, attachmentCount);

      return {
        ok: true,
        created: !existingMessage,
        messageId,
        threadId,
        attachmentCount,
        linkedGarantiaId: dto.garantiaId ?? null,
      };
    });
  }

  private async findExistingMessage(
    client: PoolClient,
    accountId: number,
    internetMessageId: string,
    messageFingerprint: string,
  ) {
    const byInternetMessageId = await client.query<ExistingMessageRow>(
      `
        SELECT id, thread_id
        FROM email_core.mail_message
        WHERE account_id = $1
          AND internet_message_id = $2
        LIMIT 1
      `,
      [accountId, internetMessageId],
    );

    if (byInternetMessageId.rows[0]) {
      return byInternetMessageId.rows[0];
    }

    const byFingerprint = await client.query<ExistingMessageRow>(
      `
        SELECT id, thread_id
        FROM email_core.mail_message
        WHERE account_id = $1
          AND message_fingerprint = $2
        LIMIT 1
      `,
      [accountId, messageFingerprint],
    );

    return byFingerprint.rows[0] ?? null;
  }

  private async insertMessage(
    client: PoolClient,
    dto: IngestInboundMessageDto,
    messageFingerprint: string,
    normalizedSubject: string,
    headersJson: Record<string, unknown>,
    participantsJson: Array<Record<string, string>>,
    receivedAt: string,
  ) {
    const result = await client.query<{ id: number }>(
      `
        INSERT INTO email_core.mail_message (
          account_id,
          internet_message_id,
          in_reply_to,
          references_header,
          message_fingerprint,
          subject_raw,
          normalized_subject,
          from_address,
          from_name,
          reply_to_address,
          sender_address,
          body_text,
          body_html,
          headers_json,
          participants_json,
          parsing_status,
          direction,
          sent_at,
          internal_date,
          received_at,
          size_bytes,
          has_attachments
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
          $14::jsonb, $15::jsonb, 'INGESTED', 'INBOUND', $16, $17, $18, $19, $20
        )
        RETURNING id
      `,
      [
        dto.accountId,
        dto.internetMessageId,
        dto.inReplyTo ?? null,
        dto.referencesHeader ?? null,
        messageFingerprint,
        dto.subject ?? null,
        normalizedSubject || null,
        dto.fromAddress ?? null,
        dto.fromName ?? null,
        dto.replyToAddress ?? dto.replyTo?.[0]?.email ?? null,
        dto.senderAddress ?? null,
        dto.bodyText ?? null,
        dto.bodyHtml ?? null,
        JSON.stringify(headersJson),
        JSON.stringify(participantsJson),
        dto.sentAt ?? null,
        dto.internalDate ?? null,
        receivedAt,
        dto.sizeBytes ?? null,
        (dto.attachments?.length ?? 0) > 0,
      ],
    );

    return result.rows[0].id;
  }

  private async updateMessage(
    client: PoolClient,
    messageId: number,
    dto: IngestInboundMessageDto,
    messageFingerprint: string,
    normalizedSubject: string,
    headersJson: Record<string, unknown>,
    participantsJson: Array<Record<string, string>>,
    receivedAt: string,
  ) {
    await client.query(
      `
        UPDATE email_core.mail_message
        SET in_reply_to = $2,
            references_header = $3,
            message_fingerprint = $4,
            subject_raw = $5,
            normalized_subject = $6,
            from_address = $7,
            from_name = $8,
            reply_to_address = $9,
            sender_address = $10,
            body_text = $11,
            body_html = $12,
            headers_json = $13::jsonb,
            participants_json = $14::jsonb,
            sent_at = $15,
            internal_date = $16,
            received_at = $17,
            size_bytes = $18,
            has_attachments = $19,
            updated_at = NOW()
        WHERE id = $1
      `,
      [
        messageId,
        dto.inReplyTo ?? null,
        dto.referencesHeader ?? null,
        messageFingerprint,
        dto.subject ?? null,
        normalizedSubject || null,
        dto.fromAddress ?? null,
        dto.fromName ?? null,
        dto.replyToAddress ?? dto.replyTo?.[0]?.email ?? null,
        dto.senderAddress ?? null,
        dto.bodyText ?? null,
        dto.bodyHtml ?? null,
        JSON.stringify(headersJson),
        JSON.stringify(participantsJson),
        dto.sentAt ?? null,
        dto.internalDate ?? null,
        receivedAt,
        dto.sizeBytes ?? null,
        (dto.attachments?.length ?? 0) > 0,
      ],
    );

    return messageId;
  }

  private async resolveThreadId(
    client: PoolClient,
    dto: IngestInboundMessageDto,
    normalizedSubject: string,
    receivedAt: string,
  ) {
    if (dto.inReplyTo) {
      const parentThread = await client.query<{ thread_id: number | null }>(
        `
          SELECT thread_id
          FROM email_core.mail_message
          WHERE account_id = $1
            AND internet_message_id = $2
          LIMIT 1
        `,
        [dto.accountId, dto.inReplyTo],
      );

      if (parentThread.rows[0]?.thread_id) {
        return parentThread.rows[0].thread_id;
      }
    }

    if (normalizedSubject) {
      const existingThread = await client.query<ExistingThreadRow>(
        `
          SELECT id
          FROM email_core.mail_thread
          WHERE account_id = $1
            AND normalized_subject = $2
          ORDER BY last_message_at DESC NULLS LAST
          LIMIT 1
        `,
        [dto.accountId, normalizedSubject],
      );

      if (existingThread.rows[0]) {
        return existingThread.rows[0].id;
      }
    }

    const createdThread = await client.query<{ id: number }>(
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
        VALUES ($1, $2, $3, $4, 'OPEN', $5, $5)
        RETURNING id
      `,
      [
        dto.accountId,
        dto.subject ?? normalizedSubject ?? null,
        normalizedSubject || null,
        `n8n_${randomUUID()}`,
        receivedAt,
      ],
    );

    return createdThread.rows[0].id;
  }

  private async attachMessageToThread(
    client: PoolClient,
    messageId: number,
    threadId: number,
    parsingStatus: 'THREADED' | 'LINKED_AUTO',
  ) {
    await client.query(
      `
        UPDATE email_core.mail_message
        SET thread_id = $2,
            parsing_status = $3,
            updated_at = NOW()
        WHERE id = $1
      `,
      [messageId, threadId, parsingStatus],
    );
  }

  private async touchThread(
    client: PoolClient,
    threadId: number,
    canonicalSubject: string | null,
    normalizedSubject: string | null,
    receivedAt: string,
  ) {
    await client.query(
      `
        UPDATE email_core.mail_thread
        SET canonical_subject = COALESCE($2, canonical_subject),
            normalized_subject = COALESCE($3, normalized_subject),
            first_message_at = CASE
              WHEN first_message_at IS NULL OR $4::timestamptz < first_message_at THEN $4::timestamptz
              ELSE first_message_at
            END,
            last_message_at = CASE
              WHEN last_message_at IS NULL OR $4::timestamptz > last_message_at THEN $4::timestamptz
              ELSE last_message_at
            END,
            updated_at = NOW()
        WHERE id = $1
      `,
      [threadId, canonicalSubject, normalizedSubject, receivedAt],
    );
  }

  private async upsertAttachment(client: PoolClient, messageId: number, attachment: InboundAttachmentDto) {
    const existing = await client.query<{ id: number }>(
      `
        SELECT id
        FROM email_core.mail_attachment
        WHERE message_id = $1
          AND storage_bucket = $2
          AND storage_key = $3
        LIMIT 1
      `,
      [messageId, attachment.storageBucket, attachment.storageKey],
    );

    if (existing.rows[0]) {
      await client.query(
        `
          UPDATE email_core.mail_attachment
          SET file_name = $2,
              mime_type = $3,
              size_bytes = $4,
              content_id = $5,
              checksum_sha256 = $6,
              is_inline = $7
          WHERE id = $1
        `,
        [
          existing.rows[0].id,
          attachment.fileName,
          attachment.mimeType ?? null,
          attachment.sizeBytes ?? null,
          attachment.contentId ?? null,
          attachment.checksumSha256 ?? null,
          attachment.isInline ?? false,
        ],
      );
      return;
    }

    await client.query(
      `
        INSERT INTO email_core.mail_attachment (
          message_id,
          file_name,
          mime_type,
          size_bytes,
          content_id,
          checksum_sha256,
          is_inline,
          storage_bucket,
          storage_key
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        messageId,
        attachment.fileName,
        attachment.mimeType ?? null,
        attachment.sizeBytes ?? null,
        attachment.contentId ?? null,
        attachment.checksumSha256 ?? null,
        attachment.isInline ?? false,
        attachment.storageBucket,
        attachment.storageKey,
      ],
    );
  }

  private async upsertFolderPresence(
    client: PoolClient,
    accountId: number,
    messageId: number,
    folderPresence: InboundFolderPresenceDto,
  ) {
    const folder = await client.query<ExistingFolderRow>(
      `
        SELECT id
        FROM email_core.mail_folder
        WHERE account_id = $1
          AND remote_folder_key = $2
        LIMIT 1
      `,
      [accountId, folderPresence.remoteFolderKey],
    );

    const folderId = folder.rows[0]?.id ?? (
      await client.query<{ id: number }>(
        `
          INSERT INTO email_core.mail_folder (
            account_id,
            remote_folder_key,
            folder_name,
            delimiter,
            uid_validity,
            sync_enabled
          )
          VALUES ($1, $2, $3, $4, $5, true)
          RETURNING id
        `,
        [
          accountId,
          folderPresence.remoteFolderKey,
          folderPresence.folderName,
          folderPresence.delimiter ?? null,
          folderPresence.uidValidity,
        ],
      )
    ).rows[0].id;

    await client.query(
      `
        INSERT INTO email_core.mail_folder_presence (
          message_id,
          folder_id,
          uid_validity,
          imap_uid,
          is_seen,
          is_answered,
          is_flagged,
          is_deleted_remote,
          first_seen_at,
          last_seen_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        ON CONFLICT (folder_id, uid_validity, imap_uid)
        DO UPDATE SET
          message_id = EXCLUDED.message_id,
          is_seen = EXCLUDED.is_seen,
          is_answered = EXCLUDED.is_answered,
          is_flagged = EXCLUDED.is_flagged,
          is_deleted_remote = EXCLUDED.is_deleted_remote,
          last_seen_at = NOW(),
          updated_at = NOW()
      `,
      [
        messageId,
        folderId,
        folderPresence.uidValidity,
        folderPresence.imapUid,
        folderPresence.isSeen ?? false,
        folderPresence.isAnswered ?? false,
        folderPresence.isFlagged ?? false,
        folderPresence.isDeletedRemote ?? false,
      ],
    );
  }

  private async upsertGarantiaLink(
    client: PoolClient,
    threadId: number,
    garantiaId: string,
    dto: IngestInboundMessageDto,
  ) {
    await client.query(
      `
        UPDATE email_core.mail_link
        SET is_active = false,
            updated_at = NOW()
        WHERE target_type = 'THREAD'
          AND target_id = $1
          AND is_active = true
          AND (entity_type <> 'GARANTIA' OR entity_id <> $2)
      `,
      [threadId, garantiaId],
    );

    await client.query(
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
        SELECT 'THREAD', $1::bigint, 'GARANTIA', $2::varchar, $3::varchar, $4::varchar, $5::numeric, $6::varchar, $7::jsonb, 'n8n', true
        WHERE NOT EXISTS (
          SELECT 1
          FROM email_core.mail_link
          WHERE target_type = 'THREAD'
            AND target_id = $1::bigint
            AND entity_type = 'GARANTIA'
            AND entity_id = $2::varchar
            AND is_active = true
        )
      `,
      [
        threadId,
        garantiaId,
        dto.linkMode ?? 'AUTO',
        dto.linkSource ?? 'N8N',
        dto.linkConfidence ?? 1,
        dto.matchedValue ?? null,
        JSON.stringify({ source: dto.linkSource ?? 'N8N', matchedValue: dto.matchedValue ?? null }),
      ],
    );

    await client.query(
      `
        UPDATE email_core.mail_thread
        SET linked_entity_type = 'GARANTIA',
            linked_entity_id = $2,
            link_mode = $3,
            link_confidence = $4,
            status_code = 'LINKED',
            updated_at = NOW()
        WHERE id = $1
      `,
      [threadId, garantiaId, dto.linkMode ?? 'AUTO', dto.linkConfidence ?? 1],
    );
  }

  private async insertReceivedEvent(
    client: PoolClient,
    messageId: number,
    threadId: number,
    dto: IngestInboundMessageDto,
    attachmentCount: number,
  ) {
    await client.query(
      `
        INSERT INTO email_core.mail_event (
          event_name,
          aggregate_type,
          aggregate_id,
          payload_json,
          publish_status
        )
        VALUES ('email.received', 'mail_message', $1, $2::jsonb, 'PENDING')
      `,
      [
        String(messageId),
        JSON.stringify({
          message_id: messageId,
          thread_id: threadId,
          account_id: dto.accountId,
          internet_message_id: dto.internetMessageId,
          garantia_id: dto.garantiaId ?? null,
          attachment_count: attachmentCount,
          received_at: dto.receivedAt ?? dto.internalDate ?? new Date().toISOString(),
          source: dto.linkSource ?? 'N8N',
        }),
      ],
    );
  }

  private buildMessageFingerprint(dto: IngestInboundMessageDto) {
    const payload = [
      dto.accountId,
      dto.internetMessageId,
      dto.subject ?? '',
      dto.fromAddress ?? '',
      dto.receivedAt ?? dto.internalDate ?? '',
      dto.bodyText ?? '',
      dto.bodyHtml ?? '',
    ].join('|');

    return createHash('sha256').update(payload).digest('hex');
  }

  private buildParticipants(dto: IngestInboundMessageDto) {
    const participants: Array<Record<string, string>> = [];

    const pushParticipants = (role: 'TO' | 'CC' | 'BCC' | 'REPLY_TO', list?: InboundAddressDto[]) => {
      for (const item of list ?? []) {
        participants.push({
          role,
          email: item.email,
          name: item.name ?? '',
        });
      }
    };

    pushParticipants('TO', dto.to);
    pushParticipants('CC', dto.cc);
    pushParticipants('BCC', dto.bcc);
    pushParticipants('REPLY_TO', dto.replyTo);

    return participants;
  }
}