import { Controller, Get, Query } from '@nestjs/common';
import { AuditService } from './audit.service';
import { PaginationQueryDto } from '../../shared/dto/pagination-query.dto';

@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  listAuditLogs(@Query() query: PaginationQueryDto) {
    return this.auditService.listAuditLogs(query);
  }
}