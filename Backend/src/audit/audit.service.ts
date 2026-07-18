import { Injectable } from '@nestjs/common';
import { AuditAction } from '../common/constants';

export interface WriteAuditParams {
  userId: string;
  action: AuditAction;
  actorId?: string;
  resourceId?: string;
  /** Must never contain PHI (no transcript / symptom text). */
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

/**
 * Persists AuditLog rows. Keep metadata non-PHI by design.
 */
@Injectable()
export class AuditService {
  write(_params: WriteAuditParams): Promise<void> {
    // TODO: persist via PrismaService
    return Promise.resolve();
  }
}
