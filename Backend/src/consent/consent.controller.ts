import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ConsentService } from './consent.service';
import { CreateConsentDto } from './dto/create-consent.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OwnershipGuard } from '../common/guards/ownership.guard';

/**
 * First-run consent recording.
 * @see project_knowledge.md §9.6 / §10.1 POST /api/consent
 */
@Controller('consent')
@UseGuards(JwtAuthGuard, OwnershipGuard)
export class ConsentController {
  constructor(private readonly consentService: ConsentService) {}

  @Post()
  create(@Body() dto: CreateConsentDto) {
    return this.consentService.record(dto);
  }
}
