import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../infrastructure/database/database.service';
import { RabbitMqService } from '../../infrastructure/rabbitmq/rabbitmq.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly rabbitMqService: RabbitMqService,
  ) {}

  async getHealth() {
    const [database, rabbitmq] = await Promise.all([this.databaseService.ping(), this.rabbitMqService.ping()]);

    return {
      service: 'email-service',
      status: database && rabbitmq ? 'ok' : 'degraded',
      checks: {
        database,
        rabbitmq,
      },
      timestamp: new Date().toISOString(),
    };
  }
}