/**
 * User dashboard, emergency reset, handoff, location, history, data export/delete.
 * Identity from JWT cookie; :userId path must match (OwnershipGuard).
 */
import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
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
import { CreateHandoffDto, ShareLocationDto } from './dto/handoff-location.dto';
import { HistoryQueryDto } from './dto/history-query.dto';

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

  @Get(':userId/history')
  @ApiOperation({
    summary: 'Paginated conversation history (grouped by day)',
  })
  getHistory(
    @Param('userId') userId: string,
    @Query() query: HistoryQueryDto,
    @CurrentUser() _user: AuthUser,
  ) {
    return this.usersService.getHistory(userId, query);
  }

  @Post('handoff')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Talk to a human — request care-coordinator handoff',
  })
  @ApiBody({ type: CreateHandoffDto })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        handoffId: 'uuid',
        status: 'open',
        message: 'A care coordinator will follow up.',
        emergencyContact: {
          name: 'Jane Doe',
          phone: '+1-555-0100',
        },
      },
    },
  })
  requestHandoff(@CurrentUser() user: AuthUser, @Body() dto: CreateHandoffDto) {
    return this.usersService.requestHandoff(user.userId, dto);
  }

  @Post('location')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Share geolocation (emergency nearest-ER helper)',
  })
  @ApiBody({ type: ShareLocationDto })
  shareLocation(@CurrentUser() user: AuthUser, @Body() dto: ShareLocationDto) {
    return this.usersService.shareLocation(user.userId, dto);
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
