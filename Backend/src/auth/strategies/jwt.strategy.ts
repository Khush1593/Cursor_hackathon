import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthUser } from '../../common/types';
import { ACCESS_COOKIE } from '../auth.constants';

interface AccessJwtPayload {
  sub: string;
  email: string;
  type: 'access' | 'refresh';
}

function cookieExtractor(req: Request): string | null {
  if (req?.cookies && typeof req.cookies[ACCESS_COOKIE] === 'string') {
    return req.cookies[ACCESS_COOKIE];
  }
  return null;
}

/**
 * Reads access JWT from HTTP-only cookie (primary) or Authorization Bearer (Swagger/testing).
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('jwt.secret'),
    });
  }

  validate(payload: AccessJwtPayload): AuthUser {
    if (payload.type !== 'access' || !payload.sub) {
      throw new UnauthorizedException('Invalid access token');
    }
    return { userId: payload.sub, email: payload.email };
  }
}
