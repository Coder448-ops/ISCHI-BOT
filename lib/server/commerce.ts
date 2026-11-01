import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import {
  effectivePrice,
  localized,
  type Order,
  type OrderItem,
  type Product,
  type Coupon,
  type Bootstrap,
} from '../types';
import { checkoutSchema, type StoreData } from './schemas';
import { ApiError, readStore, receiptToken, withStore } from './storage';
import { newEvent } from './notifications';

export function publicProduct(product: Product) {
  return product;
}
export function calculateQuote(
  data: Pick<StoreData, 'products' | 'categories' | 'coupons'>,
  items: { productId: string; quantity: number }[],
  couponCode = '',
) {
  const lines: OrderItem[] = [];
  for (const item of items) {
    const product = data.products.find((p) => p.id === item.productId);
    if (!product || !product.enabled) throw new ApiError(400, 'Mahsulot mavjud emas.', 'items');
    if (!data.categories.find((c) => c.id === product.categoryId)?.enabled)
      throw new ApiError(400, 'Kategoriya hozir mavjud emas.', 'items');
    if (
      !Number.isFinite(item.quantity) ||
      item.quantity < product.minOrder ||
      item.quantity > product.stock
    )
      throw new ApiError(
        409,
        `${product.name.uz}: miqdor ${product.minOrder}–${product.stock} ${product.unit} oralig‘ida bo‘lsin.`,
        'items',
      );
    const steps = (item.quantity - product.minOrder) / product.step;
    if (Math.abs(steps - Math.round(steps)) > 0.000001)
      throw new ApiError(
        400,
        `${product.name.uz}: miqdor ${product.step} qadam bilan kiritiladi.`,
        'items',
      );
    const unitPrice = effectivePrice(product);
    const total = Math.round(unitPrice * item.quantity);
    if (!Number.isSafeInteger(total) || total <= 0)
      throw new ApiError(400, 'Buyurtma summasi noto‘g‘ri.');
    lines.push({
      productId: product.id,
      code: product.code,
      name: product.name.uz,
      image: product.images[0],
      quantity: item.quantity,
      unit: product.unit,
      unitPrice,
      originalPrice: product.price,
      total,
    });
  }
  const subtotal = lines.reduce((sum, i) => sum + i.total, 0);
  if (!Number.isSafeInteger(subtotal)) throw new ApiError(400, 'Buyurtma summasi juda katta.');
  let coupon: Coupon | undefined;
  let discount = 0;
  const code = couponCode.trim().toUpperCase();
  if (code) {
    coupon = data.coupons.find((c) => c.code === code);
    if (
      !coupon ||
      !coupon.enabled ||
      (coupon.expiresAt && Date.parse(coupon.expiresAt) <= Date.now()) ||
      (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit)
    )
      throw new ApiError(400, 'Kupon yaroqsiz yoki muddati tugagan.', 'couponCode');
    if (subtotal < coupon.minSubtotal)
      throw new ApiError(400, 'Kupon uchun buyurtma summasi yetarli emas.', 'couponCode');
    discount =
      coupon.type === 'percent'
        ? Math.round((subtotal * coupon.value) / 100)
        : Math.min(coupon.value, subtotal - 1);
    if (coupon.maxDiscount !== null) discount = Math.min(discount, coupon.maxDiscount);
  }
  return {
    items: lines,
    subtotal,
    discount,
    total: subtotal - discount,
    couponCode: coupon?.code || null,
  };
}
export type CatalogQuery = {
  q?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  availability?: string;
  material?: string;
  thicknessMin?: number;
  thicknessMax?: number;
  lengthMin?: number;
  lengthMax?: number;
  diameterMin?: number;
  diameterMax?: number;
  sort?: string;
  page?: number;
  limit?: number;
  ids?: string[];
};
export function queryCatalog(
  products: Product[],
  categories: StoreData['categories'],
  orders: Order[],
  query: CatalogQuery,
) {
  const q = (query.q || '').trim().toLocaleLowerCase().slice(0, 100);
  const enabledCategories = new Set(categories.filter((c) => c.enabled).map((c) => c.id));
  const sales = new Map<string, number>();
  for (const order of orders)
    if (order.status !== 'Bekor qilindi')
      for (const item of order.items)
        sales.set(item.productId, (sales.get(item.productId) || 0) + item.quantity);
  let result = products.filter((p) => p.enabled && enabledCategories.has(p.categoryId));
  if (query.ids) result = result.filter((p) => query.ids!.includes(p.id));
  if (q)
    result = result.filter((p) =>
      [p.name.uz, p.name.ru, p.name.en, p.code, p.manufacturer, p.materialType]
        .join(' ')
        .toLocaleLowerCase()
        .includes(q),
    );
  if (query.category) result = result.filter((p) => p.categoryId === query.category);
  if (query.material) result = result.filter((p) => p.materialType === query.material);
  if (query.minPrice) result = result.filter((p) => effectivePrice(p) >= query.minPrice!);
  if (query.maxPrice) result = result.filter((p) => effectivePrice(p) <= query.maxPrice!);
  if (query.availability === 'in') result = result.filter((p) => p.stock >= p.minOrder);
  if (query.availability === 'out') result = result.filter((p) => p.stock < p.minOrder);
  if (query.availability === 'discount') result = result.filter((p) => p.discountPrice !== null);
  for (const field of ['thickness', 'length', 'diameter'] as const) {
    const min = query[`${field}Min`],
      max = query[`${field}Max`];
    if (min !== undefined)
      result = result.filter((p) => (p.measurements[field] ?? -Infinity) >= min);
    if (max !== undefined)
      result = result.filter((p) => (p.measurements[field] ?? Infinity) <= max);
  }
  result.sort((a, b) =>
    query.sort === 'price-asc'
      ? effectivePrice(a) - effectivePrice(b)
      : query.sort === 'price-desc'
        ? effectivePrice(b) - effectivePrice(a)
        : query.sort === 'popular'
          ? (sales.get(b.id) || 0) - (sales.get(a.id) || 0) ||
            Number(b.featured) - Number(a.featured)
          : Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
  const limit = Math.min(48, Math.max(1, Math.trunc(query.limit || 12)));
  const pages = Math.max(1, Math.ceil(result.length / limit));
  const page = Math.min(pages, Math.max(1, Math.trunc(query.page || 1)));
  return {
    products: result.slice((page - 1) * limit, page * limit),
    total: result.length,
    page,
    pages,
    limit,
    materials: [...new Set(products.filter((p) => p.enabled).map((p) => p.materialType))].sort(),
  };
}
export async function getBootstrap(): Promise<Bootstrap> {
  return withStore((data) => {
    const products = data.products.filter(
      (p) => p.enabled && data.categories.some((c) => c.id === p.categoryId && c.enabled),
    );
    const sales = new Map<string, number>();
    for (const o of data.orders)
      if (o.status !== 'Bekor qilindi')
        for (const i of o.items) sales.set(i.productId, (sales.get(i.productId) || 0) + i.quantity);
    const coupon = data.coupons.find(
      (c) =>
        c.enabled &&
        (!c.expiresAt || Date.parse(c.expiresAt) > Date.now()) &&
        (c.usageLimit === null || c.usedCount < c.usageLimit),
    );
    return {
      settings: data.settings,
      categories: data.categories.filter((c) => c.enabled).sort((a, b) => a.sort - b.sort),
      home: {
        popular: [...products].sort((a, b) => Number(b.featured) - Number(a.featured)).slice(0, 8),
        bestsellers: [...products]
          .filter((p) => sales.has(p.id))
          .sort((a, b) => (sales.get(b.id) || 0) - (sales.get(a.id) || 0))
          .slice(0, 8),
        newest: [...products]
          .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
          .slice(0, 8),
        discounts: products.filter((p) => p.discountPrice !== null).slice(0, 8),
      },
      couponOffer: coupon ? { code: coupon.code, type: coupon.type, value: coupon.value } : null,
      demo: data.settings.demoCatalog,
    };
  });
}
export async function createOrder(input: z.infer<typeof checkoutSchema>) {
  const name = input.customerName.trim().replace(/\s+/g, ' ');
  const phone = '+' + input.phone;
  const fingerprint = createHash('sha256')
    .update(
      JSON.stringify({
        name,
        phone,
        items: [...input.items].sort((a, b) => a.productId.localeCompare(b.productId)),
        coupon: input.couponCode?.toUpperCase() || '',
        expectedTotal: input.expectedTotal,
      }),
    )
    .digest('hex');
  const order = await withStore(
    (data) => {
      const existing = data.orders.find((o) => o.requestId === input.requestId);
      if (existing) {
        if (existing.fingerprint !== fingerprint)
          throw new ApiError(409, 'Buyurtma ma’lumotlari o‘zgargan. Savatni tekshiring.');
        return existing;
      }
      const quote = calculateQuote(data, input.items, input.couponCode);
      if (quote.total !== input.expectedTotal)
        throw new ApiError(
          409,
          'Narx yoki chegirma o‘zgargan. Yangilangan summani tekshirib, buyurtmani qayta tasdiqlang.',
          'expectedTotal',
        );
      const now = new Date().toISOString();
      const saved: Order = {
        id: randomUUID(),
        number: `ISH-${now.slice(0, 10).replaceAll('-', '')}-${randomBytes(4).toString('hex').toUpperCase()}`,
        customerName: name,
        phone,
        ...quote,
        status: 'Yangi buyurtma',
        requestId: input.requestId,
        fingerprint,
        createdAt: now,
        updatedAt: now,
        history: [{ status: 'Yangi buyurtma', at: now }],
        stockRestored: false,
      };
      for (const item of input.items) {
        const product = data.products.find((p) => p.id === item.productId)!;
        product.stock = Math.max(0, Number((product.stock - item.quantity).toFixed(6)));
      }
      if (quote.couponCode) data.coupons.find((c) => c.code === quote.couponCode)!.usedCount++;
      data.orders.push(saved);
      data.notifications.push(newEvent(saved, 'new'));
      return saved;
    },
    ['orders', 'products', 'coupons', 'notifications'],
  );
  return { order: await publicOrder(order), receiptToken: await receiptToken(order.id) };
}
export async function changeOrderStatus(
  id: string,
  status: Order['status'],
  expectedStatus?: Order['status'],
) {
  const result = await withStore(
    (data) => {
      const order = data.orders.find((o) => o.id === id);
      if (!order) throw new ApiError(404, 'Buyurtma topilmadi.');
      if (expectedStatus && order.status !== expectedStatus)
        throw new ApiError(409, 'Buyurtma holati o‘zgargan. Sahifani yangilang.');
      if (order.status === status) return { order, changed: false };
      if (['Yetkazildi', 'Bekor qilindi'].includes(order.status))
        throw new ApiError(409, 'Yakunlangan buyurtma holati o‘zgarmaydi.');
      order.status = status;
      order.updatedAt = new Date().toISOString();
      order.history.push({ status, at: order.updatedAt });
      if (status === 'Bekor qilindi' && !order.stockRestored) {
        for (const item of order.items) {
          const product = data.products.find((p) => p.id === item.productId);
          if (product) product.stock = Number((product.stock + item.quantity).toFixed(6));
        }
        if (order.couponCode) {
          const coupon = data.coupons.find((c) => c.code === order.couponCode);
          if (coupon) coupon.usedCount = Math.max(0, coupon.usedCount - 1);
        }
        order.stockRestored = true;
      }
      data.notifications.push(newEvent(order, status === 'Bekor qilindi' ? 'cancel' : 'status'));
      return { order, changed: true };
    },
    ['orders', 'products', 'coupons', 'notifications'],
  );
  return { order: await publicOrder(result.order), changed: result.changed };
}
export async function publicOrder(order: Order) {
  const { fingerprint, requestId, ...safe } = order;
  void fingerprint;
  void requestId;
  return safe;
}
export async function getReceiptOrder(id: string, token: string) {
  if (!/^[a-f0-9-]{36}$/.test(id) || !/^[A-Za-z0-9_-]{43}$/.test(token))
    throw new ApiError(404, 'Buyurtma topilmadi.');
  const expected = Buffer.from(await receiptToken(id));
  const actual = Buffer.from(token);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
    throw new ApiError(404, 'Buyurtma topilmadi.');
  const order = await withStore((data) => data.orders.find((o) => o.id === id));
  if (!order) throw new ApiError(404, 'Buyurtma topilmadi.');
  return publicOrder(order);
}
export function adminOverview(data: StoreData) {
  const orders = data.orders;
  const valid = orders.filter((o) => o.status !== 'Bekor qilindi');
  const sales = new Map<string, { name: string; quantity: number; revenue: number }>();
  for (const o of valid)
    for (const i of o.items) {
      const current = sales.get(i.productId) || { name: i.name, quantity: 0, revenue: 0 };
      current.quantity += i.quantity;
      current.revenue += i.total;
      sales.set(i.productId, current);
    }
  const monthly = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setUTCMonth(date.getUTCMonth() - 5 + index);
    const key = date.toISOString().slice(0, 7);
    return {
      month: key,
      revenue: orders
        .filter((o) => o.status === 'Yetkazildi' && o.createdAt.startsWith(key))
        .reduce((s, o) => s + o.total, 0),
      orders: orders.filter((o) => o.createdAt.startsWith(key)).length,
    };
  });
  return {
    totalOrders: orders.length,
    newOrders: orders.filter((o) => o.status === 'Yangi buyurtma').length,
    confirmedOrders: orders.filter((o) => o.status === 'Tasdiqlandi').length,
    completedOrders: orders.filter((o) => o.status === 'Yetkazildi').length,
    cancelledOrders: orders.filter((o) => o.status === 'Bekor qilindi').length,
    revenue: orders.filter((o) => o.status === 'Yetkazildi').reduce((s, o) => s + o.total, 0),
    orderValue: valid.reduce((s, o) => s + o.total, 0),
    recentOrders: [...orders].reverse().slice(0, 6),
    bestsellers: [...sales.entries()].sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 6),
    lowStock: data.products.filter((p) => p.stock <= p.lowStockThreshold).slice(0, 10),
    monthly,
  };
}
