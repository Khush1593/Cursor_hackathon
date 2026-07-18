import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * ElevenLabs TTS client — text → base64 MP3. Failures return null.
 */
@Injectable()
export class ElevenLabsClient {
  private readonly logger = new Logger(ElevenLabsClient.name);

  constructor(private readonly config: ConfigService) {}

  async synthesize(text: string): Promise<string | null> {
    const apiKey = this.config.get<string>('elevenLabs.apiKey');
    const voiceId = this.config.get<string>('elevenLabs.voiceId');

    if (!apiKey || !voiceId) {
      this.logger.warn(
        'ELEVENLABS_API_KEY or ELEVENLABS_VOICE_ID missing — skipping TTS',
      );
      return null;
    }

    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
            Accept: 'audio/mpeg',
          },
          body: JSON.stringify({
            text,
            model_id: 'eleven_monolingual_v1',
          }),
        },
      );

      if (!response.ok) {
        this.logger.warn(`ElevenLabs returned ${response.status}`);
        return null;
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      return buffer.toString('base64');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unknown';
      this.logger.warn(`ElevenLabs TTS failed: ${message}`);
      return null;
    }
  }
}
