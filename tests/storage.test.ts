import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, rename, readdir, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { temporaryStore } from './helpers';
import {
  dataRoot,
  listBackups,
  readStore,
  receiptToken,
  restoreBackup,
  withStore,
} from '../lib/server/storage';
let store: Awaited<ReturnType<typeof temporaryStore>>;
before(async () => {
  store = await temporaryStore();
});
after(async () => {
  await store.cleanup();
});
test('seeds 22 categories and 22 explicitly demo products, without invented contacts', async () => {
  const categories = await readStore('categories'),
    products = await readStore('products'),
    settings = await readStore('settings');
  assert.equal(categories.length, 22);
  assert.equal(categories.filter((x) => x.group === 'metal').length, 13);
  assert.equal(categories.filter((x) => x.group === 'construction').length, 9);
  assert.equal(products.length, 22);
  assert.ok(products.every((x) => x.demo));
  assert.deepEqual(settings.phones, []);
  assert.equal(settings.whatsapp, '');
  assert.deepEqual(settings.testimonials, []);
});
test('concurrent writes are serialized without lost updates or malformed JSON', async () => {
  await Promise.all(
    Array.from({ length: 30 }, (_, i) =>
      withStore(
        (data) => {
          data.settings.announcement.uz = `yozuv-${i}`;
        },
        ['settings'],
      ),
    ),
  );
  const files = await readdir(dataRoot());
  for (const file of files.filter((x) => x.endsWith('.json')))
    JSON.parse(await readFile(path.join(dataRoot(), file), 'utf8'));
  assert.match((await readStore('settings')).announcement.uz, /^yozuv-/);
  assert.equal((await readdir(path.join(dataRoot(), '.journals'))).length, 0);
});
test('multi-file journal recovers an interrupted order transaction', async () => {
  const products = await readStore('products'),
    product = products[0];
  const id = randomUUID();
  const changedProducts = structuredClone(products);
  changedProducts[0].stock = 777;
  await writeFile(
    path.join(dataRoot(), '.journals', id + '.json'),
    JSON.stringify({ id, changes: [{ name: 'products', revision: 99, data: changedProducts }] }),
  );
  assert.equal((await readStore('products')).find((x) => x.id === product.id)?.stock, 777);
  assert.ok(!(await readdir(path.join(dataRoot(), '.journals'))).includes(id + '.json'));
});
test('corrupt JSON is never silently replaced by seed data', async () => {
  const file = path.join(dataRoot(), 'products.json');
  const original = await readFile(file);
  await writeFile(file, '{broken');
  await assert.rejects(readStore('products'), /buzilgan/);
  await writeFile(file, original);
  assert.equal((await readStore('products')).length, 22);
});
test('missing initialized data file fails closed instead of erasing history', async () => {
  const file = path.join(dataRoot(), 'orders.json'),
    saved = path.join(dataRoot(), 'orders.saved');
  await rename(file, saved);
  await assert.rejects(readStore('orders'), /DATA_FILE_MISSING|topilmadi/);
  await rename(saved, file);
  assert.deepEqual(await readStore('orders'), []);
});
test('backups are bounded and restore validates relations', async () => {
  for (let i = 0; i < 43; i++)
    await withStore(
      (data) => {
        data.settings.announcement.uz = `backup-${i}`;
      },
      ['settings'],
    );
  const backups = await listBackups();
  assert.equal(backups.length, 40);
  const latest = backups[0];
  await restoreBackup(latest.id);
  assert.match((await readStore('settings')).announcement.uz, /^backup-/);
  await assert.rejects(restoreBackup('../../public'));
});
test('receipt token is stable and order-specific', async () => {
  const a = randomUUID(),
    b = randomUUID();
  assert.equal(await receiptToken(a), await receiptToken(a));
  assert.notEqual(await receiptToken(a), await receiptToken(b));
});
test('public and build directories are rejected', () => {
  const previous = process.env.DATA_DIR;
  try {
    process.env.DATA_DIR = path.resolve('public/images');
    assert.throws(dataRoot);
    process.env.DATA_DIR = path.resolve('.next/data');
    assert.throws(dataRoot);
  } finally {
    process.env.DATA_DIR = previous;
  }
});
test('serverless hosts are explicitly refused', () => {
  const previous = process.env.VERCEL;
  try {
    process.env.VERCEL = '1';
    assert.throws(dataRoot, /PERSISTENT_DISK_REQUIRED|doimiy/);
  } finally {
    if (previous === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = previous;
  }
});
