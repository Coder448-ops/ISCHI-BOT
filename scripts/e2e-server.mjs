import { spawn } from 'node:child_process';
import { PGlite } from '@electric-sql/pglite';
import { createServer, LogLevel } from 'pglite-server';

const db = new PGlite();
await db.waitReady;
const server = createServer(db, { logLevel: LogLevel.Error });
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const { port } = server.address();
const databaseUrl = `postgresql://postgres@127.0.0.1:${port}/postgres?sslmode=disable`;

const child = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'start', '--hostname', '0.0.0.0', '--port', '3001'],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      POSTGRES_URL: '',
      DATABASE_POOL_MAX: '1',
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
);

let shuttingDown = false;
async function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (!child.killed) child.kill('SIGTERM');
  await new Promise((resolve) => server.close(resolve));
  await db.close();
  process.exit(code);
}

child.on('exit', (code) => void shutdown(code ?? 0));
child.on('error', () => void shutdown(1));
process.on('SIGINT', () => void shutdown(0));
process.on('SIGTERM', () => void shutdown(0));
