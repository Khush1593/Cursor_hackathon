import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FeedbackService } from './feedback.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OwnershipGuard } from '../common/guards/ownership.guard';
import { CurrentUser } from '../common/decorators';
import { AuthUser } from '../common/types';
import { ACCESS_COOKIE } from '../auth/auth.constants';

@ApiTags('feedback')
@Controller('feedback')
@UseGuards(JwtAuthGuard, OwnershipGuard)
@ApiCookieAuth(ACCESS_COOKIE)
@ApiBearerAuth()
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  @ApiOperation({ summary: 'Flag a triage HealthLog as incorrect' })
  @ApiBody({ type: CreateFeedbackDto })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateFeedbackDto) {
    return this.feedbackService.flag(user.userId, dto);
  }
}
