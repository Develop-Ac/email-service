import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AccountsModule } from './modules/accounts/accounts.module';
import { AuditModule } from './modules/audit/audit.module';
import { HealthModule } from './modules/health/health.module';
import { InternalModule } from './modules/internal/internal.module';
import { LinksModule } from './modules/links/links.module';
import { MessagesModule } from './modules/messages/messages.module';
import { OutboundModule } from './modules/outbound/outbound.module';
import { SyncModule } from './modules/sync/sync.module';
import { ThreadsModule } from './modules/threads/threads.module';
import { DatabaseModule } from './infrastructure/database/database.module';
import { RabbitMqModule } from './infrastructure/rabbitmq/rabbitmq.module';
import { GarantiaClientModule } from './infrastructure/garantia-client/garantia-client.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    RabbitMqModule,
    GarantiaClientModule,
    HealthModule,
    AccountsModule,
    SyncModule,
    ThreadsModule,
    MessagesModule,
    LinksModule,
    OutboundModule,
    AuditModule,
    InternalModule,
  ],
})
export class AppModule {}