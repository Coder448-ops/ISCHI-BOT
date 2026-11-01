import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const globalDb = globalThis as unknown as { ischiDb?: DatabaseSync };
export function getDb(): DatabaseSync {
  if (globalDb.ischiDb) return globalDb.ischiDb;
  const filename = process.env.DATABASE_PATH || '.data/orders.sqlite';
  if (filename !== ':memory:')
    mkdirSync(path.dirname(path.resolve(/* turbopackIgnore: true */ filename)), {
      recursive: true,
    });
  const db = new DatabaseSync(filename);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
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
  `);
  // A process restart must never cause an accepted message to be sent again.
  db.exec(
    "UPDATE notification_outbox SET state = 'uncertain', last_error = 'Telegram javobi noaniq. Takroriy xabarni oldini olish uchun tekshiruv kutilmoqda.' WHERE state = 'sending'",
  );
  globalDb.ischiDb = db;
  return db;
}
export function transaction<T>(fn: () => T): T {
  const db = getDb();
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
