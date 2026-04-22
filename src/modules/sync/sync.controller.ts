import { Body, Controller, Param, ParseIntPipe, Post } from '@nestjs/common';
import { SyncService } from './sync.service';
import { SyncAccountDto } from './dto/sync-account.dto';

@Controller('mail-accounts')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post(':accountId/sync')
  requestSync(@Param('accountId', ParseIntPipe) accountId: number, @Body() dto: SyncAccountDto) {
    return this.syncService.requestSync(accountId, dto);
  }
}