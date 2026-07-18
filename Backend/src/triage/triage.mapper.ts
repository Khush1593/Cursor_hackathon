import { Injectable } from '@nestjs/common';

/**
 * Pure transforms: AuraResponse (AI) → frontend triage response shape.
 * NestJS is the only translator between seams — keep mapping logic here.
 */
@Injectable()
export class TriageMapper {
  // TODO: toFrontendResponse(ai, audioBase64, exaInsight, isEmergency): FrontendTriageResponse
}
