import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const REQUIRED_ROLES_KEY = 'requiredRoles';
export const RequireRoles = (...roles: string[]) => SetMetadata(REQUIRED_ROLES_KEY, roles);

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(REQUIRED_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | string[] | undefined> }>();
    const rawRoles = request.headers['x-actor-roles'];
    const currentRoles = Array.isArray(rawRoles)
      ? rawRoles.flatMap((entry) => entry.split(',').map((role) => role.trim()).filter(Boolean))
      : String(rawRoles ?? '')
          .split(',')
          .map((role) => role.trim())
          .filter(Boolean);

    const hasRole = requiredRoles.some((role) => currentRoles.includes(role));
    if (!hasRole) {
      throw new ForbiddenException('Usuario sem permissao para executar esta acao.');
    }

    return true;
  }
}