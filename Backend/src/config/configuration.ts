/**
 * Centralized env mapping — single place to read process.env.
 * Keeps ConfigService keys stable across the app (DRY).
 */
export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:3001',
  databaseUrl: process.env.DATABASE_URL,
  jwt: {
    secret: process.env.JWT_SECRET ?? 'change-me',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  },
  pythonServiceUrl: process.env.PYTHON_SERVICE_URL ?? 'http://localhost:8000',
  useAiStub: process.env.USE_AI_STUB === 'true',
  exaApiKey: process.env.EXA_API_KEY ?? '',
  elevenLabs: {
    apiKey: process.env.ELEVENLABS_API_KEY ?? '',
    voiceId: process.env.ELEVENLABS_VOICE_ID ?? '',
  },
  rateLimitPerMinute: parseInt(process.env.RATE_LIMIT_PER_MINUTE ?? '10', 10),
});
