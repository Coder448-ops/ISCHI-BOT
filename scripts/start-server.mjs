import { cp, mkdir, open, rm, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
const root = process.cwd(),
  standalone = path.join(root, '.next', 'standalone'),
  staging = path.join(root, '.next');
// Standalone runs from .next/standalone; load project env files here as well.
// Existing process/container variables keep priority (Node loadEnvFile semantics).
for (const file of ['.env.local', '.env']) {
  const envPath = path.join(root, file);
  if (existsSync(envPath)) process.loadEnvFile(envPath);
}
try {
  await stat(path.join(standalone, 'server.js'));
} catch {
  console.error('Run npm run build first.');
  process.exit(1);
}
// Only one process may stage files at a time: a second copy would delete and rewrite
// the very chunks and images a running server is serving (manifesting as 404s in the UI).
const lockFile = path.join(staging, 'stage.lock');
async function acquireStagingLock() {
  const deadline = Date.now() + 120000;
  for (;;) {
    try {
      const handle = await open(lockFile, 'wx');
      await handle.writeFile(String(process.pid));
      return async () => {
        await handle.close().catch(() => {});
        await rm(lockFile, { force: true });
      };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const info = await stat(lockFile).catch(() => null);
      if (!info) continue;
      if (Date.now() - info.mtimeMs > 180000) {
        await rm(lockFile, { force: true });
        continue;
      }
      if (Date.now() > deadline)
        throw new Error(
          'Boshqa jarayon fayllarni tayyorlamoqda. Birozdan so‘ng qayta urinib ko‘ring.',
        );
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
}
const release = await acquireStagingLock();
try {
  // force:false never deletes or rewrites files, so a server that is already serving
  // these paths keeps working while a new build is staged next to it.
  for (const [source, target] of [
    [path.join(root, '.next', 'static'), path.join(standalone, '.next', 'static')],
    [path.join(root, 'public'), path.join(standalone, 'public')],
    [path.join(root, 'seeds'), path.join(standalone, 'seeds')],
  ]) {
    await mkdir(path.dirname(target), { recursive: true });
    await cp(source, target, { recursive: true, force: false });
  }
} finally {
  await release();
}
const port = Number(process.env.PORT || 3000);
const child = spawn(process.execPath, ['server.js'], {
  cwd: standalone,
  stdio: 'inherit',
  env: {
    ...process.env,
    HOSTNAME: process.env.HOSTNAME || '0.0.0.0',
    PORT: String(port),
  },
});
// Report the data-store status once, so a broken DATA_DIR is visible immediately.
async function healthCheck(attempt = 0) {
  if (child.exitCode !== null) return;
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
      signal: AbortSignal.timeout(4000),
    });
    const body = await response.json().catch(() => null);
    if (response.ok) console.log(`[start-server] health ok: ${JSON.stringify(body)}`);
    else console.error(`[start-server] health ${response.status}: ${JSON.stringify(body)}`);
  } catch (error) {
    if (attempt < 20) return void setTimeout(() => healthCheck(attempt + 1), 500);
    console.error(`[start-server] health check failed: ${error.message}`);
  }
}
void healthCheck();
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => child.kill(signal));
child.on('exit', (code) => process.exit(code ?? 0));
child.on('error', (error) => {
  console.error(error.message);
  process.exit(1);
});
