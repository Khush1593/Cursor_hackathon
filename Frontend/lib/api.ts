/**
 * Backend client — three frozen endpoints from Frontend/frontend.md §5.
 * Wired in the API integration step.
 *
 * GET  /api/users/:userId/dashboard
 * POST /api/triage/turn
 * PATCH /api/users/reset-emergency
 */

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "1";

export function getApiBaseUrl(): string {
  if (USE_MOCK) return "/api/mock";
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
}
