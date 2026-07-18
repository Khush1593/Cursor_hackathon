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
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  cookie: {
    secure:
      process.env.COOKIE_SECURE === 'true' ||
      process.env.NODE_ENV === 'production',
  },
  mail: {
    host: process.env.MAIL_HOST ?? '',
    port: parseInt(process.env.MAIL_PORT ?? '587', 10),
    secure: process.env.MAIL_SECURE === 'true',
    user: process.env.MAIL_USER ?? '',
    pass: process.env.MAIL_PASS ?? '',
    from: process.env.MAIL_FROM ?? 'Aura <noreply@aura.health>',
    resetPasswordPath:
      process.env.MAIL_RESET_PASSWORD_PATH ?? '/reset-password',
    /** Dev-only: include raw resetToken in forgot-password JSON for local FE testing. */
    exposeResetToken: process.env.MAIL_DEV_EXPOSE_TOKEN === 'true',
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
