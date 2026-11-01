import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { findProduct } from '../catalog';
import { ORDER_STATUSES, type Order, type OrderStatus } from '../format';
import { checkoutSchema } from '../validation';
import { getDb, transaction } from './db';
import { orderMessage } from './telegram';

type OrderRow = {
  id: string;
  number: string;
  customer_name: string;
  phone: string;
  total: number;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
  request_key: string;
  fingerprint: string;
};
type ItemRow = { product_id: string; name: string; quantity: number; unit_price: number };
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
function mapOrder(row: OrderRow): Order {
  const items = getDb()
    .prepare(
      'SELECT product_id, name, quantity, unit_price FROM order_items WHERE order_id = ? ORDER BY id',
    )
    .all(row.id) as unknown as ItemRow[];
  return {
    id: row.id,
    number: row.number,
    customerName: row.customer_name,
    phone: row.phone,
    total: row.total,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: items.map((i) => ({
      productId: i.product_id,
      name: i.name,
      quantity: i.quantity,
      unitPrice: i.unit_price,
    })),
  };
}
export function getOrder(id: string) {
  const row = getDb().prepare('SELECT * FROM orders WHERE id = ?').get(id) as unknown as
    | OrderRow
    | undefined;
  return row ? mapOrder(row) : null;
}
export function enqueueOrder(order: Order, kind: 'new' | 'status' | 'cancel', eventKey: string) {
  getDb()
    .prepare(
      'INSERT OR IGNORE INTO notification_outbox (order_id, event_key, kind, message, next_attempt_at, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .run(order.id, eventKey, kind, orderMessage(order, kind), Date.now(), Date.now());
}
export function createOrder(input: z.infer<typeof checkoutSchema>): {
  order: Order;
  reused: boolean;
} {
  const canonicalItems = [...input.items].sort((a, b) => a.productId.localeCompare(b.productId));
  const name = input.customerName.trim().replace(/\s+/g, ' ');
  const phone = '+998' + input.phone.replace(/\D/g, '').slice(3);
  const fingerprint = createHash('sha256')
    .update(JSON.stringify({ name, phone, items: canonicalItems }))
    .digest('hex');
  return transaction(() => {
    const db = getDb();
    const existing = db
      .prepare('SELECT * FROM orders WHERE request_key = ?')
      .get(input.requestId) as unknown as OrderRow | undefined;
    if (existing) {
      if (existing.fingerprint !== fingerprint)
        throw new ApiError(409, 'Buyurtma ma’lumotlari o‘zgargan. Savatingizni tekshiring.');
      return { order: mapOrder(existing), reused: true };
    }
    const items = canonicalItems.map((item) => {
      const product = findProduct(item.productId)!;
      return {
        productId: product.id,
        name: product.name,
        quantity: item.quantity,
        unitPrice: product.price,
      };
    });
    const total = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    if (!Number.isSafeInteger(total)) throw new ApiError(400, 'Buyurtma summasi noto‘g‘ri.');
    const id = randomUUID();
    const number =
      'ISH-' +
      new Date().toISOString().slice(0, 10).replaceAll('-', '') +
      '-' +
      randomBytes(4).toString('hex').toUpperCase();
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO orders (id, number, customer_name, phone, total, request_key, fingerprint, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(id, number, name, phone, total, input.requestId, fingerprint, now, now);
    const insert = db.prepare(
      'INSERT INTO order_items (order_id, product_id, name, unit_price, quantity) VALUES (?, ?, ?, ?, ?)',
    );
    for (const item of items)
      insert.run(id, item.productId, item.name, item.unitPrice, item.quantity);
    const order = mapOrder(
      db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as unknown as OrderRow,
    );
    enqueueOrder(order, 'new', `new:${id}`);
    return { order, reused: false };
  });
}
export function changeOrderStatus(id: string, status: OrderStatus, expectedStatus?: OrderStatus) {
  return transaction(() => {
    const db = getDb();
    const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as unknown as
      | OrderRow
      | undefined;
    if (!row) throw new ApiError(404, 'Buyurtma topilmadi.');
    if (row.status === status) return { order: mapOrder(row), changed: false };
    if (expectedStatus && row.status !== expectedStatus)
      throw new ApiError(409, 'Buyurtma holati o‘zgargan. Sahifani yangilang.');
    if (row.status === 'Bekor qilindi' || row.status === 'Yetkazildi')
      throw new ApiError(409, 'Yakunlangan buyurtma holatini o‘zgartirib bo‘lmaydi.');
    db.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?').run(
      status,
      new Date().toISOString(),
      id,
    );
    const order = mapOrder(
      db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as unknown as OrderRow,
    );
    enqueueOrder(
      order,
      status === 'Bekor qilindi' ? 'cancel' : 'status',
      `status:${id}:${randomUUID()}`,
    );
    return { order, changed: true };
  });
}
export function listOrders(
  options: { q?: string; status?: string; page?: number; limit?: number } = {},
) {
  const db = getDb();
  const q = (options.q || '').trim().slice(0, 100);
  const status = ORDER_STATUSES.includes(options.status as OrderStatus) ? options.status! : '';
  const limit = Math.min(50, Math.max(1, options.limit || 12));
  const page = Math.min(10000, Math.max(1, options.page || 1));
  const clauses: string[] = [];
  const params: (string | number)[] = [];
  if (q) {
    const escaped = q.replace(/[\\%_]/g, '\\$&');
    clauses.push(
      "(customer_name LIKE ? ESCAPE '\\' OR phone LIKE ? ESCAPE '\\' OR number LIKE ? ESCAPE '\\')",
    );
    params.push(`%${escaped}%`, `%${escaped}%`, `%${escaped}%`);
  }
  if (status) {
    clauses.push('status = ?');
    params.push(status);
  }
  const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';
  const count = db
    .prepare(`SELECT COUNT(*) AS count FROM orders ${where}`)
    .get(...params) as unknown as { count: number };
  const rows = db
    .prepare(`SELECT * FROM orders ${where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, (page - 1) * limit) as unknown as OrderRow[];
  const summary = db
    .prepare(
      `SELECT COUNT(*) AS total, COALESCE(SUM(status = 'Yangi'),0) AS new, COALESCE(SUM(status NOT IN ('Yangi','Yetkazildi','Bekor qilindi')),0) AS active, COALESCE(SUM(CASE WHEN status = 'Yetkazildi' THEN total ELSE 0 END),0) AS revenue FROM orders`,
    )
    .get() as Record<string, number>;
  return {
    orders: rows.map(mapOrder),
    total: count.count,
    page,
    limit,
    pages: Math.max(1, Math.ceil(count.count / limit)),
    summary,
  };
}
