import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response, CookieOptions } from 'express';
import { ACCESS_COOKIE, REFRESH_COOKIE } from './auth.constants';

/**
 * Centralizes HTTP-only cookie set/clear so controllers stay DRY.
 * Tokens never go to localStorage / sessionStorage.
 */
@Injectable()
export class AuthCookieService {
  constructor(private readonly config: ConfigService) {}

  private baseOptions(): CookieOptions {
    const secure = this.config.get<boolean>('cookie.secure') ?? false;
    return {
      httpOnly: true,
      secure,
      // Lax works for same-site localhost (different ports) + top-level navigations.
      // Cross-site prod (Vercel → Railway) needs SameSite=None + Secure — set via COOKIE_SECURE.
      sameSite: secure ? 'none' : 'lax',
      path: '/',
    };
  }

  setAuthCookies(
    res: Response,
    tokens: { accessToken: string; refreshToken: string },
  ): void {
    const base = this.baseOptions();

    res.cookie(ACCESS_COOKIE, tokens.accessToken, {
      ...base,
      maxAge: 15 * 60 * 1000, // aligned with short-lived access JWT
    });

    res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
      ...base,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  clearAuthCookies(res: Response): void {
    const base = this.baseOptions();
    res.clearCookie(ACCESS_COOKIE, base);
    res.clearCookie(REFRESH_COOKIE, base);
  }
}
