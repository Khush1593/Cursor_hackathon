import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from '../types';

/**
 * Extracts the JWT principal from the request.
 * Wire JwtAuthGuard before using this decorator.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | undefined => {
    const request = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
    return request.user;
  },
);
