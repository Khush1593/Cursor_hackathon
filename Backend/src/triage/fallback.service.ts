import { Injectable } from '@nestjs/common';

/**
 * Offline fail-safe — returns safe_mode_fallback or emergency_fallback.
 * Keyword selection rules: project_knowledge.md §11.
 */
@Injectable()
export class FallbackService {
  // TODO: resolve(transcript: string): FrontendTriageResponse
}
