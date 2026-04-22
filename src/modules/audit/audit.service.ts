import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../infrastructure/database/database.service';
import { PaginationQueryDto } from '../../shared/dto/pagination-query.dto';

@Injectable()
export class AuditService {
  constructor(private readonly databaseService: DatabaseService) {}

  async listAuditLogs(query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const result = await this.databaseService.query(
      `
        SELECT *
        FROM email_core.mail_audit_log
        ORDER BY created_at DESC, id DESC
        LIMIT $1 OFFSET $2
      `,
      [pageSize, offset],
    );

    return result.rows;
  }
}