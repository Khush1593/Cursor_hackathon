import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { TriageService } from './triage.service';
import { TriageTurnDto } from './dto/triage-turn.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OwnershipGuard } from '../common/guards/ownership.guard';

/**
 * Primary triage endpoint (voice or text → same transcript field).
 * @see project_knowledge.md §10.1 / §11
 */
@Controller('triage')
@UseGuards(JwtAuthGuard, OwnershipGuard)
export class TriageController {
  constructor(private readonly triageService: TriageService) {}

  @Post('turn')
  turn(@Body() dto: TriageTurnDto) {
    return this.triageService.handleTurn(dto);
  }
}
