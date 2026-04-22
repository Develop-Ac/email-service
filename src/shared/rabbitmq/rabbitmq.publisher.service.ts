import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Channel, ChannelModel, connect } from 'amqplib';

@Injectable()
export class RabbitMqPublisherService implements OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqPublisherService.name);
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;

  constructor(private readonly configService: ConfigService) {}

  async publish(queueName: string, payload: unknown): Promise<void> {
    const rabbitUrl = this.configService.get<string>('RABBITMQ_URL');
    if (!rabbitUrl) {
      this.logger.warn(`RABBITMQ_URL nao configurado. Payload nao enviado para ${queueName}.`);
      return;
    }

    if (!this.channel) {
      await this.initialize();
    }

    if (!this.channel) {
      throw new Error('Canal RabbitMQ nao inicializado.');
    }

    await this.channel.assertQueue(queueName, { durable: true });
    this.channel.sendToQueue(queueName, Buffer.from(JSON.stringify(payload)), { persistent: true });
  }

  private async initialize(): Promise<void> {
    const rabbitUrl = this.configService.get<string>('RABBITMQ_URL');
    if (!rabbitUrl) {
      return;
    }

    this.connection = await connect(rabbitUrl);
    this.channel = await this.connection.createChannel();
    this.logger.log('Conexao RabbitMQ estabelecida.');
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
  }
}