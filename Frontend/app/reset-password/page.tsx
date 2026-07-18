"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, Suspense, useState } from "react";
import { ApiError, resetPassword } from "@/lib/api";
import {
  type FieldErrors,
  hasFieldErrors,
  isRequired,
  isValidPassword,
} from "@/lib/validation";
import {
  AuthButton,
  AuthError,
  AuthField,
  AuthForm,
  AuthShell,
  AuthSuccess,
} from "@/components/auth/AuthShell";

type ResetFields = "token" | "password" | "confirm";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get("token") ?? "";

  const [token, setToken] = useState(tokenFromUrl);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<ResetFields>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const updateToken = (v: string) => {
    setToken(v);
    setFieldErrors((prev) => (prev.token ? { ...prev, token: !isRequired(v) } : prev));
  };

  const updatePassword = (v: string) => {
    setPassword(v);
    setFieldErrors((prev) => {
      if (!prev.password && !prev.confirm) return prev;
      return {
        ...prev,
        password: prev.password ? !isValidPassword(v) : prev.password,
        confirm: prev.confirm ? v !== confirm : prev.confirm,
      };
    });
  };

  const updateConfirm = (v: string) => {
    setConfirm(v);
    setFieldErrors((prev) =>
      prev.confirm ? { ...prev, confirm: v !== password || !isRequired(v) } : prev,
    );
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const next: FieldErrors<ResetFields> = {
      token: !tokenFromUrl && !isRequired(token) ? true : false,
      password: !isValidPassword(password),
      confirm: !isRequired(confirm) || confirm !== password,
    };
    setFieldErrors(next);
    if (hasFieldErrors(next)) return;

    setLoading(true);
    try {
      const res = await resetPassword(token.trim(), password);
      setSuccess(res.message);
      setTimeout(() => router.replace("/login"), 1200);
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
      title="Choose a new password"
      subtitle="Paste the token from your email if it isn't already filled in."
      footer={
        <Link href="/login" className="font-semibold text-aura-accent hover:underline">
          Back to sign in
        </Link>
      }
    >
      <AuthError message={error} />
      <AuthSuccess message={success} />
      <AuthForm onSubmit={onSubmit}>
        {!tokenFromUrl && (
          <AuthField
            id="token"
            label="Reset token"
            value={token}
            onChange={updateToken}
            invalid={!!fieldErrors.token}
            placeholder="From your email link"
          />
        )}
        <AuthField
          id="newPassword"
          label="New password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={updatePassword}
          invalid={!!fieldErrors.password}
          placeholder="Min 8 characters"
        />
        <AuthField
          id="confirmPassword"
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={updateConfirm}
          invalid={!!fieldErrors.confirm}
        />
        <AuthButton loading={loading}>Update password</AuthButton>
      </AuthForm>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div
          data-tier="preventive"
          className="flex min-h-screen items-center justify-center"
        >
          <p className="text-sm text-aura-muted">Loading…</p>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
