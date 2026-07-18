import { Module } from '@nestjs/common';
import { TriageController } from './triage.controller';
import { TriageService } from './triage.service';
import { TriageMapper } from './triage.mapper';
import { FallbackService } from './fallback.service';
import { DatasetService } from './dataset.service';

/**
 * Primary orchestrator module — POST /api/triage/turn.
 * Mapper + fallback + dataset are co-located for cohesive triage DRY.
 */
@Module({
  controllers: [TriageController],
  providers: [TriageService, TriageMapper, FallbackService, DatasetService],
  exports: [TriageService],
})
export class TriageModule {}
