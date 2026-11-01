import assert from 'node:assert/strict';
import { test } from 'node:test';
import { closePool, getPool, StorageError } from '../lib/server/db';

test('missing PostgreSQL configuration returns an actionable storage error', async () => {
  delete process.env.DATABASE_URL;
  delete process.env.POSTGRES_URL;
  await closePool();
  await assert.rejects(
    () => getPool(),
    (error: unknown) =>
      error instanceof StorageError &&
      error.code === 'STORAGE_CONFIG' &&
      error.message.includes('DATABASE_URL'),
  );
});

test('non-PostgreSQL connection strings are rejected', async () => {
  process.env.DATABASE_URL = 'https://example.com/database';
  await closePool();
  await assert.rejects(
    () => getPool(),
    (error: unknown) => error instanceof StorageError && error.code === 'STORAGE_CONFIG',
  );
  delete process.env.DATABASE_URL;
});
