import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

/**
 * Row-level ownership stub — ensure :userId / body.userId matches JWT userId.
 */
@Injectable()
export class OwnershipGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    // TODO: compare route/body userId with request.user.userId
    return true;
  }
}
