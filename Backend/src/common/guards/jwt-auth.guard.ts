import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

/**
 * JWT auth guard stub — validate Bearer token and attach AuthUser to request.
 * Implementation comes in the auth feature pass.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    // TODO: implement passport-jwt strategy
    return true;
  }
}
