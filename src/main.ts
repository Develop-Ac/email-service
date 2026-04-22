import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as bodyParser from 'body-parser';
import helmet from 'helmet';
import * as dotenv from 'dotenv';
import { AppModule } from './app.module';

async function bootstrap() {
  try {
    dotenv.config();
  } catch {
    // noop
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.use(bodyParser.json({ limit: '20mb' }));
  app.use(bodyParser.urlencoded({ extended: true, limit: '20mb' }));

  const corsOrigins = process.env.CORS_ORIGIN?.split(',').map((origin) => origin.trim()) ?? true;
  Logger.log(`CORS Origins configured: ${JSON.stringify(corsOrigins)}`, 'Bootstrap');

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const httpServer = app.getHttpAdapter().getInstance();
  httpServer.get('/', (_req: unknown, res: { status: (code: number) => { send: (body: string) => void } }) => {
    res.status(200).send('Email Service ativo. Utilize o prefixo /api para acessar as rotas.');
  });

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port, '0.0.0.0');
  Logger.log(`Email Service ativo em http://localhost:${port}`, 'Bootstrap');
}

bootstrap();