import { readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { E2E_DIR } from './paths';

/** Best effort: Windows may still hold the server's files; the next setup removes leftovers. */
export default async function globalTeardown() {
  try {
    for (const file of readdirSync(E2E_DIR))
      try {
        rmSync(join(E2E_DIR, file), { force: true, maxRetries: 3 });
      } catch {
        /* still open */
      }
  } catch {
    /* nothing to clean */
  }
}
