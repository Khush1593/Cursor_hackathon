import { Injectable, NotImplementedException } from '@nestjs/common';
import { TriageTurnDto } from './dto/triage-turn.dto';

/**
 * Orchestrates: auth context → history → AI → Zod → Exa/TTS → persist → audit → response.
 * Step order is defined in project_knowledge.md §11 — implement there, not here yet.
 */
@Injectable()
export class TriageService {
  handleTurn(_dto: TriageTurnDto): Promise<unknown> {
    throw new NotImplementedException(
      'TriageService.handleTurn not implemented yet',
    );
  }
}
