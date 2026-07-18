import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Validates HTTP-only access cookie (or Bearer for Swagger) via JwtStrategy.
 * Attaches AuthUser to request.user.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
