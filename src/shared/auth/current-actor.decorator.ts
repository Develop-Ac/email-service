import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ActorContext } from './actor-context.interface';

export const CurrentActor = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ActorContext => {
    const request = ctx.switchToHttp().getRequest<{ headers: Record<string, string | string[] | undefined> }>();

    const userId = headerValue(request.headers['x-actor-user-id']);
    const userName = headerValue(request.headers['x-actor-user-name']);
    const correlationId = headerValue(request.headers['x-correlation-id']);
    const rolesHeader = headerValue(request.headers['x-actor-roles']);

    return {
      userId,
      userName,
      correlationId,
      roles: rolesHeader
        ? rolesHeader
            .split(',')
            .map((role) => role.trim())
            .filter(Boolean)
        : [],
    };
  },
);

function headerValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}