import { Injectable } from '@nestjs/common';
import { readDataJson } from '../common/utils/data-path';
import { FrontendTriageResponse } from './triage.types';

type FallbackCache = {
  safe_mode_fallback: FrontendTriageResponse;
  emergency_fallback: FrontendTriageResponse;
};

/**
 * Offline fail-safe — picks emergency vs safe by hard keyword combinations.
 * @see project_knowledge.md §11
 */
@Injectable()
export class FallbackService {
  private readonly cache: FallbackCache;

  constructor() {
    this.cache = readDataJson<FallbackCache>('fallback_responses.json');
  }

  resolve(transcript: string): FrontendTriageResponse {
    const t = transcript.toLowerCase();
    const emergency = this.isEmergencyTranscript(t);
    const base = emergency
      ? this.cache.emergency_fallback
      : this.cache.safe_mode_fallback;

    return {
      ...base,
      audio_base64: null,
      exa_insight: null,
      reasoning_trace: base.reasoning_trace ?? [
        emergency
          ? 'Offline fallback: emergency keyword combination matched'
          : 'Offline fallback: safe mode',
      ],
      updated_metrics: base.updated_metrics ?? {},
      nearest_er: base.nearest_er ?? null,
      ask_share_location: base.ask_share_location ?? (emergency ? true : false),
    };
  }

  private isEmergencyTranscript(t: string): boolean {
    const chestEmergency =
      t.includes('chest') &&
      (t.includes('pressure') ||
        t.includes('crushing') ||
        t.includes('tight') ||
        t.includes('heart attack'));

    const breatheEmergency =
      (t.includes("can't") && t.includes('breathe')) ||
      (t.includes('cannot') && t.includes('breathe')) ||
      (t.includes('struggling') && t.includes('breathe'));

    const faceEmergency =
      t.includes('face') && (t.includes('drooping') || t.includes('numb'));

    const strokeEmergency =
      t.includes('stroke') || (t.includes('slurred') && t.includes('speech'));

    const bleedingEmergency = t.includes('severe') && t.includes('bleeding');

    return (
      chestEmergency ||
      breatheEmergency ||
      t.includes('throat closing') ||
      faceEmergency ||
      strokeEmergency ||
      bleedingEmergency
    );
  }
}
