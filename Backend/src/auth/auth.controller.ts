import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators';
import { AuthUser } from '../common/types';
import { ACCESS_COOKIE, REFRESH_COOKIE } from './auth.constants';
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

type RequestWithCookies = Request & {
  cookies?: Record<string, string>;
};

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Register a new user',
    description:
      'Creates an account (email + password required) and sets HTTP-only access + refresh cookies. No tokens in the JSON response body.',
  })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, type: AuthSessionResponseDto })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthSessionResponseDto> {
    return this.authService.register(dto, res);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Log in',
    description:
      'Validates email + password and sets HTTP-only access + refresh cookies.',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, type: AuthSessionResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid email or password' })
  login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthSessionResponseDto> {
    return this.authService.login(dto, res);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth(ACCESS_COOKIE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Log out',
    description: 'Revokes refresh token server-side and clears auth cookies.',
  })
  @ApiResponse({ status: 200, type: MessageResponseDto })
  logout(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MessageResponseDto> {
    return this.authService.logout(user.userId, res);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({
    summary: 'Refresh session',
    description:
      'Reads the refresh cookie, rotates access + refresh cookies. Call when access token expires (401).',
  })
  @ApiResponse({ status: 200, type: AuthSessionResponseDto })
  @ApiResponse({ status: 401, description: 'Missing/invalid refresh token' })
  refresh(
    @Req() req: RequestWithCookies,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthSessionResponseDto> {
    const cookies = req.cookies ?? {};
    const refreshToken =
      typeof cookies[REFRESH_COOKIE] === 'string'
        ? cookies[REFRESH_COOKIE]
        : undefined;
    return this.authService.refresh(refreshToken, res);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth(ACCESS_COOKIE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Current user',
    description: 'Returns the authenticated user from the access cookie.',
  })
  @ApiResponse({ status: 200, type: AuthUserResponseDto })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  me(@CurrentUser() user: AuthUser): Promise<AuthUserResponseDto> {
    return this.authService.me(user.userId);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Request password reset',
    description:
      'Sends a Nodemailer password-reset email with a one-time link. Always returns a generic success message. Optional resetToken only when MAIL_DEV_EXPOSE_TOKEN=true in development.',
  })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({ status: 200, type: ForgotPasswordResponseDto })
  forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<ForgotPasswordResponseDto> {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Reset password',
    description:
      'Consumes a one-time reset token and sets a new password. Revokes existing sessions.',
  })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({ status: 200, type: MessageResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  resetPassword(@Body() dto: ResetPasswordDto): Promise<MessageResponseDto> {
    return this.authService.resetPassword(dto);
  }
}
