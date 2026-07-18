import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ConsentService } from './consent.service';
import { CreateConsentDto } from './dto/create-consent.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OwnershipGuard } from '../common/guards/ownership.guard';
import { CurrentUser } from '../common/decorators';
import { AuthUser } from '../common/types';
import { ACCESS_COOKIE } from '../auth/auth.constants';

@ApiTags('consent')
@Controller('consent')
@UseGuards(JwtAuthGuard, OwnershipGuard)
@ApiCookieAuth(ACCESS_COOKIE)
@ApiBearerAuth()
export class ConsentController {
  constructor(private readonly consentService: ConsentService) {}

  @Post()
  @ApiOperation({ summary: 'Record a consent decision' })
  @ApiBody({ type: CreateConsentDto })
  @ApiResponse({ status: 201 })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateConsentDto) {
    return this.consentService.record(user.userId, dto);
  }

  @Get('status')
  @ApiOperation({
    summary: 'Latest consent decisions (for ConsentGate UI)',
  })
  status(@CurrentUser() user: AuthUser) {
    return this.consentService.getStatus(user.userId);
  }
}
