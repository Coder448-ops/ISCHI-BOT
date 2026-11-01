import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { checkoutSchema } from '../lib/server/schemas';
import { readStore, withStore } from '../lib/server/storage';
export async function temporaryStore() {
  const directory = await mkdtemp(path.join(tmpdir(), 'ischi-test-'));
  process.env.DATA_DIR = directory;
  delete process.env.TELEGRAM_BOT_TOKEN;
  await readStore('settings');
  return { directory, cleanup: () => rm(directory, { recursive: true, force: true }) };
}
export async function input(
  productId?: string,
  quantity?: number,
  expectedTotal?: number,
  couponCode?: string,
) {
  const products = await readStore('products');
  const product =
    products.find((p) => p.id === productId) || products.find((p) => p.stock >= p.minOrder)!;
  quantity ??= product.minOrder;
  return checkoutSchema.parse({
    customerName: 'Test Mijoz',
    phone: '+998 90 123 45 67',
    items: [{ productId: product.id, quantity }],
    expectedTotal: expectedTotal ?? Math.round((product.discountPrice ?? product.price) * quantity),
    requestId: randomUUID(),
    ...(couponCode ? { couponCode } : {}),
  });
}
export async function resetProduct(id: string, stock = 1000) {
  await withStore(
    (data) => {
      const p = data.products.find((x) => x.id === id)!;
      p.stock = stock;
      p.enabled = true;
      p.minOrder = 1;
      p.step = 1;
    },
    ['products'],
  );
}
