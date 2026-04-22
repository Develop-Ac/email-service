import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    bufferLogs: true,
  });

  Logger.log('Workers do email-service iniciados.', 'WorkerBootstrap');

  const shutdown = async () => {
    Logger.log('Encerrando workers do email-service...', 'WorkerBootstrap');
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap();