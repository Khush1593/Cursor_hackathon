import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FrontendExaInsight } from '../../triage/triage.types';

/**
 * Exa research client — query → { title, url, summary } | null.
 */
@Injectable()
export class ExaClient {
  private readonly logger = new Logger(ExaClient.name);

  constructor(private readonly config: ConfigService) {}

  async search(query: string): Promise<FrontendExaInsight> {
    const apiKey = this.config.get<string>('exaApiKey');
    if (!apiKey) {
      this.logger.warn('EXA_API_KEY missing — skipping Exa search');
      return null;
    }

    try {
      const response = await fetch('https://api.exa.ai/search', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          numResults: 1,
          contents: {
            text: false,
            highlights: { highlightsPerUrl: 1, numSentences: 2 },
          },
        }),
      });

      if (!response.ok) {
        this.logger.warn(`Exa returned ${response.status}`);
        return null;
      }

      const json = (await response.json()) as {
        results?: Array<{
          title?: string;
          url?: string;
          highlights?: string[];
        }>;
      };

      if (!json.results?.length) {
        return null;
      }

      const first = json.results[0];
      return {
        title: first.title ?? 'Health article',
        url: first.url ?? '',
        summary: first.highlights?.[0] ?? 'No summary available.',
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unknown';
      this.logger.warn(`Exa search failed: ${message}`);
      return null;
    }
  }
}
