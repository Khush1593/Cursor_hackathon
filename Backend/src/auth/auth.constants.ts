/** Cookie & crypto constants for auth (single source — DRY). */

export const ACCESS_COOKIE = 'aura_access_token';
export const REFRESH_COOKIE = 'aura_refresh_token';

export const BCRYPT_ROUNDS = 12;

/** Password-reset tokens expire after 1 hour. */
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
