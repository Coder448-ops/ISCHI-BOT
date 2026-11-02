import { cp, access } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
const root = process.cwd(),
  standalone = path.join(root, '.next', 'standalone');
// Standalone runs from .next/standalone; load project env files here as well.
// Existing process/container variables keep priority (Node loadEnvFile semantics).
for (const file of ['.env.local', '.env']) {
  const envPath = path.join(root, file);
  if (existsSync(envPath)) process.loadEnvFile(envPath);
}
try {
  await access(path.join(standalone, 'server.js'));
} catch {
  console.error('Run npm run build first.');
  process.exit(1);
}
await cp(path.join(root, '.next', 'static'), path.join(standalone, '.next', 'static'), {
  recursive: true,
});
await cp(path.join(root, 'public'), path.join(standalone, 'public'), { recursive: true });
await cp(path.join(root, 'seeds'), path.join(standalone, 'seeds'), { recursive: true });
const child = spawn(process.execPath, ['server.js'], {
  cwd: standalone,
  stdio: 'inherit',
  env: {
    ...process.env,
    HOSTNAME: process.env.HOSTNAME || '0.0.0.0',
    PORT: process.env.PORT || '3000',
  },
});
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => child.kill(signal));
child.on('exit', (code) => process.exit(code ?? 0));
child.on('error', (error) => {
  console.error(error.message);
  process.exit(1);
});
