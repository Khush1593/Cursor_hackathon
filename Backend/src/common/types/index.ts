/**
 * Authenticated principal attached to requests after JWT validation.
 * userId always comes from the token — never trust client-supplied ids for auth.
 */
export interface AuthUser {
  userId: string;
  email?: string;
}

export interface PendingTriageBookmark {
  condition_id: string;
  turn: number;
}
