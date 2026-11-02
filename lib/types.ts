export const LANGUAGES = ['uz', 'ru', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];
export type Localized = { uz: string; ru?: string; en?: string };
export const UNITS = ['kg', 'ton', 'm', 'm²', 'dona', 'qop'] as const;
export type Unit = (typeof UNITS)[number];
export const ORDER_STATUSES = [
  'Yangi buyurtma',
  'Tasdiqlandi',
  'Tayyorlanmoqda',
  'Yetkazilmoqda',
  'Yetkazildi',
  'Bekor qilindi',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type Measurements = {
  weight?: number;
  length?: number;
  width?: number;
  thickness?: number;
  diameter?: number;
};
export type Specification = { label: string; value: string };
export type Category = {
  id: string;
  name: Localized;
  group: 'metal' | 'construction';
  description: string;
  image: string;
  sort: number;
  enabled: boolean;
};
export type Product = {
  id: string;
  name: Localized;
  description: Localized;
  images: string[];
  categoryId: string;
  code: string;
  manufacturer: string;
  price: number;
  discountPrice: number | null;
  stock: number;
  minOrder: number;
  step: number;
  unit: Unit;
  weight: number | null;
  measurements: Measurements;
  materialType: string;
  specifications: Specification[];
  enabled: boolean;
  relatedIds: string[];
  lowStockThreshold: number;
  createdAt: string;
  updatedAt: string;
  featured: boolean;
  demo: boolean;
};
export type OrderItem = {
  productId: string;
  code: string;
  name: string;
  image: string;
  quantity: number;
  unit: Unit;
  unitPrice: number;
  originalPrice: number;
  total: number;
};
export type Order = {
  id: string;
  number: string;
  customerName: string;
  phone: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  total: number;
  couponCode: string | null;
  status: OrderStatus;
  requestId: string;
  fingerprint: string;
  createdAt: string;
  updatedAt: string;
  history: { status: OrderStatus; at: string }[];
  stockRestored: boolean;
};
export type Coupon = {
  id: string;
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  minSubtotal: number;
  maxDiscount: number | null;
  usageLimit: number | null;
  usedCount: number;
  expiresAt: string | null;
  enabled: boolean;
  createdAt: string;
};
export type Testimonial = { id: string; name: string; text: string; enabled: boolean };
export type Settings = {
  companyName: string;
  logo: string;
  phones: string[];
  address: Localized;
  workingHours: Localized;
  about: Localized;
  delivery: Localized;
  payment: Localized;
  privacy: Localized;
  websiteTitle: string;
  websiteDescription: string;
  whatsapp: string;
  faq: { id: string; question: Localized; answer: Localized }[];
  testimonials: Testimonial[];
  announcement: Localized;
  demoCatalog: boolean;
  websiteUrl: string;
};
export type NotificationEvent = {
  id: string;
  orderId: string;
  kind: 'new' | 'status' | 'cancel';
  message: string;
  state: 'pending' | 'sending' | 'sent' | 'uncertain' | 'failed';
  attempts: number;
  nextAttemptAt: number;
  lockedAt: number | null;
  createdAt: number;
  deliveredAt: number | null;
  error: string | null;
};
export type Session = { tokenHash: string; username: string; expiresAt: number; createdAt: number };
export type SupportMessage = {
  id: string;
  name: string;
  phone: string;
  message: string;
  createdAt: string;
  resolved: boolean;
};
export type PublicSettings = Settings;
export type CatalogResult = {
  products: Product[];
  total: number;
  page: number;
  pages: number;
  limit: number;
  materials: string[];
};
export type Bootstrap = {
  settings: Settings;
  categories: Category[];
  home: { popular: Product[]; bestsellers: Product[]; newest: Product[]; discounts: Product[] };
  couponOffer: null | { code: string; type: 'percent' | 'fixed'; value: number };
  demo: boolean;
  /** Ko‘rgazma rejimi: content is shown, order placement is switched off. */
  readOnly: boolean;
};
export type CartLine = { productId: string; quantity: number };
export type Receipt = { id: string; number: string; token: string };
export function localized(value: Localized, lang: Language) {
  return value[lang] || value.uz;
}
export function effectivePrice(product: Product) {
  return product.discountPrice ?? product.price;
}
export function availability(product: Product) {
  return !product.enabled
    ? 'disabled'
    : product.stock < product.minOrder
      ? 'out'
      : product.stock <= product.lowStockThreshold
        ? 'low'
        : 'in';
}
