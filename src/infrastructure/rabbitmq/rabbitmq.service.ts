import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Channel, ChannelModel, ConsumeMessage, connect } from 'amqplib';

@Injectable()
export class RabbitMqService implements OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqService.name);
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private readonly rabbitUrl: string;
  private readonly queues = [
    'queue.email.sync',
    'queue.email.parse',
    'queue.email.thread',
    'queue.email.link',
    'queue.email.outbound',
    'queue.email.event.publish',
    'queue.email.retry',
    'queue.email.dlq',
  ];

  constructor(configService: ConfigService) {
    this.rabbitUrl = configService.get<string>('RABBITMQ_URL', 'amqp://guest:guest@localhost:5672');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.channel) {
      await this.channel.close();
    }

    if (this.connection) {
      await this.connection.close();
    }
  }

  async ping(): Promise<boolean> {
    try {
      await this.ensureChannel();
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'erro desconhecido';
      this.logger.error(`Falha ao testar RabbitMQ: ${message}`);
      return false;
    }
  }

  async publish(queue: string, payload: unknown): Promise<void> {
    const channel = await this.ensureChannel();
    channel.sendToQueue(queue, Buffer.from(JSON.stringify(payload)), { persistent: true, contentType: 'application/json' });
  }

  async consume(
    queue: string,
    handler: (message: ConsumeMessage) => Promise<void>,
    options?: { prefetch?: number },
  ): Promise<void> {
    const channel = await this.ensureChannel();
    await channel.assertQueue(queue, { durable: true });
    await channel.prefetch(options?.prefetch ?? 5);

    await channel.consume(queue, async (message) => {
      if (!message) return;

      try {
        await handler(message);
        channel.ack(message);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'erro desconhecido';
        this.logger.error(`Falha ao processar mensagem da fila ${queue}: ${errorMessage}`);
        channel.nack(message, false, false);
      }
    });
  }

  private async ensureChannel(): Promise<Channel> {
    if (this.channel) {
      return this.channel;
    }

    if (!this.connection) {
      this.connection = await connect(this.rabbitUrl);
      this.connection.on('close', () => {
        this.channel = null;
        this.connection = null;
      });
    }

    this.channel = await this.connection.createChannel();
    for (const queue of this.queues) {
      await this.channel.assertQueue(queue, { durable: true });
    }
    return this.channel;
  }
}