import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { readDataJson } from '../common/utils/data-path';

type DatasetCondition = {
  condition_id: string;
  severity_rank: number;
};

/**
 * Loads triage_dataset.json once at boot into condition_id → severity_rank.
 */
@Injectable()
export class DatasetService implements OnModuleInit {
  private readonly logger = new Logger(DatasetService.name);
  private severityByConditionId = new Map<string, number>();

  onModuleInit(): void {
    const parsed = readDataJson<DatasetCondition[]>('triage_dataset.json');
    for (const item of parsed) {
      if (item.condition_id && typeof item.severity_rank === 'number') {
        this.severityByConditionId.set(item.condition_id, item.severity_rank);
      }
    }
    this.logger.log(
      `Loaded ${this.severityByConditionId.size} conditions from triage_dataset.json`,
    );
  }

  getSeverityRank(conditionId: string): number | undefined {
    return this.severityByConditionId.get(conditionId);
  }
}
