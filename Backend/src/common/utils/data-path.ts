import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * Resolve files under src/data whether Nest emits to dist/ or dist/src/
 * and whether assets landed in dist/data or dist/src/data.
 */
export function resolveDataFile(filename: string): string {
  const candidates = [
    join(__dirname, '..', 'data', filename), // dist/src/common → dist/src/data (if assets there)
    join(__dirname, '..', '..', 'data', filename), // dist/src/common → dist/data
    join(__dirname, 'data', filename),
    join(process.cwd(), 'src', 'data', filename),
    join(process.cwd(), 'dist', 'data', filename),
    join(process.cwd(), 'dist', 'src', 'data', filename),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Data file "${filename}" not found. Tried:\n${candidates.join('\n')}`,
  );
}

export function readDataJson<T>(filename: string): T {
  return JSON.parse(readFileSync(resolveDataFile(filename), 'utf8')) as T;
}
