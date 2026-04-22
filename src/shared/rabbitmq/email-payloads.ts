export interface BaseQueuePayload {
  correlationId: string;
  requestedAt: string;
  actorUserId?: string | null;
  actorUserName?: string | null;
}

export interface SyncAccountPayload extends BaseQueuePayload {
  type: 'email.sync.requested';
  accountId: number;
  folderId?: number;
  forceFullResync?: boolean;
}

export interface ParseMessagePayload extends BaseQueuePayload {
  type: 'email.parse.requested';
  messageId: number;
}

export interface ThreadMessagePayload extends BaseQueuePayload {
  type: 'email.thread.requested';
  messageId: number;
}

export interface LinkMessagePayload extends BaseQueuePayload {
  type: 'email.link.requested';
  messageId: number;
  threadId?: number;
}

export interface OutboundMessagePayload extends BaseQueuePayload {
  type: 'email.outbound.requested';
  outboundMessageId: number;
}

export interface EventPublishPayload extends BaseQueuePayload {
  type: 'email.event.publish.requested';
  eventId: number;
}