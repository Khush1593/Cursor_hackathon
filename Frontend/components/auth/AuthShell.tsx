"use client";

import Link from "next/link";
import type { FormEvent, ReactNode } from "react";

/** Shared glass shell for all auth screens — brand-first, one job per page. */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div
      data-tier="preventive"
      className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-12"
    >
      <div className="mb-10 text-center">
        <Link href="/login" className="inline-flex flex-col items-center gap-2">
          <span
            className="flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-sm"
            style={{
              background:
                "radial-gradient(circle at 30% 25%, color-mix(in srgb, var(--aura-accent) 80%, white), var(--aura-accent))",
              animation: "orb-pulse 4s ease-in-out infinite",
            }}
          >
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor">
              <path d="M12 2l1.6 5.6L19 9l-5.4 1.4L12 16l-1.6-5.6L5 9l5.4-1.4L12 2z" />
            </svg>
          </span>
          <span className="text-3xl font-semibold tracking-tight text-aura-ink">
            Aura
          </span>
        </Link>
        <p className="mt-1 text-sm text-aura-muted">Health guardian</p>
      </div>

      <div className="aura-panel aura-transition w-full max-w-md rounded-3xl p-8 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight text-aura-ink">{title}</h1>
        <p className="mt-1.5 text-sm text-aura-muted">{subtitle}</p>
        <div className="mt-6">{children}</div>
        {footer && (
          <div className="mt-6 text-center text-sm text-aura-muted">{footer}</div>
        )}
      </div>

      <p className="mt-8 max-w-sm text-center text-[11px] leading-relaxed text-aura-muted">
        Aura is not a medical device and does not diagnose.
      </p>
    </div>
  );
}

export function AuthField({
  label,
  id,
  type = "text",
  value,
  onChange,
  invalid = false,
  autoComplete,
  placeholder,
}: {
  label: string;
  id: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  /** Red border when true — custom validation only, no HTML5 bubbles. */
  invalid?: boolean;
  autoComplete?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold tracking-wide text-aura-muted uppercase">
        {label}
      </span>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={invalid}
        onChange={(e) => onChange(e.target.value)}
        className={[
          "w-full rounded-2xl bg-white/70 px-4 py-3 text-sm text-aura-ink outline-none transition placeholder:text-aura-muted/60",
          invalid
            ? "border-2 border-red-500 focus:ring-2 focus:ring-red-400/30"
            : "border border-[var(--aura-panel-border)] focus:ring-2 focus:ring-aura-accent/35",
        ].join(" ")}
      />
    </label>
  );
}

export function AuthButton({
  children,
  loading,
  type = "submit",
  variant = "primary",
  onClick,
}: {
  children: ReactNode;
  loading?: boolean;
  type?: "submit" | "button";
  variant?: "primary" | "ghost";
  onClick?: () => void;
}) {
  const base =
    "inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition active:scale-[0.98] disabled:cursor-wait disabled:opacity-60";
  const styles =
    variant === "primary"
      ? "bg-aura-accent text-white hover:opacity-95"
      : "bg-aura-accent-soft text-aura-ink hover:opacity-90";

  return (
    <button
      type={type}
      disabled={loading}
      onClick={onClick}
      className={`${base} ${styles}`}
    >
      {loading ? "Please wait…" : children}
    </button>
  );
}

export function AuthError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
    >
      {message}
    </div>
  );
}

export function AuthSuccess({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
    >
      {message}
    </div>
  );
}

export type AuthFormProps = {
  onSubmit: (e: FormEvent) => void;
  children: ReactNode;
};

/** Native browser validation is disabled — pages own red-border validation. */
export function AuthForm({ onSubmit, children }: AuthFormProps) {
  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
      {children}
    </form>
  );
}
