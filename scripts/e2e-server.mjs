import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const directory = await mkdtemp(path.join(tmpdir(), 'ischi-e2e-'));
const child = spawn(process.execPath, ['scripts/start-server.mjs'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    DATA_DIR: directory,
    PORT: '3001',
    HOSTNAME: '0.0.0.0',
    NODE_ENV: 'production',
    NEXT_TELEMETRY_DISABLED: '1',
  },
});
let stopping = false;
const stop = async (code = 0) => {
  if (stopping) return;
  stopping = true;
  child.kill('SIGTERM');
  const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
  timer.unref();
  await new Promise((resolve) => {
    if (child.exitCode !== null) resolve();
    else child.once('exit', resolve);
  });
  clearTimeout(timer);
  await rm(directory, { recursive: true, force: true });
  process.exit(code);
};
process.on('SIGTERM', () => void stop());
process.on('SIGINT', () => void stop());
child.on('exit', (code) => void stop(code ?? 1));
child.on('error', (error) => {
  console.error(error.message);
  void stop(1);
});
