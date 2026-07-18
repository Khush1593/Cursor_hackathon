"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { ApiError, login } from "@/lib/api";
import {
  type FieldErrors,
  hasFieldErrors,
  isRequired,
  isValidEmail,
} from "@/lib/validation";
import { useAuraStore } from "@/store/aura.store";
import {
  AuthButton,
  AuthError,
  AuthField,
  AuthForm,
  AuthShell,
} from "@/components/auth/AuthShell";
import { GuestOnly } from "@/components/auth/GuestOnly";

type LoginFields = "email" | "password";

export default function LoginPage() {
  return (
    <GuestOnly>
      <LoginForm />
    </GuestOnly>
  );
}

function LoginForm() {
  const router = useRouter();
  const hydrateFromAuthUser = useAuraStore((s) => s.hydrateFromAuthUser);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<LoginFields>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const updateEmail = (v: string) => {
    setEmail(v);
    setFieldErrors((prev) => (prev.email ? { ...prev, email: !isValidEmail(v) } : prev));
  };

  const updatePassword = (v: string) => {
    setPassword(v);
    setFieldErrors((prev) =>
      prev.password ? { ...prev, password: !isRequired(v) } : prev,
    );
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const next: FieldErrors<LoginFields> = {
      email: !isValidEmail(email),
      password: !isRequired(password),
    };
    setFieldErrors(next);
    if (hasFieldErrors(next)) return;

    setLoading(true);
    try {
      const res = await login(email.trim(), password);
      hydrateFromAuthUser(res.user);
      router.replace("/");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not reach the server. Check NEXT_PUBLIC_API_URL (or your ngrok URL).",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to continue with your health guardian."
      footer={
        <>
          No account?{" "}
          <Link
            href="/register"
            className="font-semibold text-aura-accent hover:underline"
          >
            Create one
          </Link>
        </>
      }
    >
      <AuthError message={error} />
      <AuthForm onSubmit={onSubmit}>
        <AuthField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={updateEmail}
          invalid={!!fieldErrors.email}
          placeholder="you@example.com"
        />
        <AuthField
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={updatePassword}
          invalid={!!fieldErrors.password}
          placeholder="••••••••"
        />
        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-xs font-medium text-aura-accent hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <AuthButton loading={loading}>Sign in</AuthButton>
      </AuthForm>
    </AuthShell>
  );
}
