import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import  { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { Role } from '@prisma/client';


@Injectable()
export class RolesGuard implements CanActivate {

  constructor(private reflactor: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflactor.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      throw new UnauthorizedException('Missing authenticated user');
    }
    return requiredRoles.includes(user.role);
  }
}
