import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthUser } from '../types';

type RequestWithAuth = Request & {
  user?: AuthUser;
  params: Record<string, string | undefined>;
  body?: unknown;
};

/**
 * Row-level ownership: if a resource userId appears in :userId or body.userId,
 * it must match the JWT principal. Routes with no resource id rely on JWT alone.
 */
@Injectable()
export class OwnershipGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const authUser = request.user;

    if (!authUser?.userId) {
      throw new UnauthorizedException('Authentication required');
    }

    const paramUserId = request.params?.userId;

    let bodyUserId: string | undefined;
    if (
      request.body &&
      typeof request.body === 'object' &&
      !Array.isArray(request.body)
    ) {
      const body = request.body as Record<string, unknown>;
      if (typeof body.userId === 'string') {
        bodyUserId = body.userId;
      }
    }

    const resourceUserId = paramUserId ?? bodyUserId;
    if (resourceUserId && resourceUserId !== authUser.userId) {
      throw new ForbiddenException(
        'You are not allowed to access this resource',
      );
    }

    return true;
  }
}
