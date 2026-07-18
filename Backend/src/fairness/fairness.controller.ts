import { Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { FairnessService } from './fairness.service';

@ApiTags('fairness')
@Controller('fairness')
export class FairnessController {
  constructor(private readonly fairness: FairnessService) {}

  @Get('stats')
  @ApiOperation({
    summary: 'Non-PHI fairness aggregates (Postgres)',
    description:
      'age_band × sex_group × action_type × detected_mode only — no user IDs or transcripts.',
  })
  getStats() {
    return this.fairness.getStats();
  }

  @Post('sync')
  @ApiOperation({
    summary: 'Scrape Python /fairness/stats into Postgres',
    description:
      'Merges with GREATEST(db, python). Python counters reset on restart; Nest is durable.',
  })
  syncFromPython() {
    return this.fairness.syncFromPython();
  }
}
