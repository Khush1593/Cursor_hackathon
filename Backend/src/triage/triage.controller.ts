import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { TriageService } from './triage.service';
import { TriageTurnDto } from './dto/triage-turn.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OwnershipGuard } from '../common/guards/ownership.guard';
import { CurrentUser } from '../common/decorators';
import { AuthUser } from '../common/types';
import { ACCESS_COOKIE } from '../auth/auth.constants';

@ApiTags('triage')
@Controller('triage')
@UseGuards(JwtAuthGuard, OwnershipGuard)
@ApiCookieAuth(ACCESS_COOKIE)
@ApiBearerAuth()
export class TriageController {
  constructor(private readonly triageService: TriageService) {}

  @Post('turn')
  @ApiOperation({
    summary: 'Primary triage turn (voice or text transcript)',
  })
  @ApiBody({ type: TriageTurnDto })
  turn(@CurrentUser() user: AuthUser, @Body() dto: TriageTurnDto) {
    return this.triageService.handleTurn(user.userId, dto);
  }
}
