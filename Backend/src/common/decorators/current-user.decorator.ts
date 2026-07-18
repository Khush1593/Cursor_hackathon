import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthUser } from '../types';

/**
 * Extracts the JWT principal from the request.
 * Requires JwtAuthGuard — throws if principal is missing.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (!request.user?.userId) {
      throw new UnauthorizedException('Authentication required');
    }
    return request.user;
  },
);
