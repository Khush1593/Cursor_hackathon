import { Injectable, OnModuleInit } from '@nestjs/common';

/**
 * Loads triage_dataset.json once at boot into a condition_id → severity_rank map.
 */
@Injectable()
export class DatasetService implements OnModuleInit {
  private severityByConditionId = new Map<string, number>();

  onModuleInit(): void {
    // TODO: read src/data/triage_dataset.json and populate map
  }

  getSeverityRank(_conditionId: string): number | undefined {
    return this.severityByConditionId.get(_conditionId);
  }
}
