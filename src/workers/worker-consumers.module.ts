import { Module } from '@nestjs/common';
import { OutboundQueueConsumer } from './consumers/outbound-queue.consumer';
import { ParseQueueConsumer } from './consumers/parse-queue.consumer';
import { SyncQueueConsumer } from './consumers/sync-queue.consumer';
import { ThreadQueueConsumer } from './consumers/thread-queue.consumer';
import { LinkQueueConsumer } from './consumers/link-queue.consumer';
import { EventPublishQueueConsumer } from './consumers/event-publish-queue.consumer';

@Module({
  providers: [
    SyncQueueConsumer,
    ParseQueueConsumer,
    ThreadQueueConsumer,
    LinkQueueConsumer,
    OutboundQueueConsumer,
    EventPublishQueueConsumer,
  ],
})
export class WorkerConsumersModule {}