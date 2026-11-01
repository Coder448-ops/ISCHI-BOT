export const ORDER_STATUSES = [
  'Yangi',
  'Tasdiqlandi',
  'Tayyorlanmoqda',
  'Yetkazilmoqda',
  'Yetkazildi',
  'Bekor qilindi',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
// Explicit grouping is consistent across Node, browsers, and Telegram clients.
export function shortMoney(value: number) {
  return Math.trunc(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
export function money(value: number) {
  return shortMoney(value) + ' so‘m';
}
export function dateTime(value: string) {
  return new Intl.DateTimeFormat('uz-UZ', {
    timeZone: 'Asia/Tashkent',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}
export function formatPhone(raw: string) {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('998')) digits = digits.slice(3);
  digits = digits.slice(0, 9);
  const groups = [
    digits.slice(0, 2),
    digits.slice(2, 5),
    digits.slice(5, 7),
    digits.slice(7, 9),
  ].filter(Boolean);
  return '+998' + (digits ? ' ' + groups.join(' ') : raw.length ? ' ' : '');
}
export function normalizePhone(raw: string) {
  return '+998' + raw.replace(/\D/g, '').replace(/^998/, '').slice(0, 9);
}
export type OrderItem = { productId: string; name: string; quantity: number; unitPrice: number };
export type Order = {
  id: string;
  number: string;
  customerName: string;
  phone: string;
  total: number;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
};
export type CartItem = { productId: string; quantity: number };
