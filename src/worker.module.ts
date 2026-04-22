import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './infrastructure/database/database.module';
import { GarantiaClientModule } from './infrastructure/garantia-client/garantia-client.module';
import { RabbitMqModule } from './infrastructure/rabbitmq/rabbitmq.module';
import { WorkerConsumersModule } from './workers/worker-consumers.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    RabbitMqModule,
    GarantiaClientModule,
    WorkerConsumersModule,
  ],
})
export class WorkerModule {}