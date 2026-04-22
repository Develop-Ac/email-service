export interface QueueEnvelope<TPayload> {
  name: string;
  version: number;
  correlationId: string | null;
  occurredAt: string;
  payload: TPayload;
}

export interface EmailSyncRequestedPayload {
  accountId: number;
  folderId?: number;
  requestedByUserId: string | null;
  reason: string;
}

export interface EmailParseRequestedPayload {
  messageId: number;
  correlationId: string | null;
}

export interface EmailThreadRequestedPayload {
  messageId: number;
  correlationId: string | null;
}

export interface EmailLinkRequestedPayload {
  messageId?: number;
  threadId?: number;
  mode: 'AUTO' | 'MANUAL' | 'INHERITED';
  correlationId: string | null;
}

export interface EmailOutboundRequestedPayload {
  outboundMessageId: number;
  correlationId: string | null;
}

export interface EmailDomainEventPayload {
  accountId: number | null;
  threadId: number | null;
  messageId: number | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata: Record<string, unknown>;
}