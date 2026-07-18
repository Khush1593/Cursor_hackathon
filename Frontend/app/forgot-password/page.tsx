"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { ApiError, forgotPassword } from "@/lib/api";
import { type FieldErrors, hasFieldErrors, isValidEmail } from "@/lib/validation";
import {
  AuthButton,
  AuthError,
  AuthField,
  AuthForm,
  AuthShell,
  AuthSuccess,
} from "@/components/auth/AuthShell";

type ForgotFields = "email";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<ForgotFields>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [devToken, setDevToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const updateEmail = (v: string) => {
    setEmail(v);
    setFieldErrors((prev) => (prev.email ? { ...prev, email: !isValidEmail(v) } : prev));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setDevToken(null);

    const next: FieldErrors<ForgotFields> = {
      email: !isValidEmail(email),
    };
    setFieldErrors(next);
    if (hasFieldErrors(next)) return;

    setLoading(true);
    try {
      const res = await forgotPassword(email.trim());
      setSuccess(res.message);
      if (res.resetToken) setDevToken(res.resetToken);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not reach the server. Check NEXT_PUBLIC_API_URL.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We'll email a one-time link if an account exists for that address."
      footer={
        <Link href="/login" className="font-semibold text-aura-accent hover:underline">
          Back to sign in
        </Link>
      }
    >
      <AuthError message={error} />
      <AuthSuccess message={success} />
      {devToken && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-950">
          <p className="font-semibold">Dev only — reset token exposed</p>
          <p className="mt-1 break-all font-mono">{devToken}</p>
          <Link
            href={`/reset-password?token=${encodeURIComponent(devToken)}`}
            className="mt-2 inline-block font-semibold text-aura-accent hover:underline"
          >
            Open reset page →
          </Link>
        </div>
      )}
      <AuthForm onSubmit={onSubmit}>
        <AuthField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={updateEmail}
          invalid={!!fieldErrors.email}
        />
        <AuthButton loading={loading}>Send reset link</AuthButton>
      </AuthForm>
    </AuthShell>
  );
}
