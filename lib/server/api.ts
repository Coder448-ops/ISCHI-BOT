import { randomUUID } from 'node:crypto';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { NextRequest, NextResponse, after } from 'next/server';
import sharp from 'sharp';
import { z } from 'zod';
import { ORDER_STATUSES, type Product, type OrderStatus } from '../types';
import {
  categorySchema,
  checkoutSchema,
  couponSchema,
  productSchema,
  settingsSchema,
  supportInputSchema,
  storeSchemas,
  type StoreName,
} from './schemas';
import {
  ApiError,
  dataRoot,
  listBackups,
  readStore,
  restoreBackup,
  safeStorageError,
  StorageError,
  withStore,
} from './storage';
import {
  adminConfigured,
  allowedOrigin,
  assertOrigin,
  createSession,
  deleteSession,
  rateLimit,
  requireAdmin,
  SESSION_COOKIE,
  verifyCredentials,
} from './security';
import {
  adminOverview,
  calculateQuote,
  changeOrderStatus,
  createOrder,
  getBootstrap,
  getReceiptOrder,
  publicOrder,
  queryCatalog,
  type CatalogQuery,
} from './commerce';
import { flushNotifications, notificationSummary } from './notifications';
import { telegramConfig, verifyTelegram } from './telegram';

const json = (data: unknown, status = 200, request?: NextRequest) => {
  const headers = new Headers({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  if (request) {
    const { origin, allowed } = allowedOrigin(
      request,
      request.nextUrl.pathname.startsWith('/api/admin/'),
    );
    if (origin && allowed) {
      headers.set('Access-Control-Allow-Origin', origin);
      headers.set('Vary', 'Origin');
    }
  }
  return NextResponse.json(data, { status, headers });
};
async function readBodyBytes(request: NextRequest, max: number) {
  if (Number(request.headers.get('content-length') || 0) > max)
    throw new ApiError(413, 'So‘rov hajmi juda katta.');
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, 'So‘rov bo‘sh.');
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel();
      throw new ApiError(413, 'So‘rov hajmi juda katta.');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
async function body(request: NextRequest, max = 65536) {
  if (!request.headers.get('content-type')?.includes('application/json'))
    throw new ApiError(415, 'JSON formatida so‘rov yuboring.');
  try {
    return JSON.parse((await readBodyBytes(request, max)).toString('utf8')) as unknown;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, 'JSON ma’lumot noto‘g‘ri.');
  }
}
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new ApiError(
      400,
      result.error.issues[0]?.message || 'Ma’lumotlarni tekshiring.',
      String(result.error.issues[0]?.path[0] || ''),
    );
  return result.data;
}
function catalogQuery(request: NextRequest): CatalogQuery {
  const params = request.nextUrl.searchParams;
  const query: CatalogQuery = {
    q: params.get('q') || '',
    category: params.get('category') || '',
    availability: params.get('availability') || '',
    material: params.get('material') || '',
    sort: params.get('sort') || 'newest',
    page: Number(params.get('page')) || 1,
    limit: Number(params.get('limit')) || 12,
  };
  for (const key of [
    'minPrice',
    'maxPrice',
    'thicknessMin',
    'thicknessMax',
    'lengthMin',
    'lengthMax',
    'diameterMin',
    'diameterMax',
  ] as const) {
    const raw = params.get(key);
    if (raw !== null && raw !== '') {
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 0) throw new ApiError(400, 'Filtr qiymati noto‘g‘ri.');
      query[key] = value;
    }
  }
  if (params.get('ids')) query.ids = params.get('ids')!.split(',').slice(0, 100);
  return query;
}
function idSegment(value: string) {
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(value)) throw new ApiError(400, 'Identifikator noto‘g‘ri.');
  return value;
}
function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 65) || randomUUID().slice(0, 8)
  );
}
async function upload(request: NextRequest) {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.startsWith('multipart/form-data'))
    throw new ApiError(415, 'Rasmni multipart/form-data formatida yuboring.');
  const bytes = await readBodyBytes(request, 5 * 1024 * 1024 + 65536);
  const form = await new Response(new Uint8Array(bytes), {
    headers: { 'Content-Type': contentType },
  }).formData();
  const file = form.get('file');
  if (!(file instanceof File) || file.size > 5 * 1024 * 1024)
    throw new ApiError(400, 'Rasm 5 MB dan kichik bo‘lsin.');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new ApiError(400, 'Faqat JPG, PNG yoki WebP qabul qilinadi.');
  const input = Buffer.from(await file.arrayBuffer());
  let output: Buffer;
  try {
    const image = sharp(input, { limitInputPixels: 24000000, animated: false });
    const metadata = await image.metadata();
    if (
      !['jpeg', 'png', 'webp'].includes(metadata.format || '') ||
      !metadata.width ||
      !metadata.height
    )
      throw new Error('format');
    output = await image
      .rotate()
      .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    throw new ApiError(400, 'Rasm faylini o‘qib bo‘lmadi.');
  }
  const filename = `${randomUUID()}.webp`;
  const target = path.join(dataRoot(), 'uploads', filename);
  await writeFile(target, output, { mode: 0o600, flag: 'wx' });
  return { url: `/api/media/${filename}` };
}
async function adminApi(request: NextRequest, parts: string[]) {
  const method = request.method;
  const [resource, id] = parts;
  if (resource === 'login' && method === 'POST') {
    rateLimit(request, 'admin-login', 8, 900000);
    const credentials = parse(
      z.object({ username: z.string().max(100), password: z.string().max(256) }).strict(),
      await body(request),
    );
    if (!adminConfigured())
      throw new ApiError(
        503,
        'Administrator kirishi sozlanmagan. Serverga kuchli parol o‘rnating.',
      );
    if (!verifyCredentials(credentials.username, credentials.password))
      throw new ApiError(401, 'Login yoki parol noto‘g‘ri.');
    const secure =
      request.nextUrl.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https';
    const session = await createSession(credentials.username, secure);
    const response = json({ ok: true }, 200, request);
    response.cookies.set(SESSION_COOKIE, session.token, session.options);
    return response;
  }
  await requireAdmin(request);
  if (method !== 'GET') rateLimit(request, 'admin-write', 120, 60000);
  if (resource === 'session' && method === 'GET')
    return json({ ok: true, username: process.env.ADMIN_USERNAME || 'admin' }, 200, request);
  if (resource === 'logout' && method === 'POST') {
    await deleteSession(request.cookies.get(SESSION_COOKIE)?.value);
    const response = json({ ok: true }, 200, request);
    response.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
    return response;
  }
  if (resource === 'overview' && method === 'GET')
    return json(await withStore((data) => adminOverview(data)), 200, request);
  if (resource === 'uploads' && method === 'POST') return json(await upload(request), 201, request);
  if (resource === 'telegram' && method === 'POST') {
    const action = parse(
      z.object({ action: z.enum(['verify', 'test']) }).strict(),
      await body(request),
    ).action;
    try {
      if (action === 'verify') return json(await verifyTelegram(), 200, request);
      const { sendOrderMessage } = await import('./telegram');
      const result = await sendOrderMessage(
        '✅ ISCHI bot ulanishi tekshirildi. Buyurtma xabarlari shu chatga yuboriladi.',
      );
      if (result.kind !== 'sent') throw new Error(result.error || 'Bot sozlanmagan.');
      return json({ ok: true }, 200, request);
    } catch (error) {
      throw new ApiError(
        400,
        error instanceof Error ? error.message : 'Telegram ulanishini tekshirib bo‘lmadi.',
      );
    }
  }
  if (resource === 'notifications') {
    if (method === 'GET')
      return json(
        {
          events: [...(await readStore('notifications'))].reverse().slice(0, 100),
          summary: await notificationSummary(),
        },
        200,
        request,
      );
    if (method === 'POST') {
      const input = parse(
        z.discriminatedUnion('action', [
          z.object({ action: z.literal('retry') }).strict(),
          z.object({ action: z.literal('flush') }).strict(),
          z
            .object({
              action: z.literal('resolve'),
              id: z.string().max(180),
              resolution: z.enum(['confirmed', 'resend']),
            })
            .strict(),
        ]),
        await body(request),
      );
      await withStore(
        (data) => {
          if (input.action === 'retry')
            for (const n of data.notifications)
              if (n.state === 'failed' || (n.state === 'pending' && n.error)) {
                n.state = 'pending';
                n.nextAttemptAt = 0;
                n.error = null;
              }
          if (input.action === 'resolve') {
            const n = data.notifications.find((x) => x.id === input.id);
            if (!n || n.state !== 'uncertain') throw new ApiError(409, 'Xabar holati o‘zgargan.');
            n.state = input.resolution === 'confirmed' ? 'sent' : 'pending';
            n.deliveredAt = input.resolution === 'confirmed' ? Date.now() : null;
            n.nextAttemptAt = 0;
            n.lockedAt = null;
            n.error = 'Administrator tomonidan tekshirildi.';
          }
        },
        ['notifications'],
      );
      after(() => flushNotifications());
      return json({ ok: true }, 200, request);
    }
  }
  if (resource === 'backups') {
    if (method === 'GET') return json(await listBackups(), 200, request);
    if (method === 'POST') {
      const input = parse(z.object({ id: z.string().uuid() }).strict(), await body(request));
      await restoreBackup(input.id);
      return json({ ok: true }, 200, request);
    }
  }
  if (resource === 'orders') {
    if (method === 'GET' && !id)
      return json(
        await withStore((data) => {
          const params = request.nextUrl.searchParams;
          const q = (params.get('q') || '').toLowerCase().slice(0, 100);
          const status = params.get('status');
          const from = params.get('from');
          const to = params.get('to');
          if ((from && Number.isNaN(Date.parse(from))) || (to && Number.isNaN(Date.parse(to))))
            throw new ApiError(400, 'Sana noto‘g‘ri.');
          const orders = [...data.orders]
            .reverse()
            .filter(
              (o) =>
                (!q || [o.number, o.customerName, o.phone].join(' ').toLowerCase().includes(q)) &&
                (!status || o.status === status) &&
                (!from || o.createdAt >= new Date(from).toISOString()) &&
                (!to || o.createdAt <= new Date(to + 'T23:59:59.999Z').toISOString()),
            );
          const page = Math.max(1, Number(params.get('page')) || 1);
          const limit = 20;
          return {
            orders: orders.slice((page - 1) * limit, page * limit),
            total: orders.length,
            page,
            pages: Math.max(1, Math.ceil(orders.length / limit)),
          };
        }),
        200,
        request,
      );
    if (method === 'PATCH' && id) {
      const input = parse(
        z
          .object({
            status: z.enum(ORDER_STATUSES),
            expectedStatus: z.enum(ORDER_STATUSES).optional(),
          })
          .strict(),
        await body(request),
      );
      const result = await changeOrderStatus(id, input.status, input.expectedStatus);
      if (result.changed) after(() => flushNotifications());
      return json(result, 200, request);
    }
  }
  if (resource === 'support') {
    if (method === 'GET') return json([...(await readStore('support'))].reverse(), 200, request);
    if (method === 'PATCH' && id) {
      const input = parse(z.object({ resolved: z.boolean() }).strict(), await body(request));
      await withStore(
        (data) => {
          const message = data.support.find((s) => s.id === id);
          if (!message) throw new ApiError(404, 'Xabar topilmadi.');
          message.resolved = input.resolved;
        },
        ['support'],
      );
      return json({ ok: true }, 200, request);
    }
  }
  if (['products', 'categories', 'coupons'].includes(resource)) {
    const name = resource as 'products' | 'categories' | 'coupons';
    if (method === 'GET') {
      const items = await readStore(name);
      if (id) {
        const item = items.find((x) => x.id === id);
        if (!item) throw new ApiError(404, 'Topilmadi.');
        return json(item, 200, request);
      }
      return json(items, 200, request);
    }
    if (method === 'DELETE' && id) {
      idSegment(id);
      await withStore(
        (data) => {
          if (name === 'categories' && data.products.some((p) => p.categoryId === id))
            throw new ApiError(409, 'Avval kategoriyadagi mahsulotlarni ko‘chiring.');
          const index = data[name].findIndex((x) => x.id === id);
          if (index < 0) throw new ApiError(404, 'Topilmadi.');
          data[name].splice(index, 1);
          if (name === 'products')
            for (const p of data.products) p.relatedIds = p.relatedIds.filter((x) => x !== id);
        },
        ['products', 'categories', 'coupons'],
      );
      return json({ ok: true }, 200, request);
    }
    if (method === 'POST' || method === 'PATCH') {
      const input = await body(request);
      const result = await withStore(
        (data) => {
          const list = data[name] as { id: string }[];
          const existing = id ? list.find((x) => x.id === id) : undefined;
          if (id && !existing) throw new ApiError(404, 'Topilmadi.');
          let item: { id: string };
          const now = new Date().toISOString();
          if (name === 'products') {
            const raw = input as Partial<Product>;
            item = parse(productSchema, {
              ...raw,
              id: existing?.id || slugify(String(raw.code || raw.name?.uz || '')),
              createdAt: (existing as Product | undefined)?.createdAt || now,
              updatedAt: now,
              demo:
                typeof raw.demo === 'boolean'
                  ? raw.demo
                  : (existing as Product | undefined)?.demo || false,
            });
          } else if (name === 'categories') {
            const raw = input as { name?: { uz?: string } };
            item = parse(categorySchema, {
              ...(input as object),
              id: existing?.id || slugify(raw.name?.uz || ''),
            });
          } else {
            const raw = {
              ...(input as object),
              code: String((input as { code?: string }).code || '').toUpperCase(),
            };
            item = parse(couponSchema, {
              ...raw,
              id: existing?.id || slugify((raw as { code: string }).code),
              usedCount: (existing as { usedCount?: number } | undefined)?.usedCount || 0,
              createdAt: (existing as { createdAt?: string } | undefined)?.createdAt || now,
            });
          }
          if (existing) Object.assign(existing, item);
          else list.push(item);
          return item;
        },
        ['products', 'categories', 'coupons'],
      );
      return json(result, method === 'POST' ? 201 : 200, request);
    }
  }
  if (resource === 'settings') {
    if (method === 'GET')
      return json(
        {
          settings: await readStore('settings'),
          telegramConfigured: Boolean(telegramConfig()),
          recipient: telegramConfig()?.chatId || '@Navroz0909',
        },
        200,
        request,
      );
    if (method === 'PATCH') {
      const settings = parse(settingsSchema, await body(request));
      await withStore(
        (data) => {
          data.settings = settings;
        },
        ['settings'],
      );
      return json({ ok: true }, 200, request);
    }
  }
  throw new ApiError(404, 'API manzili topilmadi.');
}
export async function handleApi(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path: parts } = await context.params;
  try {
    const admin = parts[0] === 'admin';
    if (request.method === 'OPTIONS') {
      const { origin, allowed } = allowedOrigin(request, admin);
      if (!allowed || admin) throw new ApiError(403, 'So‘rov manbasi rad etildi.');
      const response = new NextResponse(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': origin || '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-Order-Token',
          'Access-Control-Max-Age': '600',
          Vary: 'Origin',
        },
      });
      return response;
    }
    if (request.method !== 'GET') assertOrigin(request, admin);
    if (admin) return await adminApi(request, parts.slice(1));
    const [resource, id] = parts;
    if (resource === 'health' && request.method === 'GET') {
      await readStore('settings');
      return json(
        {
          ok: true,
          storage: 'json-files',
          persistence: 'host-managed disk; verify across redeployments',
          telegramConfigured: Boolean(telegramConfig()),
          adminConfigured: adminConfigured(),
        },
        200,
        request,
      );
    }
    if (resource === 'media' && request.method === 'GET') {
      if (!id || !/^[a-f0-9-]{36}\.webp$/.test(id)) throw new ApiError(404, 'Rasm topilmadi.');
      await readStore('settings');
      try {
        const buffer = await readFile(path.join(dataRoot(), 'uploads', id));
        return new NextResponse(new Uint8Array(buffer), {
          headers: {
            'Content-Type': 'image/webp',
            'Cache-Control': 'public, max-age=31536000, immutable',
            'X-Content-Type-Options': 'nosniff',
          },
        });
      } catch {
        throw new ApiError(404, 'Rasm topilmadi.');
      }
    }
    if (resource === 'bootstrap' && request.method === 'GET')
      return json(await getBootstrap(), 200, request);
    if (resource === 'products' && request.method === 'GET') {
      const result = await withStore((data) => {
        if (id) {
          const product = data.products.find(
            (p) =>
              p.id === id &&
              p.enabled &&
              data.categories.some((c) => c.id === p.categoryId && c.enabled),
          );
          if (!product) throw new ApiError(404, 'Mahsulot topilmadi.');
          return {
            product,
            related: data.products.filter((p) => product.relatedIds.includes(p.id) && p.enabled),
          };
        }
        return queryCatalog(data.products, data.categories, data.orders, catalogQuery(request));
      });
      return json(result, 200, request);
    }
    if (resource === 'quote' && request.method === 'POST') {
      rateLimit(request, 'quote', 100);
      const input = parse(
        z
          .object({ items: checkoutSchema.shape.items, couponCode: z.string().max(40).optional() })
          .strict(),
        await body(request),
      );
      return json(
        await withStore((data) => calculateQuote(data, input.items, input.couponCode)),
        200,
        request,
      );
    }
    if (resource === 'orders' && request.method === 'POST') {
      rateLimit(request, 'orders', 20);
      const input = parse(checkoutSchema, await body(request));
      const result = await createOrder(input);
      after(() => flushNotifications());
      return json(result, 201, request);
    }
    if (resource === 'orders' && id && request.method === 'GET')
      return json(
        await getReceiptOrder(id, request.headers.get('x-order-token') || ''),
        200,
        request,
      );
    if (resource === 'support' && request.method === 'POST') {
      rateLimit(request, 'support', 5);
      const input = parse(supportInputSchema, await body(request));
      await withStore(
        (data) => {
          data.support.push({
            id: randomUUID(),
            name: input.name,
            phone: '+' + input.phone,
            message: input.message,
            createdAt: new Date().toISOString(),
            resolved: false,
          });
        },
        ['support'],
      );
      return json({ ok: true }, 201, request);
    }
    throw new ApiError(404, 'API manzili topilmadi.');
  } catch (error) {
    if (error instanceof ApiError)
      return json({ error: error.message, field: error.field }, error.status, request);
    if (error instanceof StorageError)
      return json({ error: error.message, code: error.code }, 503, request);
    const reference = randomUUID().slice(0, 8).toUpperCase();
    console.error(
      `[ISCHI] request failed reference=${reference} type=${error instanceof Error ? error.name : typeof error}`,
    );
    return json(
      {
        error: `Texnik xatolik yuz berdi. Birozdan so‘ng qayta urinib ko‘ring. Xato kodi: ${reference}`,
        reference,
      },
      500,
      request,
    );
  }
}
