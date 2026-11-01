import { createClient, type Client, type InValue, type Transaction } from '@libsql/client';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

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
  ischiClient?: Client;
  ischiClientInit?: Promise<Client>;
};

export function isRemoteStorage() {
  return Boolean(process.env.TURSO_DATABASE_URL?.trim());
}

function isServerless() {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY);
}

function localDatabaseUrl() {
  const filename = process.env.DATABASE_PATH || '.data/orders.sqlite';
  if (filename === ':memory:') return 'file::memory:';
  const absolute = path.resolve(/* turbopackIgnore: true */ filename);
  mkdirSync(path.dirname(absolute), { recursive: true });
  return pathToFileURL(absolute).href;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  number TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  total INTEGER NOT NULL CHECK(total > 0),
  status TEXT NOT NULL DEFAULT 'Yangi' CHECK(status IN ('Yangi','Tasdiqlandi','Tayyorlanmoqda','Yetkazilmoqda','Yetkazildi','Bekor qilindi')),
  request_key TEXT NOT NULL UNIQUE,
  fingerprint TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  name TEXT NOT NULL,
  unit_price INTEGER NOT NULL CHECK(unit_price > 0),
  quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 20)
);
CREATE TABLE IF NOT EXISTS notification_outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  event_key TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK(kind IN ('new','status','cancel')),
  message TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','sending','sent','uncertain','failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL,
  locked_at INTEGER,
  created_at INTEGER NOT NULL,
  delivered_at INTEGER,
  last_error TEXT
);
CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS outbox_delivery ON notification_outbox(state, next_attempt_at);
CREATE INDEX IF NOT EXISTS sessions_expiry ON admin_sessions(expires_at);
`;

export async function getClient(): Promise<Client> {
  if (globalDb.ischiClient) return globalDb.ischiClient;
  if (globalDb.ischiClientInit) return globalDb.ischiClientInit;

  const init = (async () => {
    const remoteUrl = process.env.TURSO_DATABASE_URL?.trim();
    const remoteToken = process.env.TURSO_AUTH_TOKEN?.trim();
    if (!remoteUrl && isServerless()) {
      throw new StorageError(
        'Buyurtmalar bazasi sozlanmagan. Vercel uchun TURSO_DATABASE_URL va TURSO_AUTH_TOKEN qiymatlarini o‘rnating, so‘ng qayta deploy qiling.',
      );
    }
    if (remoteUrl && !remoteToken) {
      throw new StorageError(
        'TURSO_AUTH_TOKEN kiritilmagan. Turso database tokenini server sozlamalariga qo‘shing.',
      );
    }

    let client: Client;
    try {
      client = createClient({
        url: remoteUrl || localDatabaseUrl(),
        authToken: remoteUrl ? remoteToken : undefined,
        intMode: 'number',
        timeout: 5000,
      });
    } catch {
      throw new StorageError(
        'Buyurtmalar bazasini ochib bo‘lmadi. DATABASE_PATH yoki Turso sozlamalarini tekshiring.',
      );
    }

    try {
      if (!remoteUrl) {
        await client.execute('PRAGMA foreign_keys = ON');
        await client.execute('PRAGMA journal_mode = WAL');
      }
      await client.executeMultiple(SCHEMA);
      // A cold start must never blindly resend an in-flight Telegram message.
      await client.execute(
        "UPDATE notification_outbox SET state = 'uncertain', last_error = 'Telegram javobi noaniq. Takroriy xabarni oldini olish uchun tekshiruv kutilmoqda.' WHERE state = 'sending'",
      );
      globalDb.ischiClient = client;
      return client;
    } catch (error) {
      client.close();
      if (error instanceof StorageError) throw error;
      throw new StorageError(
        'Buyurtmalar bazasiga ulanib bo‘lmadi. Turso URL/token yoki DATABASE_PATH ni tekshiring.',
        'STORAGE_CONNECT',
      );
    }
  })();

  globalDb.ischiClientInit = init.finally(() => {
    globalDb.ischiClientInit = undefined;
  });
  return globalDb.ischiClientInit;
}

export type DbExecutor = Client | Transaction;
export type DbParams = InValue[];

export async function dbGet<T>(
  sql: string,
  args: DbParams = [],
  executor?: DbExecutor,
): Promise<T | undefined> {
  const db = executor ?? (await getClient());
  const result = await db.execute({ sql, args });
  return result.rows[0] as unknown as T | undefined;
}

export async function dbAll<T>(
  sql: string,
  args: DbParams = [],
  executor?: DbExecutor,
): Promise<T[]> {
  const db = executor ?? (await getClient());
  const result = await db.execute({ sql, args });
  return result.rows as unknown as T[];
}

export async function dbRun(sql: string, args: DbParams = [], executor?: DbExecutor) {
  const db = executor ?? (await getClient());
  const result = await db.execute({ sql, args });
  return { changes: Number(result.rowsAffected) };
}

export async function withTransaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
  const db = await getClient();
  const tx = await db.transaction('write');
  try {
    const result = await fn(tx);
    await tx.commit();
    return result;
  } catch (error) {
    try {
      await tx.rollback();
    } catch {
      // The transaction may already be closed by the server.
    }
    throw error;
  } finally {
    tx.close();
  }
}
