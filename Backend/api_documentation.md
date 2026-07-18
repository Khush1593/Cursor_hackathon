# Aura Backend — Authentication API Documentation

> **Audience:** Frontend team  
> **Base URL (dev):** `http://localhost:3000/api`  
> **Interactive Swagger:** `http://localhost:3000/api/docs`  
> **Auth model:** HTTP-only Secure cookies — **never** store access/refresh tokens in `localStorage` or `sessionStorage`.

---

## 1. Frontend integration rules (read first)

| Rule | Detail |
|------|--------|
| Credentials | Every authenticated `fetch`/`axios` call must use `credentials: 'include'` (browser sends cookies). |
| CORS | Backend allows `FRONTEND_ORIGIN` with `credentials: true`. Frontend origin must match `.env` exactly. |
| Token storage | Tokens live only in cookies `aura_access_token` and `aura_refresh_token` (HttpOnly). JS cannot read them — by design. |
| 401 handling | On `401` from a protected route, call `POST /api/auth/refresh` once; if refresh fails, redirect to login. |
| CSRF note | Cookies use `SameSite=Lax` in local HTTP; production uses `SameSite=None; Secure` when `COOKIE_SECURE=true`. Prefer same-site or HTTPS end-to-end. |

### Axios example

```ts
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL, // http://localhost:3000
  withCredentials: true,
});
```

### Fetch example

```ts
await fetch(`${API}/api/auth/login`, {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
```

---

## 2. Cookie reference

| Cookie | Purpose | HttpOnly | Secure | Typical lifetime |
|--------|---------|----------|--------|------------------|
| `aura_access_token` | Short-lived JWT for API auth | yes | prod / `COOKIE_SECURE` | 15m (`JWT_ACCESS_EXPIRES_IN`) |
| `aura_refresh_token` | Long-lived JWT to rotate access | yes | prod / `COOKIE_SECURE` | 7d (`JWT_REFRESH_EXPIRES_IN`) |

Cookies are set on **register**, **login**, and **refresh**. Cleared on **logout** (and revoked server-side).

---

## 3. Endpoints

### 3.1 Register — `POST /api/auth/register`

**Auth required:** No  

**Request headers**

| Header | Value |
|--------|-------|
| `Content-Type` | `application/json` |

**Request body**

```json
{
  "email": "demo@aura.health",
  "password": "SecurePass1!",
  "age": 34,
  "sex": "female",
  "chronicConditions": ["mild eczema"],
  "currentMeds": ["multivitamin"],
  "emergencyContactName": "Jane Doe",
  "emergencyContactPhone": "+1-555-0100"
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `email` | yes | Unique, lowercased server-side |
| `password` | yes | Min 8 characters |
| `age` | yes | Integer 1–120 |
| `sex` | yes | Free-form string |
| `chronicConditions` | no | `string[]`, default `[]` |
| `currentMeds` | no | `string[]`, default `[]` |
| `emergencyContactName` | no | |
| `emergencyContactPhone` | no | |

**Success — `201 Created`**

Sets `Set-Cookie` for access + refresh. Body (no tokens):

```json
{
  "user": {
    "id": "uuid",
    "email": "demo@aura.health",
    "age": 34,
    "sex": "female",
    "chronicConditions": ["mild eczema"],
    "currentMeds": ["multivitamin"],
    "emergencyContactName": "Jane Doe",
    "emergencyContactPhone": "+1-555-0100",
    "activeMode": "preventive",
    "isEmergencyState": false
  },
  "message": "Registered successfully. Auth cookies set."
}
```

**Errors**

| Status | When |
|--------|------|
| `400` | Validation failed (bad email, short password, etc.) |
| `409` | Email already registered |
| `429` | Rate limited (5 / minute) |

---

### 3.2 Login — `POST /api/auth/login`

**Auth required:** No  

**Request headers:** `Content-Type: application/json`

**Request body**

```json
{
  "email": "demo@aura.health",
  "password": "SecurePass1!"
}
```

**Success — `200 OK`**

Sets auth cookies. Body:

```json
{
  "user": { "id": "uuid", "email": "demo@aura.health", "...": "..." },
  "message": "Logged in successfully. Auth cookies set."
}
```

**Errors**

| Status | When |
|--------|------|
| `400` | Validation failed |
| `401` | Invalid email or password (generic message — no enumeration) |
| `429` | Rate limited (10 / minute) |

---

### 3.3 Forgot password — `POST /api/auth/forgot-password`

**Auth required:** No  

**Request body**

```json
{ "email": "demo@aura.health" }
```

**Behavior**

1. If the email exists, NestJS stores a hashed one-time token (1h TTL).
2. **Nodemailer** sends an HTML + plain-text email using `src/mail/templates/password-reset.template.ts`.
3. The link points to: `{FRONTEND_ORIGIN}{MAIL_RESET_PASSWORD_PATH}?token=...`  
   Default: `http://localhost:3001/reset-password?token=...`
4. API always returns the same generic message (no account enumeration).

**Success — `200 OK`**

```json
{
  "message": "If an account exists for that email, a password reset link has been sent."
}
```

**Optional (local only):** when `NODE_ENV=development` **and** `MAIL_DEV_EXPOSE_TOKEN=true`:

```json
{
  "message": "If an account exists for that email, a password reset link has been sent.",
  "resetToken": "a1b2c3…64-hex-chars"
}
```

Prefer the emailed link. Do **not** enable `MAIL_DEV_EXPOSE_TOKEN` in production.

**SMTP env (Backend `.env`)**

| Variable | Purpose |
|----------|---------|
| `MAIL_HOST` / `MAIL_PORT` / `MAIL_SECURE` | SMTP server |
| `MAIL_USER` / `MAIL_PASS` | SMTP auth |
| `MAIL_FROM` | From header |
| `MAIL_RESET_PASSWORD_PATH` | FE path (default `/reset-password`) |

If SMTP is unset, Nodemailer uses **JSON transport** (email content is logged; not delivered).

**Errors**

| Status | When |
|--------|------|
| `400` | Invalid email format |
| `429` | Rate limited (5 / minute) |

---

### 3.4 Reset password — `POST /api/auth/reset-password`

**Auth required:** No  

**Request body**

```json
{
  "token": "a1b2c3…",
  "newPassword": "NewSecurePass1!"
}
```

**Success — `200 OK`**

```json
{
  "message": "Password updated successfully. Please log in again."
}
```

Existing sessions are revoked (`refreshTokenHash` cleared). User must log in again.

**Errors**

| Status | When |
|--------|------|
| `400` | Invalid/expired token or validation error |
| `429` | Rate limited (5 / minute) |

---

### 3.5 Supporting endpoints (cookie session lifecycle)

These are required for cookie-based auth on the frontend.

#### Logout — `POST /api/auth/logout`

**Auth required:** Yes (access cookie or Bearer)  
**Success `200`:** `{ "message": "Logged out. Auth cookies cleared." }`  
Clears cookies + revokes refresh token server-side.

#### Refresh — `POST /api/auth/refresh`

**Auth required:** Refresh cookie (no access cookie needed)  
**Success `200`:** Same shape as login (`user` + `message`); rotates both cookies.  
**`401`:** Missing/invalid/revoked refresh token → send user to login.

#### Current user — `GET /api/auth/me`

**Auth required:** Yes  
**Success `200`:** Public user object (same as `user` in login response).  
Use on app boot to restore session without a hardcoded demo user id.

---

## 4. Authentication requirements matrix

| Endpoint | Access cookie | Refresh cookie | Notes |
|----------|---------------|----------------|-------|
| `POST /register` | — | — | Sets both cookies |
| `POST /login` | — | — | Sets both cookies |
| `POST /forgot-password` | — | — | |
| `POST /reset-password` | — | — | Revokes sessions |
| `POST /logout` | required | — | |
| `POST /refresh` | — | required | |
| `GET /me` | required | — | |
| Other PHI routes (`/users/*`, `/triage/*`, …) | required | — | Prefer `userId` from cookie JWT, not client body |

Swagger also accepts `Authorization: Bearer <access_token>` for manual testing.

---

## 5. Suggested frontend auth flow

```
App mount
  → GET /api/auth/me (credentials: include)
      → 200: hydrate store with user
      → 401: POST /api/auth/refresh
            → 200: retry /me
            → 401: show login / register

Login / Register forms
  → POST ... (credentials: include)
  → store user from JSON body (not tokens)
  → navigate to dashboard

Forgot password
  → POST /forgot-password
  → show "check your email"
  → user opens link: /reset-password?token=...
  → POST /reset-password with token + newPassword
  → (optional local) MAIL_DEV_EXPOSE_TOKEN=true returns resetToken in JSON

API 401 interceptor
  → try refresh once → retry original request
  → else logout UI
```

---

## 6. Security notes

- Passwords hashed with **bcrypt** (12 rounds).
- Reset tokens stored as **SHA-256** hashes with 1-hour expiry; raw token shown only in development responses.
- Refresh tokens hashed server-side; mismatch clears the session (theft mitigation).
- Auth endpoints are **rate-limited** (Nest Throttler).
- Audit actions logged: `register`, `login`, `logout`, `forgot_password`, `reset_password`, `token_refresh` (non-PHI metadata only).

---

## 7. Swagger

Open `http://localhost:3000/api/docs` after starting the Backend. Use the cookie auth scheme `aura_access_token` or Bearer after logging in via the login endpoint (browser will store cookies for “Try it out” on same origin).
