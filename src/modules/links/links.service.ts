import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../infrastructure/database/database.service';
import { GarantiaClientService } from '../../infrastructure/garantia-client/garantia-client.service';
import { CreateLinkDto } from './dto/create-link.dto';
import { RevokeLinkDto } from './dto/revoke-link.dto';

interface MailLinkRow {
  id: number;
  target_type: string;
  target_id: number;
  entity_type: string;
  entity_id: string;
  link_mode: string;
  link_source: string;
  confidence_score: string | null;
  detected_code: string | null;
  reason_json: Record<string, unknown>;
  created_by_user_id: string | null;
  is_active: boolean;
  created_at: string;
}

@Injectable()
export class LinksService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly garantiaClientService: GarantiaClientService,
  ) {}

  async createManualLink(dto: CreateLinkDto) {
    const validation = await this.garantiaClientService.validateLink(dto.entityId, {
      source: 'EMAIL_SERVICE',
      messageId: dto.targetType === 'MESSAGE' ? String(dto.targetId) : undefined,
      threadId: dto.targetType === 'THREAD' ? dto.targetId : undefined,
      linkMode: 'MANUAL',
      reasonCode: 'MANUAL',
      confidenceScore: 1.0,
      matchedValue: dto.matchedValue ?? null,
    });

    if (!validation.allowed) {
      return validation;
    }

    const result = await this.databaseService.query<MailLinkRow>(
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
        VALUES ($1, $2, $3, $4, 'MANUAL', 'MANUAL', 1.0, $5, $6::jsonb, $7, true)
        RETURNING *
      `,
      [
        dto.targetType,
        dto.targetId,
        dto.entityType,
        dto.entityId,
        dto.matchedValue ?? null,
        JSON.stringify({ source: 'MANUAL', validation }),
        'system',
      ],
    );

    return result.rows[0];
  }

  async revokeLink(linkId: number, dto: RevokeLinkDto) {
    await this.databaseService.query(
      `
        UPDATE email_core.mail_link
        SET is_active = false,
            updated_at = NOW(),
            reason_json = jsonb_set(reason_json, '{revocationReason}', to_jsonb($2::text), true)
        WHERE id = $1
      `,
      [linkId, dto.reason],
    );

    return { ok: true, linkId, reason: dto.reason };
  }
}