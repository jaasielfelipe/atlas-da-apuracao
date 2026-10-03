import { join } from 'node:path';

/** All E2E databases live under tmp/ (gitignored), named per run; never under data/. */
export const E2E_DIR = join('tmp', 'e2e');
export function e2ePaths() {
  process.env.E2E_RUN ??= String(Date.now());
  const run = process.env.E2E_RUN;
  return {
    run,
    fixture: join(E2E_DIR, `atlas-${run}.sqlite`),
    official: join(E2E_DIR, `official-${run}.sqlite`),
    simulated: join(E2E_DIR, `simulated-${run}.sqlite`),
    history: join(E2E_DIR, `history-absent-${run}.sqlite`),
  };
}
