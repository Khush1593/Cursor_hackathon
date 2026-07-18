import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

/**
 * Auth routes — JWT login boundary.
 * @see project_knowledge.md §10.1 POST /api/auth/login
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() _dto: LoginDto): Promise<{ token: string; userId: string }> {
    return this.authService.login(_dto);
  }
}
