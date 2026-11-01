import { z } from 'zod';
import { products } from './catalog';

export function validName(value: string) {
  const name = value.trim().replace(/\s+/g, ' ');
  return (
    name.length >= 5 &&
    name.length <= 100 &&
    /^[\p{L}\p{M}][\p{L}\p{M} .ʻʼ'‘’-]*$/u.test(name) &&
    name.split(' ').filter((part) => /\p{L}{2,}/u.test(part)).length >= 2
  );
}
export function validPhone(value: string) {
  return /^\+998[ -]?\d{2}[ -]?\d{3}[ -]?\d{2}[ -]?\d{2}$/.test(value.trim());
}
export const checkoutSchema = z
  .object({
    customerName: z
      .string({ error: 'Ism va familiyangizni kiriting.' })
      .max(100, 'Ism va familiya juda uzun.')
      .refine(validName, 'Ism va familiyangizni to‘liq kiriting.'),
    phone: z
      .string({ error: 'Telefon raqamingizni kiriting.' })
      .max(25, 'Telefon raqami juda uzun.')
      .refine(validPhone, 'Telefon raqamini +998 XX XXX XX XX ko‘rinishida kiriting.'),
    items: z
      .array(
        z
          .object({
            productId: z
              .string({ error: 'Mahsulotni tanlang.' })
              .max(80, 'Mahsulot ma’lumoti noto‘g‘ri.'),
            quantity: z
              .number({ error: 'Mahsulot sonini kiriting.' })
              .int('Mahsulot soni butun son bo‘lsin.')
              .min(1, 'Mahsulot soni kamida 1 ta bo‘lsin.')
              .max(20, 'Bitta mahsulotdan ko‘pi bilan 20 ta buyurtma qiling.'),
          })
          .strict(),
      )
      .min(1, 'Savatingizga mahsulot qo‘shing.')
      .max(20, 'Bir buyurtmada ko‘pi bilan 20 xil mahsulot bo‘lsin.'),
    requestId: z
      .string({ error: 'Buyurtma kaliti kerak.' })
      .uuid('Buyurtma kaliti noto‘g‘ri. Sahifani yangilang.'),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (new Set(data.items.map((i) => i.productId)).size !== data.items.length)
      ctx.addIssue({
        code: 'custom',
        message: 'Bir xil mahsulotlar takrorlangan.',
        path: ['items'],
      });
    if (data.items.some((i) => !products.some((p) => p.id === i.productId)))
      ctx.addIssue({
        code: 'custom',
        message: 'Ba’zi mahsulotlar katalogda topilmadi.',
        path: ['items'],
      });
  });
export const loginSchema = z
  .object({ username: z.string().min(1).max(100), password: z.string().min(1).max(256) })
  .strict();
export const statusSchema = z
  .object({
    status: z.enum([
      'Yangi',
      'Tasdiqlandi',
      'Tayyorlanmoqda',
      'Yetkazilmoqda',
      'Yetkazildi',
      'Bekor qilindi',
    ]),
  })
  .strict();
