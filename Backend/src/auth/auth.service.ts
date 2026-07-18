import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { AuthCookieService } from './auth-cookie.service';
import { PASSWORD_RESET_TTL_MS } from './auth.constants';
import {
  generateOpaqueToken,
  hashPassword,
  sha256,
  safeEqualHex,
  verifyPassword,
} from './auth.crypto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import {
  AuthSessionResponseDto,
  AuthUserResponseDto,
  ForgotPasswordResponseDto,
  MessageResponseDto,
} from './dto/auth-response.dto';

/** Inferred DB user row — avoids brittle `import { User } from '@prisma/client'`. */
type DbUser = NonNullable<
  Awaited<ReturnType<PrismaService['user']['findUnique']>>
>;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly cookies: AuthCookieService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
  ) {}

  async register(
    dto: RegisterDto,
    res: Response,
  ): Promise<AuthSessionResponseDto> {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await hashPassword(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        age: dto.age,
        sex: dto.sex,
        chronicConditions: dto.chronicConditions ?? [],
        currentMeds: dto.currentMeds ?? [],
        emergencyContactName: dto.emergencyContactName,
        emergencyContactPhone: dto.emergencyContactPhone,
      },
    });

    await this.issueSession(user, res);
    await this.audit.write({
      userId: user.id,
      action: 'register',
      metadata: { method: 'email_password' },
    });

    return {
      user: this.toPublicUser(user),
      message: 'Registered successfully. Auth cookies set.',
    };
  }

  async login(dto: LoginDto, res: Response): Promise<AuthSessionResponseDto> {
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Constant-ish failure message — do not reveal which field failed.
    const invalid = () =>
      new UnauthorizedException('Invalid email or password');

    if (!user?.passwordHash) {
      throw invalid();
    }

    const ok = await verifyPassword(dto.password, user.passwordHash);
    if (!ok) {
      throw invalid();
    }

    await this.issueSession(user, res);
    await this.audit.write({
      userId: user.id,
      action: 'login',
      metadata: { method: 'email_password' },
    });

    return {
      user: this.toPublicUser(user),
      message: 'Logged in successfully. Auth cookies set.',
    };
  }

  async logout(userId: string, res: Response): Promise<MessageResponseDto> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
    this.cookies.clearAuthCookies(res);
    await this.audit.write({
      userId,
      action: 'logout',
      metadata: {},
    });
    return { message: 'Logged out. Auth cookies cleared.' };
  }

  async refresh(
    refreshToken: string | undefined,
    res: Response,
  ): Promise<AuthSessionResponseDto> {
    if (!refreshToken) {
      throw new UnauthorizedException('Missing refresh token');
    }

    let payload: { sub: string; type?: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.getOrThrow<string>('jwt.secret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (payload.type !== 'refresh' || !payload.sub) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user?.refreshTokenHash) {
      throw new UnauthorizedException('Session revoked');
    }

    const incomingHash = sha256(refreshToken);
    if (!safeEqualHex(incomingHash, user.refreshTokenHash)) {
      // Possible theft — revoke stored refresh.
      await this.prisma.user.update({
        where: { id: user.id },
        data: { refreshTokenHash: null },
      });
      this.cookies.clearAuthCookies(res);
      throw new UnauthorizedException('Session revoked');
    }

    await this.issueSession(user, res);
    await this.audit.write({
      userId: user.id,
      action: 'token_refresh',
      metadata: {},
    });

    return {
      user: this.toPublicUser(user),
      message: 'Session refreshed. Auth cookies rotated.',
    };
  }

  async me(userId: string): Promise<AuthUserResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return this.toPublicUser(user);
  }

  async forgotPassword(
    dto: ForgotPasswordDto,
  ): Promise<ForgotPasswordResponseDto> {
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Always return the same message to avoid account enumeration.
    const base: ForgotPasswordResponseDto = {
      message:
        'If an account exists for that email, a password reset link has been sent.',
    };

    if (!user) {
      return base;
    }

    const rawToken = generateOpaqueToken();
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetTokenHash: sha256(rawToken),
        passwordResetExpires: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      },
    });

    await this.audit.write({
      userId: user.id,
      action: 'forgot_password',
      metadata: { requested: true },
    });

    try {
      await this.mail.sendPasswordResetEmail({
        to: email,
        resetToken: rawToken,
        expiresInMinutes: Math.round(PASSWORD_RESET_TTL_MS / 60_000),
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(`Failed to send password-reset email: ${message}`);
      // Still return the generic success body — do not leak delivery failures.
    }

    // Optional local FE shortcut — never enable in production.
    const exposeToken =
      this.config.get<string>('nodeEnv') === 'development' &&
      this.config.get<boolean>('mail.exposeResetToken') === true;

    if (exposeToken) {
      return { ...base, resetToken: rawToken };
    }

    return base;
  }

  async resetPassword(dto: ResetPasswordDto): Promise<MessageResponseDto> {
    const tokenHash = sha256(dto.token);
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetTokenHash: tokenHash,
        passwordResetExpires: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await hashPassword(dto.newPassword);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetTokenHash: null,
        passwordResetExpires: null,
        refreshTokenHash: null, // force re-login
      },
    });

    await this.audit.write({
      userId: user.id,
      action: 'reset_password',
      metadata: { success: true },
    });

    return {
      message: 'Password updated successfully. Please log in again.',
    };
  }

  private async issueSession(user: DbUser, res: Response): Promise<void> {
    const accessExpiresIn =
      this.config.get<string>('jwt.accessExpiresIn') ?? '15m';
    const refreshExpiresIn =
      this.config.get<string>('jwt.refreshExpiresIn') ?? '7d';
    const secret = this.config.getOrThrow<string>('jwt.secret');

    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email, type: 'access' },
      {
        secret,
        expiresIn: accessExpiresIn as `${number}${'s' | 'm' | 'h' | 'd'}`,
      },
    );
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, type: 'refresh' },
      {
        secret,
        expiresIn: refreshExpiresIn as `${number}${'s' | 'm' | 'h' | 'd'}`,
      },
    );

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: sha256(refreshToken) },
    });

    this.cookies.setAuthCookies(res, { accessToken, refreshToken });
  }

  private toPublicUser(user: DbUser): AuthUserResponseDto {
    return {
      id: user.id,
      email: user.email,
      age: user.age,
      sex: user.sex,
      chronicConditions: user.chronicConditions,
      currentMeds: user.currentMeds,
      emergencyContactName: user.emergencyContactName,
      emergencyContactPhone: user.emergencyContactPhone,
      activeMode: user.activeMode,
      isEmergencyState: user.isEmergencyState,
    };
  }
}
