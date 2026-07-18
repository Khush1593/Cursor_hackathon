import { Module } from '@nestjs/common';
import { TriageController } from './triage.controller';
import { TriageService } from './triage.service';
import { TriageMapper } from './triage.mapper';
import { FallbackService } from './fallback.service';
import { DatasetService } from './dataset.service';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { ConsentModule } from '../consent/consent.module';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [AuthModule, AuditModule, ConsentModule, IntegrationsModule],
  controllers: [TriageController],
  providers: [TriageService, TriageMapper, FallbackService, DatasetService],
  exports: [TriageService],
})
export class TriageModule {}
