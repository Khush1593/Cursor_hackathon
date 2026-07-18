import { Injectable } from '@nestjs/common';

/**
 * Exa research client — query → { title, url, summary } | null.
 * Must guard zero-result responses.
 */
@Injectable()
export class ExaClient {
  // TODO: search(query: string): Promise<ExaInsightDto | null>
}
