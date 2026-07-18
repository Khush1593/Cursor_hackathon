import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';

/**
 * Audit log writer — no public HTTP surface yet.
 * Injected by triage/users for PHI-touching actions (non-PHI metadata only).
 */
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
