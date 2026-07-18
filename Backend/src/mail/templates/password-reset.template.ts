export interface PasswordResetEmailParams {
  recipientEmail: string;
  resetUrl: string;
  expiresInMinutes: number;
  appName?: string;
}

/**
 * Password-reset email templates (HTML + plain text).
 * Keep presentation here so AuthService only supplies data.
 */
export function buildPasswordResetEmail(params: PasswordResetEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const appName = params.appName ?? 'Aura';
  const minutes = params.expiresInMinutes;

  const subject = `${appName} — Reset your password`;

  const text = [
    `Hi,`,
    ``,
    `We received a request to reset the password for your ${appName} account (${params.recipientEmail}).`,
    ``,
    `Open this link to choose a new password (expires in ${minutes} minutes):`,
    params.resetUrl,
    ``,
    `If you did not request this, you can ignore this email — your password will stay the same.`,
    ``,
    `— The ${appName} team`,
    ``,
    `${appName} is not a medical device and does not diagnose.`,
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:Georgia,'Times New Roman',serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f0f4f8;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #dbe4ee;">
          <tr>
            <td style="background:linear-gradient(135deg,#0ea5e9 0%,#0369a1 100%);padding:28px 32px;">
              <p style="margin:0;font-size:28px;font-weight:700;letter-spacing:-0.02em;color:#ffffff;font-family:system-ui,-apple-system,sans-serif;">${appName}</p>
              <p style="margin:8px 0 0;font-size:14px;color:#e0f2fe;font-family:system-ui,-apple-system,sans-serif;">Password reset</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:16px;line-height:1.5;">Hi,</p>
              <p style="margin:0 0 16px;font-size:16px;line-height:1.5;">
                We received a request to reset the password for
                <strong style="font-family:system-ui,-apple-system,sans-serif;">${escapeHtml(params.recipientEmail)}</strong>.
              </p>
              <p style="margin:0 0 24px;font-size:16px;line-height:1.5;">
                This link expires in <strong>${minutes} minutes</strong>.
              </p>
              <p style="margin:0 0 28px;text-align:center;">
                <a href="${escapeHtml(params.resetUrl)}"
                   style="display:inline-block;background:#0369a1;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:15px;font-weight:600;font-family:system-ui,-apple-system,sans-serif;">
                  Reset password
                </a>
              </p>
              <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#475569;font-family:system-ui,-apple-system,sans-serif;">
                Or copy and paste this URL into your browser:
              </p>
              <p style="margin:0 0 24px;font-size:12px;line-height:1.4;word-break:break-all;color:#0369a1;font-family:ui-monospace,monospace;">
                ${escapeHtml(params.resetUrl)}
              </p>
              <p style="margin:0;font-size:14px;line-height:1.5;color:#64748b;">
                If you did not request a password reset, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 28px;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:12px;line-height:1.4;color:#94a3b8;font-family:system-ui,-apple-system,sans-serif;">
                ${appName} is not a medical device and does not diagnose.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
