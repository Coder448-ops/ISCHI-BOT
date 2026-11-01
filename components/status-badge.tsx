import type { OrderStatus } from '@/lib/format';
const classes: Record<OrderStatus, string> = {
  Yangi: 'new',
  Tasdiqlandi: 'confirmed',
  Tayyorlanmoqda: 'preparing',
  Yetkazilmoqda: 'delivering',
  Yetkazildi: 'delivered',
  'Bekor qilindi': 'cancelled',
};
export default function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`status-badge status-${classes[status]}`}>
      <span />
      {status}
    </span>
  );
}
