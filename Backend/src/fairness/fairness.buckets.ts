/**
 * Mirror Python/fairness.py bucketing — age_band + sex_group only (no PHI).
 */

export function ageBand(age: number): string {
  if (!Number.isFinite(age) || age < 0) {
    return 'unknown';
  }
  if (age < 18) return '0-17';
  if (age < 30) return '18-29';
  if (age < 40) return '30-39';
  if (age < 50) return '40-49';
  if (age < 60) return '50-59';
  if (age < 70) return '60-69';
  return '70+';
}

export function sexGroup(sex: string): string {
  const s = (sex ?? '').trim().toLowerCase();
  if (s.startsWith('f')) return 'female';
  if (s.startsWith('m')) return 'male';
  if (!s) return 'unknown';
  return 'other';
}
