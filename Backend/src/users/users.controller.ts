/**
 * User dashboard, emergency reset, data export/delete.
 * Identity from JWT cookie; :userId path must match (OwnershipGuard).
 */
import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OwnershipGuard } from '../common/guards/ownership.guard';
import { CurrentUser } from '../common/decorators';
import { AuthUser } from '../common/types';
import { ACCESS_COOKIE } from '../auth/auth.constants';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard, OwnershipGuard)
@ApiCookieAuth(ACCESS_COOKIE)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':userId/dashboard')
  @ApiOperation({
    summary: 'Dashboard bootstrap (7-day metrics + recent messages)',
  })
  getDashboard(
    @Param('userId') userId: string,
    @CurrentUser() _user: AuthUser,
  ) {
    return this.usersService.getDashboard(userId);
  }

  @Patch('reset-emergency')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear emergency lock (Crisis Handled / Dismiss)' })
  @ApiResponse({
    status: 200,
    schema: {
      example: { is_emergency_state: false, active_mode: 'preventive' },
    },
  })
  resetEmergency(@CurrentUser() user: AuthUser) {
    return this.usersService.resetEmergency(user.userId);
  }

  @Get(':userId/export')
  @ApiOperation({ summary: 'Export all user data (portability)' })
  exportData(@Param('userId') userId: string, @CurrentUser() _user: AuthUser) {
    return this.usersService.exportData(userId);
  }

  @Delete(':userId/data')
  @ApiOperation({ summary: 'Delete HealthLog + ExaInsight rows for user' })
  deleteData(@Param('userId') userId: string, @CurrentUser() _user: AuthUser) {
    return this.usersService.deleteData(userId);
  }
}
