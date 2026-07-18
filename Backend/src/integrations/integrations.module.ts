import { Module } from '@nestjs/common';
import { AiClient } from './ai/ai.client';
import { ElevenLabsClient } from './elevenlabs/elevenlabs.client';
import { ExaClient } from './exa/exa.client';

/**
 * External service clients (AI, TTS, research).
 * Feature modules inject these — never call vendors from controllers.
 */
@Module({
  providers: [AiClient, ElevenLabsClient, ExaClient],
  exports: [AiClient, ElevenLabsClient, ExaClient],
})
export class IntegrationsModule {}
