import { z } from 'zod';
import { ORDER_STATUSES, UNITS } from '../types';

export const idSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9][a-z0-9-]*$/);
export const localizedSchema = z
  .object({
    uz: z.string().trim().min(1).max(10000),
    ru: z.string().max(10000).optional(),
    en: z.string().max(10000).optional(),
  })
  .strict();
const shortText = z.string().trim().max(300);
export const imagePath = z
  .string()
  .max(500)
  .refine(
    (v) =>
      /^\/images\/(products|categories|banners)\/[a-zA-Z0-9._-]+\.(webp|png|jpg|jpeg)$/.test(v) ||
      /^\/api\/media\/[a-f0-9-]+\.webp$/.test(v),
    'Rasm manzili noto‘g‘ri.',
  );
const positive = z.number().finite().positive().max(1_000_000_000_000);
const nonnegative = z.number().finite().nonnegative().max(1_000_000_000_000);
const timestamp = z.number().int().nonnegative().max(8_640_000_000_000_000);
const measurements = z
  .object({
    weight: positive.optional(),
    length: positive.optional(),
    width: positive.optional(),
    thickness: positive.optional(),
    diameter: positive.optional(),
  })
  .strict();
export const categorySchema = z
  .object({
    id: idSchema,
    name: localizedSchema,
    group: z.enum(['metal', 'construction']),
    description: z.string().max(2000),
    image: imagePath,
    sort: z.number().int().min(0).max(10000),
    enabled: z.boolean(),
  })
  .strict();
export const productSchema = z
  .object({
    id: idSchema,
    name: localizedSchema,
    description: localizedSchema,
    images: z.array(imagePath).min(1).max(12),
    categoryId: idSchema,
    code: z.string().trim().min(1).max(80),
    manufacturer: z.string().trim().max(200),
    price: positive,
    discountPrice: positive.nullable(),
    stock: nonnegative,
    minOrder: positive,
    step: positive,
    unit: z.enum(UNITS),
    weight: positive.nullable(),
    measurements,
    materialType: z.string().trim().max(120),
    specifications: z
      .array(
        z
          .object({
            label: z.string().trim().min(1).max(120),
            value: z.string().trim().min(1).max(500),
          })
          .strict(),
      )
      .max(40),
    enabled: z.boolean(),
    relatedIds: z.array(idSchema).max(12),
    lowStockThreshold: nonnegative,
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    featured: z.boolean(),
    demo: z.boolean(),
  })
  .strict()
  .superRefine((p, ctx) => {
    if (p.discountPrice !== null && p.discountPrice >= p.price)
      ctx.addIssue({
        code: 'custom',
        message: 'Chegirma narxi asosiy narxdan past bo‘lsin.',
        path: ['discountPrice'],
      });
    if (p.step > p.minOrder)
      ctx.addIssue({
        code: 'custom',
        message: 'Qadam minimal buyurtmadan katta bo‘lmasin.',
        path: ['step'],
      });
    if (
      ['dona', 'qop'].includes(p.unit) &&
      (!Number.isInteger(p.minOrder) || !Number.isInteger(p.step))
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Dona va qop uchun butun son kiriting.',
        path: ['minOrder'],
      });
    if (new Set(p.relatedIds).size !== p.relatedIds.length || p.relatedIds.includes(p.id))
      ctx.addIssue({
        code: 'custom',
        message: 'O‘xshash mahsulotlar takrorlanmasin.',
        path: ['relatedIds'],
      });
  });
export const orderSchema = z
  .object({
    id: z.string().uuid(),
    number: z.string().regex(/^ISH-\d{8}-[A-F0-9]{8}$/),
    customerName: z.string().min(5).max(100),
    phone: z.string().regex(/^\+998\d{9}$/),
    items: z
      .array(
        z
          .object({
            productId: idSchema,
            code: z.string().max(80),
            name: z.string().max(300),
            image: imagePath,
            quantity: positive,
            unit: z.enum(UNITS),
            unitPrice: positive,
            originalPrice: positive,
            total: positive,
          })
          .strict(),
      )
      .min(1)
      .max(50),
    subtotal: positive,
    discount: nonnegative,
    total: positive,
    couponCode: z.string().max(40).nullable(),
    status: z.enum(ORDER_STATUSES),
    requestId: z.string().uuid(),
    fingerprint: z.string().length(64),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    history: z
      .array(z.object({ status: z.enum(ORDER_STATUSES), at: z.string().datetime() }).strict())
      .max(1000),
    stockRestored: z.boolean(),
  })
  .strict();
export const couponSchema = z
  .object({
    id: idSchema,
    code: z
      .string()
      .trim()
      .min(3)
      .max(40)
      .regex(/^[A-Z0-9-]+$/),
    type: z.enum(['percent', 'fixed']),
    value: positive,
    minSubtotal: nonnegative,
    maxDiscount: positive.nullable(),
    usageLimit: z.number().int().positive().max(1000000).nullable(),
    usedCount: z.number().int().nonnegative(),
    expiresAt: z.string().datetime().nullable(),
    enabled: z.boolean(),
    createdAt: z.string().datetime(),
  })
  .strict()
  .superRefine((c, ctx) => {
    if (c.type === 'percent' && c.value > 100)
      ctx.addIssue({ code: 'custom', message: 'Foiz 100 dan oshmasin.', path: ['value'] });
  });
export const settingsSchema = z
  .object({
    companyName: z.string().trim().min(1).max(100),
    logo: imagePath.or(z.literal('')),
    phones: z.array(z.string().regex(/^\+998\d{9}$/)).max(5),
    address: localizedSchema,
    workingHours: localizedSchema,
    about: localizedSchema,
    delivery: localizedSchema,
    payment: localizedSchema,
    privacy: localizedSchema,
    websiteTitle: shortText,
    websiteDescription: z.string().max(500),
    whatsapp: z.string().regex(/^$|^\+998\d{9}$/),
    faq: z
      .array(
        z.object({ id: idSchema, question: localizedSchema, answer: localizedSchema }).strict(),
      )
      .max(50),
    testimonials: z
      .array(
        z
          .object({
            id: idSchema,
            name: z.string().trim().min(1).max(100),
            text: z.string().trim().min(1).max(1000),
            enabled: z.boolean(),
          })
          .strict(),
      )
      .max(30),
    announcement: localizedSchema,
    demoCatalog: z.boolean(),
    websiteUrl: z
      .string()
      .trim()
      .url()
      .refine(
        (v) => v.startsWith('https://') || v.startsWith('http://localhost'),
        'HTTPS sayt manzilini kiriting.',
      )
      .or(z.literal('')),
  })
  .strict();
export const notificationSchema = z
  .object({
    id: z.string().min(1).max(180),
    orderId: z.string().uuid(),
    kind: z.enum(['new', 'status', 'cancel']),
    message: z.string().min(1).max(4000),
    state: z.enum(['pending', 'sending', 'sent', 'uncertain', 'failed']),
    attempts: z.number().int().nonnegative(),
    nextAttemptAt: timestamp,
    lockedAt: timestamp.nullable(),
    createdAt: timestamp,
    deliveredAt: timestamp.nullable(),
    error: z.string().max(500).nullable(),
  })
  .strict();
export const sessionSchema = z
  .object({
    tokenHash: z.string().length(64),
    username: z.string().max(100),
    expiresAt: timestamp,
    createdAt: timestamp,
  })
  .strict();
export const supportSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(5).max(100),
    phone: z.string().regex(/^\+998\d{9}$/),
    message: z.string().min(5).max(2000),
    createdAt: z.string().datetime(),
    resolved: z.boolean(),
  })
  .strict();
export const storeSchemas = {
  products: z.array(productSchema).max(20000),
  categories: z.array(categorySchema).max(500),
  orders: z.array(orderSchema).max(1000000),
  settings: settingsSchema,
  coupons: z.array(couponSchema).max(5000),
  notifications: z.array(notificationSchema).max(1000000),
  sessions: z.array(sessionSchema).max(10000),
  support: z.array(supportSchema).max(100000),
};
export type StoreName = keyof typeof storeSchemas;
export type StoreData = { [K in StoreName]: z.infer<(typeof storeSchemas)[K]> };
export const checkoutSchema = z
  .object({
    customerName: z
      .string()
      .trim()
      .min(5, 'Ism va familiyangizni to‘liq kiriting.')
      .max(100)
      .refine(
        (s) => s.split(/\s+/).length >= 2 && /^[\p{L}\p{M}’'ʻʼ` -]+$/u.test(s),
        'Ism va familiyangizni to‘liq kiriting.',
      ),
    phone: z
      .string()
      .transform((s) => s.replace(/\D/g, ''))
      .pipe(z.string().regex(/^998\d{9}$/, 'Telefon raqamini to‘liq kiriting.')),
    items: z
      .array(z.object({ productId: idSchema, quantity: positive }).strict())
      .min(1)
      .max(50),
    requestId: z.string().uuid(),
    expectedTotal: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    couponCode: z.string().trim().max(40).optional(),
  })
  .strict()
  .refine(
    (v) => new Set(v.items.map((i) => i.productId)).size === v.items.length,
    'Mahsulotlar takrorlanmasin.',
  );
export const supportInputSchema = z
  .object({
    name: checkoutSchema.shape.customerName,
    phone: z
      .string()
      .transform((s) => s.replace(/\D/g, ''))
      .pipe(z.string().regex(/^998\d{9}$/)),
    message: z.string().trim().min(5).max(2000),
  })
  .strict();
