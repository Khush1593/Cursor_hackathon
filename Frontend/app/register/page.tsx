"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { ApiError, register } from "@/lib/api";
import {
  type FieldErrors,
  hasFieldErrors,
  isRequired,
  isValidAge,
  isValidEmail,
  isValidPassword,
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

type RegisterFields = "email" | "password" | "age" | "sex";

export default function RegisterPage() {
  return (
    <GuestOnly>
      <RegisterForm />
    </GuestOnly>
  );
}

function RegisterForm() {
  const router = useRouter();
  const hydrateFromAuthUser = useAuraStore((s) => s.hydrateFromAuthUser);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [age, setAge] = useState("34");
  const [sex, setSex] = useState("female");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
  const [chronicConditions, setChronicConditions] = useState("");
  const [currentMeds, setCurrentMeds] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<RegisterFields>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const splitList = (raw: string) =>
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  const updateEmail = (v: string) => {
    setEmail(v);
    setFieldErrors((prev) => (prev.email ? { ...prev, email: !isValidEmail(v) } : prev));
  };

  const updatePassword = (v: string) => {
    setPassword(v);
    setFieldErrors((prev) =>
      prev.password ? { ...prev, password: !isValidPassword(v) } : prev,
    );
  };

  const updateAge = (v: string) => {
    setAge(v);
    setFieldErrors((prev) => (prev.age ? { ...prev, age: !isValidAge(v) } : prev));
  };

  const updateSex = (v: string) => {
    setSex(v);
    setFieldErrors((prev) => (prev.sex ? { ...prev, sex: !isRequired(v) } : prev));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const next: FieldErrors<RegisterFields> = {
      email: !isValidEmail(email),
      password: !isValidPassword(password),
      age: !isValidAge(age),
      sex: !isRequired(sex),
    };
    setFieldErrors(next);
    if (hasFieldErrors(next)) return;

    setLoading(true);
    try {
      const conditions = splitList(chronicConditions);
      const meds = splitList(currentMeds);
      const res = await register({
        email: email.trim(),
        password,
        age: Number(age),
        sex: sex.trim(),
        chronicConditions: conditions.length ? conditions : undefined,
        currentMeds: meds.length ? meds : undefined,
        emergencyContactName: emergencyContactName.trim() || undefined,
        emergencyContactPhone: emergencyContactPhone.trim() || undefined,
      });
      hydrateFromAuthUser(res.user);
      router.replace("/");
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
      title="Create your account"
      subtitle="A few basics so Aura can keep you safe — never a diagnosis."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-aura-accent hover:underline">
            Sign in
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
        />
        <AuthField
          id="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={updatePassword}
          invalid={!!fieldErrors.password}
          placeholder="Min 8 characters"
        />
        <div className="grid grid-cols-2 gap-3">
          <AuthField
            id="age"
            label="Age"
            type="number"
            value={age}
            onChange={updateAge}
            invalid={!!fieldErrors.age}
          />
          <AuthField
            id="sex"
            label="Sex"
            value={sex}
            onChange={updateSex}
            invalid={!!fieldErrors.sex}
            placeholder="female / male / …"
          />
        </div>
        <AuthField
          id="chronicConditions"
          label="Chronic conditions"
          value={chronicConditions}
          onChange={setChronicConditions}
          placeholder="Optional — comma-separated"
        />
        <AuthField
          id="currentMeds"
          label="Current medications"
          value={currentMeds}
          onChange={setCurrentMeds}
          placeholder="Optional — comma-separated"
        />
        <AuthField
          id="emergencyContactName"
          label="Emergency contact name"
          value={emergencyContactName}
          onChange={setEmergencyContactName}
          placeholder="Optional"
        />
        <AuthField
          id="emergencyContactPhone"
          label="Emergency contact phone"
          type="tel"
          value={emergencyContactPhone}
          onChange={setEmergencyContactPhone}
          placeholder="Optional"
        />
        <AuthButton loading={loading}>Create account</AuthButton>
      </AuthForm>
    </AuthShell>
  );
}
