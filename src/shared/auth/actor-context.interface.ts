export interface ActorContext {
  userId: string | null;
  userName: string | null;
  roles: string[];
  correlationId: string | null;
}