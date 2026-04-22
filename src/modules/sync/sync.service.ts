import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { RabbitMqService } from '../../infrastructure/rabbitmq/rabbitmq.service';
import { EMAIL_QUEUE } from '../../shared/rabbitmq/email-queue.constants';
import { SyncAccountPayload } from '../../shared/rabbitmq/email-payloads';
import { SyncAccountDto } from './dto/sync-account.dto';

@Injectable()
export class SyncService {
  constructor(private readonly rabbitMqService: RabbitMqService) {}

  async requestSync(accountId: number, dto: SyncAccountDto) {
    const payload: SyncAccountPayload = {
      type: 'email.sync.requested',
      correlationId: randomUUID(),
      requestedAt: new Date().toISOString(),
      accountId,
      folderId: dto.folderId,
      forceFullResync: dto.forceFullResync ?? false,
    };

    await this.rabbitMqService.publish(EMAIL_QUEUE.sync, payload);
    return payload;
  }
}