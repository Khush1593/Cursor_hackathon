/** Shared client-side validators — no HTML5 constraint validation. */

export function isRequired(value: string): boolean {
  return value.trim().length > 0;
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isValidPassword(value: string, minLength = 8): boolean {
  return value.length >= minLength;
}

export function isValidAge(value: string): boolean {
  if (!/^\d+$/.test(value.trim())) return false;
  const n = Number(value);
  return n >= 1 && n <= 120;
}

/** True when the field should show a red border. */
export type FieldErrors<K extends string> = Partial<Record<K, boolean>>;

export function hasFieldErrors<K extends string>(errors: FieldErrors<K>): boolean {
  return Object.values(errors).some(Boolean);
}
