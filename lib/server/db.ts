import { Pool, type PoolClient } from 'pg';

export class StorageError extends Error {
  constructor(
    message: string,
    public code: 'STORAGE_CONFIG' | 'STORAGE_CONNECT' = 'STORAGE_CONFIG',
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

const globalDb = globalThis as unknown as {
  ischiPool?: Pool;
  ischiPoolInit?: Promise<Pool>;
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  number TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  total BIGINT NOT NULL CHECK(total > 0),
  status TEXT NOT NULL DEFAULT 'Yangi' CHECK(status IN ('Yangi','Tasdiqlandi','Tayyorlanmoqda','Yetkazilmoqda','Yetkazildi','Bekor qilindi')),
  request_key TEXT NOT NULL UNIQUE,
  fingerprint TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  name TEXT NOT NULL,
  unit_price BIGINT NOT NULL CHECK(unit_price > 0),
  quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 20)
);
CREATE TABLE IF NOT EXISTS notification_outbox (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  event_key TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK(kind IN ('new','status','cancel')),
  message TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','sending','sent','uncertain','failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at BIGINT NOT NULL,
  locked_at BIGINT,
  created_at BIGINT NOT NULL,
  delivered_at BIGINT,
  last_error TEXT
);
CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  expires_at BIGINT NOT NULL,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS outbox_delivery ON notification_outbox(state, next_attempt_at);
CREATE INDEX IF NOT EXISTS sessions_expiry ON admin_sessions(expires_at);
`;

function poolConfig() {
  const connectionString = process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim();
  if (!connectionString) {
    throw new StorageError(
      'Buyurtmalar bazasi sozlanmagan. Vercel Environment Variables bo‘limiga DATABASE_URL (PostgreSQL) qiymatini qo‘shing va qayta deploy qiling.',
    );
  }

  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new StorageError('DATABASE_URL noto‘g‘ri. PostgreSQL ulanish manzilini tekshiring.');
  }
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    throw new StorageError(
      'DATABASE_URL PostgreSQL manzili bo‘lishi kerak (postgres:// yoki postgresql://).',
    );
  }

  const sslMode = url.searchParams.get('sslmode');
  const localHost = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  const ssl =
    sslMode === 'disable' || (localHost && !sslMode)
      ? false
      : sslMode === 'no-verify'
        ? { rejectUnauthorized: false }
        : { rejectUnauthorized: true };

  const requestedMax = Number(process.env.DATABASE_POOL_MAX || 5);
  const max = Number.isFinite(requestedMax)
    ? Math.min(20, Math.max(1, Math.trunc(requestedMax)))
    : 5;

  return {
    connectionString,
    ssl,
    max,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 10_000,
    query_timeout: 10_000,
    application_name: 'ischi-bot',
  };
}

export async function getPool(): Promise<Pool> {
  if (globalDb.ischiPool) return globalDb.ischiPool;
  if (globalDb.ischiPoolInit) return globalDb.ischiPoolInit;

  const init = (async () => {
    const pool = new Pool(poolConfig());
    pool.on('error', () => {
      // Idle connection errors must not crash the process or expose credentials.
    });

    let client: PoolClient | undefined;
    try {
      client = await pool.connect();
      await client.query('BEGIN');
      // Serialize first-run schema creation across serverless instances.
      await client.query('SELECT pg_advisory_xact_lock(742108)');
      await client.query(SCHEMA);
      await client.query('COMMIT');
      globalDb.ischiPool = pool;
      return pool;
    } catch (error) {
      if (client) {
        try {
          await client.query('ROLLBACK');
        } catch {
          // The connection may already be closed.
        }
        client.release();
        client = undefined;
      }
      await pool.end().catch(() => undefined);
      if (error instanceof StorageError) throw error;
      throw new StorageError(
        'Buyurtmalar bazasiga ulanib bo‘lmadi. DATABASE_URL va PostgreSQL server sozlamalarini tekshiring.',
        'STORAGE_CONNECT',
      );
    } finally {
      client?.release();
    }
  })();

  globalDb.ischiPoolInit = init.finally(() => {
    globalDb.ischiPoolInit = undefined;
  });
  return globalDb.ischiPoolInit;
}

export async function closePool() {
  const pool = globalDb.ischiPool;
  globalDb.ischiPool = undefined;
  if (pool) await pool.end();
}

export type DbExecutor = Pool | PoolClient;
export type DbParams = unknown[];

// The data layer uses question-mark placeholders internally; PostgreSQL needs $1, $2, ...
function toPostgresPlaceholders(sql: string) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

export async function dbGet<T>(
  sql: string,
  args: DbParams = [],
  executor?: DbExecutor,
): Promise<T | undefined> {
  const db = executor ?? (await getPool());
  const result = await db.query(toPostgresPlaceholders(sql), args);
  return result.rows[0] as T | undefined;
}

export async function dbAll<T>(
  sql: string,
  args: DbParams = [],
  executor?: DbExecutor,
): Promise<T[]> {
  const db = executor ?? (await getPool());
  const result = await db.query(toPostgresPlaceholders(sql), args);
  return result.rows as T[];
}

export async function dbRun(sql: string, args: DbParams = [], executor?: DbExecutor) {
  const db = executor ?? (await getPool());
  const result = await db.query(toPostgresPlaceholders(sql), args);
  return { changes: result.rowCount ?? 0 };
}

export async function withTransaction<T>(fn: (tx: PoolClient) => Promise<T>): Promise<T> {
  const pool = await getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // The transaction may already be closed by the server.
    }
    throw error;
  } finally {
    client.release();
  }
}
