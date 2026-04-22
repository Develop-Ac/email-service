import { Module } from '@nestjs/common';
import { InternalController } from './internal.controller';
import { MessagesModule } from '../messages/messages.module';
import { ThreadsModule } from '../threads/threads.module';

@Module({
  imports: [ThreadsModule, MessagesModule],
  controllers: [InternalController],
})
export class InternalModule {}