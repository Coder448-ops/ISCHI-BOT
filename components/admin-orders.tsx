'use client';
import { useEffect, useState, type FormEvent } from 'react';
import {
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Clock3,
  Eye,
  LoaderCircle,
  Package,
  RefreshCw,
  Search,
  Send,
  ShoppingBag,
  UserRound,
  Wallet,
  X,
} from 'lucide-react';
import {
  ORDER_STATUSES,
  dateTime,
  formatPhone,
  money,
  type Order,
  type OrderStatus,
} from '@/lib/format';
import Dialog from './dialog';
import StatusBadge from './status-badge';

type NotificationSummary = {
  total: number;
  sent: number;
  pending: number;
  uncertain: number;
  failed: number;
  configured: boolean;
  recipient: string;
};
type OrdersData = {
  orders: Order[];
  total: number;
  page: number;
  pages: number;
  limit: number;
  summary: { total: number; new: number; active: number; revenue: number };
  notifications: NotificationSummary;
};
export default function AdminOrders() {
  const [data, setData] = useState<OrdersData | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Order | null>(null);
  const [success, setSuccess] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(
      async () => {
        setLoading(true);
        setError('');
        try {
          const params = new URLSearchParams({ q: query, status, page: String(page) });
          const response = await fetch(`/api/admin/orders?${params}`, {
            signal: controller.signal,
            cache: 'no-store',
          });
          if (response.status === 401) {
            window.location.assign('/admin/login');
            return;
          }
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || 'Buyurtmalarni yuklab bo‘lmadi.');
          setData(result);
        } catch (error) {
          if (!controller.signal.aborted)
            setError(error instanceof Error ? error.message : 'Ulanishda xatolik.');
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      },
      query ? 250 : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, status, page, revision]);
  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(''), 4000);
    return () => clearTimeout(timer);
  }, [success]);
  function saved(order: Order) {
    setSelected(order);
    setRevision((n) => n + 1);
    setSuccess('Buyurtma holati saqlandi.');
  }
  const summary = data?.summary;
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <h1>Buyurtmalar</h1>
          <p>Barcha buyurtmalar bir joyda. Har biri nazoratingizda.</p>
        </div>
        <button
          className="button button-secondary"
          disabled={loading}
          onClick={() => setRevision((n) => n + 1)}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Yangilash
        </button>
      </div>
      <div className="admin-stats">
        <div className="stat-card">
          <div>
            Jami buyurtmalar <ShoppingBag size={17} />
          </div>
          <strong>{summary?.total ?? '—'}</strong>
          <small>Barcha vaqt davomida</small>
        </div>
        <div className="stat-card">
          <div>
            Yangi buyurtmalar <Clock3 size={17} />
          </div>
          <strong>{summary?.new ?? '—'}</strong>
          <small>Tasdiqlashni kutmoqda</small>
        </div>
        <div className="stat-card">
          <div>
            Jarayonda <Package size={17} />
          </div>
          <strong>{summary?.active ?? '—'}</strong>
          <small>Hozirgi faol buyurtmalar</small>
        </div>
        <div className="stat-card">
          <div>
            Yetkazilgan savdo <Wallet size={17} />
          </div>
          <strong className="money-stat">{summary ? money(summary.revenue) : '—'}</strong>
          <small>Yetkazilgan buyurtmalar bo‘yicha</small>
        </div>
      </div>
      {data && (
        <div
          className={`telegram-banner ${!data.notifications.configured || data.notifications.failed || data.notifications.uncertain ? 'warning' : ''}`}
        >
          <Send size={20} />
          <div>
            <strong>
              {data.notifications.configured
                ? `Telegram xabarlari · ${data.notifications.recipient}`
                : 'Telegram bildirishnomalari hali sozlanmagan'}
            </strong>
            <p>
              {data.notifications.configured
                ? `${data.notifications.sent} ta yuborildi · ${data.notifications.pending} ta navbatda${data.notifications.uncertain ? ` · ${data.notifications.uncertain} ta tekshiruv kutilmoqda` : ''}${data.notifications.failed ? ` · ${data.notifications.failed} ta yuborilmadi` : ''}`
                : 'Buyurtmalar saqlanmoqda. Xabar yuborish uchun serverga bot tokenini kiriting.'}
            </p>
          </div>
          <a className="text-button" href="/admin/notifications">
            Xabarlarni ko‘rish <ArrowUpRight size={14} />
          </a>
        </div>
      )}
      {error && (
        <div className="error-banner admin-error" role="alert">
          {error}
        </div>
      )}
      {success && (
        <div className="telegram-banner" role="status">
          <CircleCheck size={18} />
          <strong>{success}</strong>
        </div>
      )}
      <section className="orders-panel" aria-labelledby="orders-list-title">
        <div className="orders-toolbar">
          <h2 id="orders-list-title">
            Buyurtmalar ro‘yxati <span>{data?.total ?? 0} ta</span>
          </h2>
          <div className="orders-filters">
            <label className="search-field">
              <Search size={16} />
              <input
                placeholder="Ism, telefon yoki buyurtma raqami"
                aria-label="Buyurtmalarni qidirish"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
              />
              {query && (
                <button
                  aria-label="Qidiruvni tozalash"
                  onClick={() => {
                    setQuery('');
                    setPage(1);
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </label>
            <select
              aria-label="Buyurtma holati bo‘yicha filtr"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Barcha holatlar</option>
              {ORDER_STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
        {loading && !data ? (
          <div className="orders-loading">
            <LoaderCircle size={25} className="spin" />
            Buyurtmalar yuklanmoqda...
          </div>
        ) : data && data.orders.length ? (
          <div className="table-scroll" aria-busy={loading}>
            <table className="orders-table">
              <thead>
                <tr>
                  <th>Buyurtma / Sana</th>
                  <th>Mijoz</th>
                  <th>Mahsulotlar</th>
                  <th>Jami summa</th>
                  <th>Holati</th>
                  <th>
                    <span className="small">Amal</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.orders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <button className="order-number" onClick={() => setSelected(order)}>
                        {order.number}
                      </button>
                      <span className="order-date">{dateTime(order.createdAt)}</span>
                    </td>
                    <td className="customer-cell">
                      <strong>{order.customerName}</strong>
                      <a href={`tel:${order.phone}`}>{formatPhone(order.phone)}</a>
                    </td>
                    <td>
                      <div
                        className="table-products"
                        title={order.items.map((i) => `${i.name} — ${i.quantity} ta`).join(', ')}
                      >
                        {order.items[0].name}
                        <small>
                          {order.items.length > 1
                            ? `+${order.items.length - 1} xil mahsulot`
                            : `${order.items[0].quantity} ta`}
                        </small>
                      </div>
                    </td>
                    <td className="table-total">{money(order.total)}</td>
                    <td>
                      <StatusBadge status={order.status} />
                    </td>
                    <td>
                      <button
                        className="order-view-button"
                        onClick={() => setSelected(order)}
                        aria-label={`${order.number} buyurtmasini ko‘rish`}
                      >
                        <Eye size={15} /> Ko‘rish
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state admin-empty">
            <ShoppingBag size={36} />
            <h3>{query || status ? 'Buyurtma topilmadi' : 'Hali buyurtmalar yo‘q'}</h3>
            <p>
              {query || status
                ? 'Qidiruvni yoki holat filtrini o‘zgartirib ko‘ring.'
                : 'Birinchi buyurtma kelib tushganda shu yerda ko‘rinadi.'}
            </p>
            {query || status ? (
              <button
                className="button button-secondary"
                onClick={() => {
                  setQuery('');
                  setStatus('');
                  setPage(1);
                }}
              >
                Filtrlarni tozalash
              </button>
            ) : (
              <a className="button button-secondary" href="/" target="_blank">
                Do‘konni ochish <ArrowUpRight size={16} />
              </a>
            )}
          </div>
        )}
        <div className="table-footer">
          <span>
            {data?.total
              ? `${(page - 1) * data.limit + 1}–${Math.min(page * data.limit, data.total)} / ${data.total} ta buyurtma`
              : '0 ta buyurtma'}
          </span>
          <div className="pagination">
            <button
              aria-label="Oldingi sahifa"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft size={15} />
            </button>
            <span>
              {page} / {data?.pages || 1}
            </span>
            <button
              aria-label="Keyingi sahifa"
              disabled={!data || page >= data.pages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </section>
      {selected && (
        <OrderDetail
          key={selected.id}
          order={selected}
          onClose={() => setSelected(null)}
          onSaved={saved}
        />
      )}
    </>
  );
}
function OrderDetail({
  order,
  onClose,
  onSaved,
}: {
  order: Order;
  onClose: () => void;
  onSaved: (order: Order) => void;
}) {
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const terminal = order.status === 'Yetkazildi' || order.status === 'Bekor qilindi';
  async function update(next: OrderStatus) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next, expectedStatus: order.status }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Holatni saqlab bo‘lmadi.');
      setStatus(data.order.status);
      setConfirmCancel(false);
      onSaved(data.order);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Ulanishda xatolik.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      onClose={onClose}
      titleId="order-detail-title"
      className="order-detail-dialog"
      closeDisabled={busy}
    >
      <div className="drawer-header">
        <div>
          <span className="eyebrow">BUYURTMA TAFSILOTLARI</span>
          <h2 id="order-detail-title">{order.number}</h2>
        </div>
        <button
          className="icon-button"
          aria-label="Tafsilotlarni yopish"
          disabled={busy}
          onClick={onClose}
        >
          <X size={21} />
        </button>
      </div>
      <div className="detail-content">
        <div className="detail-section">
          <StatusBadge status={order.status} />
          <p className="detail-note">{dateTime(order.createdAt)} · Toshkent vaqti</p>
        </div>
        <section className="detail-section">
          <h3>
            <UserRound size={16} /> Mijoz ma’lumotlari
          </h3>
          <div className="detail-customer">
            <div>
              <span>Ism va familiya</span>
              <strong>{order.customerName}</strong>
            </div>
            <div>
              <span>Telefon</span>
              <a href={`tel:${order.phone}`}>{formatPhone(order.phone)}</a>
            </div>
          </div>
        </section>
        <section className="detail-section">
          <h3>
            <Package size={16} /> Buyurtma mahsulotlari
          </h3>
          {order.items.map((item) => (
            <div className="detail-item" key={item.productId}>
              <div>
                {item.name}
                <small>
                  {item.quantity} ta × {money(item.unitPrice)}
                </small>
              </div>
              <strong>{money(item.quantity * item.unitPrice)}</strong>
            </div>
          ))}
        </section>
        <section className="detail-section">
          <h3>
            <TruckIcon /> Buyurtma holati
          </h3>
          <div className="detail-status-options">
            {ORDER_STATUSES.filter((s) => s !== 'Bekor qilindi').map((s) => (
              <button
                key={s}
                disabled={busy || terminal}
                className={status === s ? 'selected' : ''}
                aria-pressed={status === s}
                onClick={() => {
                  setStatus(s);
                  setConfirmCancel(false);
                }}
              >
                {s}
                {status === s && <Check size={14} />}
              </button>
            ))}
          </div>
          {terminal ? (
            <p className="detail-note">Bu buyurtma yakunlangan. Holatini o‘zgartirib bo‘lmaydi.</p>
          ) : (
            <>
              <p className="detail-note">
                Holat o‘zgarganda mijoz buyurtmasi bo‘yicha administratorga Telegram xabari
                yuboriladi.
              </p>
              {!confirmCancel ? (
                <button
                  className="cancel-order-button"
                  disabled={busy}
                  onClick={() => setConfirmCancel(true)}
                >
                  <X size={15} /> Buyurtmani bekor qilish
                </button>
              ) : (
                <div className="cancel-confirm">
                  <p>
                    Buyurtma bekor qilinsinmi? Administratorga bekor qilish haqida xabar yuboriladi.
                  </p>
                  <div>
                    <button disabled={busy} onClick={() => setConfirmCancel(false)}>
                      Orqaga
                    </button>
                    <button disabled={busy} onClick={() => update('Bekor qilindi')}>
                      {busy ? 'Bekor qilinmoqda...' : 'Ha, bekor qilish'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
          {error && (
            <div className="error-banner" role="alert">
              {error}
            </div>
          )}
        </section>
      </div>
      <div className="detail-footer">
        <div className="summary-row">
          <span>Jami summa</span>
          <strong>{money(order.total)}</strong>
        </div>
        <button
          className="button button-primary full-width"
          disabled={busy || terminal || status === order.status || status === 'Bekor qilindi'}
          onClick={() => update(status)}
        >
          {busy ? (
            <>
              <LoaderCircle className="spin" size={17} /> Saqlanmoqda...
            </>
          ) : (
            <>
              {status === order.status ? 'Holat saqlangan' : 'Holatni saqlash'} <Check size={17} />
            </>
          )}
        </button>
      </div>
    </Dialog>
  );
}
function TruckIcon() {
  return <RefreshCw size={16} />;
}
