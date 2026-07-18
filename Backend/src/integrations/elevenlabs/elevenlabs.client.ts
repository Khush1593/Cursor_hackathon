import { Injectable } from '@nestjs/common';

/**
 * ElevenLabs TTS client — text → base64 MP3.
 * On failure, callers should set audio_base64 to null (never crash the turn).
 */
@Injectable()
export class ElevenLabsClient {
  // TODO: synthesize(text: string): Promise<string | null>
}
