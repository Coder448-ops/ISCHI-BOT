import { PGlite } from '@electric-sql/pglite';
import type { AddressInfo } from 'node:net';
import { createServer, LogLevel } from 'pglite-server';
import { closePool } from '../../lib/server/db';

// Tests run against PostgreSQL syntax via PGlite's wire protocol, without an external service.
export async function setupTestDatabase() {
  const db = new PGlite();
  await db.waitReady;
  const server = createServer(db, { logLevel: LogLevel.Error });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const { port } = server.address() as AddressInfo;
  process.env.DATABASE_URL = `postgresql://postgres@127.0.0.1:${port}/postgres?sslmode=disable`;
  process.env.DATABASE_POOL_MAX = '1';

  return async () => {
    await closePool();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await db.close();
  };
}
