// Development server for a second checkout (front-end rework) beside the main one:
// API on 3101 and web on 5273 by default, so the election-night server on 3001 is never touched.
import { spawn } from 'node:child_process';
process.env.ATLAS_API_PORT ??= '3101';
process.env.ATLAS_WEB_PORT ??= '5273';
spawn(process.execPath, ['scripts/dev.mjs'], { stdio: 'inherit' }).on('exit', (code) =>
  process.exit(code ?? 0),
);
