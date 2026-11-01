'use client';
import { useState } from 'react';
import { Eye, Search, X } from 'lucide-react';
import { ORDER_STATUSES, type Order, type OrderStatus } from '@/lib/types';
import { money, groupNumber, formatDate } from '@/lib/money';
import { Empty, Loading, Modal } from '@/components/ui';
import { adminRequest } from './client';
import { AdminError, AdminHeading, Pager, SaveButton, useAdminData } from './common';
type Result = { orders: Order[]; total: number; page: number; pages: number };
export function AdminOrders() {
  const [q, setQ] = useState(''),
    [status, setStatus] = useState(''),
    [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState<Order | null>(null),
    [nextStatus, setNextStatus] = useState<OrderStatus>('Yangi buyurtma'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [confirmCancel, setConfirmCancel] = useState(false);
  const query = new URLSearchParams({ q, status, from, to, page: String(page) });
  const { data, error: loadError, loading, reload } = useAdminData<Result>('/orders?' + query);
  const open = (order: Order) => {
    setSelected(order);
    setNextStatus(order.status);
    setError('');
    setConfirmCancel(false);
  };
  const save = async () => {
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      const result = await adminRequest<{ order: Order }>('/orders/' + selected.id, 'PATCH', {
        status: nextStatus,
        expectedStatus: selected.status,
      });
      setSelected(result.order);
      setConfirmCancel(false);
      reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <AdminHeading
        title="Buyurtmalar"
        text="Mijozlar, mahsulotlar va buyurtma holatlarini boshqaring."
      />
      <div className="admin-toolbar order-filters">
        <div className="search-field">
          <Search size={17} />
          <input
            placeholder="Ism, telefon yoki buyurtma raqami"
            aria-label="Buyurtmalarni qidirish"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </div>
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
        <label>
          Sana (dan)
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label>
          Sana (gacha)
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <button
          className="icon-button"
          onClick={() => {
            setQ('');
            setStatus('');
            setFrom('');
            setTo('');
            setPage(1);
          }}
          aria-label="Filtrlarni tozalash"
        >
          <X size={18} />
        </button>
      </div>
      <AdminError error={loadError} />
      {loading ? (
        <Loading />
      ) : !data?.orders.length ? (
        <Empty title="Buyurtmalar topilmadi" />
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Buyurtma / sana</th>
                <th>Mijoz</th>
                <th>Mahsulotlar</th>
                <th>Jami</th>
                <th>Holat</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.orders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <strong>{order.number}</strong>
                    <small>{formatDate(order.createdAt)}</small>
                  </td>
                  <td>
                    <strong>{order.customerName}</strong>
                    <a href={'tel:' + order.phone}>{order.phone}</a>
                  </td>
                  <td>{order.items.length} xil mahsulot</td>
                  <td>
                    <strong>{money(order.total)}</strong>
                  </td>
                  <td>
                    <span
                      className={`status-badge ${order.status === 'Bekor qilindi' ? 'cancelled' : ''}`}
                    >
                      {order.status}
                    </span>
                  </td>
                  <td>
                    <button
                      className="icon-button"
                      onClick={() => open(order)}
                      aria-label={`${order.number} buyurtmasini ko‘rish`}
                    >
                      <Eye size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} pages={data?.pages || 1} onChange={setPage} />
      {selected && (
        <Modal title={selected.number} onClose={() => setSelected(null)} wide>
          <div className="admin-modal-body">
            <div className="order-detail-customer">
              <div>
                <span className="eyebrow">MIJOZ</span>
                <h3>{selected.customerName}</h3>
                <a href={'tel:' + selected.phone}>{selected.phone}</a>
              </div>
              <div>
                <span className="eyebrow">BUYURTMA SANASI</span>
                <p>{formatDate(selected.createdAt)}</p>
                <span className="status-badge">{selected.status}</span>
              </div>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Mahsulot</th>
                    <th>Miqdor</th>
                    <th>Narx</th>
                    <th>Jami</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.items.map((item) => (
                    <tr key={item.productId}>
                      <td>
                        <strong>{item.name}</strong>
                        <small>{item.code}</small>
                      </td>
                      <td>
                        {groupNumber(item.quantity)} {item.unit}
                      </td>
                      <td>{money(item.unitPrice)}</td>
                      <td>{money(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="order-detail-total">
              <span>Chegirma: {money(selected.discount)}</span>
              <strong>Jami: {money(selected.total)}</strong>
            </div>
            <h3>Holatni o‘zgartirish</h3>
            {['Yetkazildi', 'Bekor qilindi'].includes(selected.status) ? (
              <p className="muted">Bu buyurtma yakunlangan. Holatini o‘zgartirib bo‘lmaydi.</p>
            ) : (
              <div className="status-editor">
                <select
                  aria-label="Yangi holat"
                  value={nextStatus}
                  onChange={(e) => {
                    setNextStatus(e.target.value as OrderStatus);
                    setConfirmCancel(false);
                  }}
                >
                  {ORDER_STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <button
                  className="button primary"
                  disabled={busy || nextStatus === selected.status}
                  onClick={() =>
                    nextStatus === 'Bekor qilindi' ? setConfirmCancel(true) : void save()
                  }
                >
                  Holatni saqlash
                </button>
              </div>
            )}
            {confirmCancel && (
              <div className="cancel-confirm">
                <p>
                  Buyurtma bekor qilinsa, mahsulot qoldiqlari omborga qaytariladi va mijozga
                  Telegram xabari yuboriladi.
                </p>
                <button className="button danger" disabled={busy} onClick={save}>
                  Ha, bekor qilish
                </button>
                <button className="button secondary" onClick={() => setConfirmCancel(false)}>
                  Orqaga
                </button>
              </div>
            )}
            <AdminError error={error} />
            <h3>Holatlar tarixi</h3>
            <ol className="order-history">
              {selected.history.map((h, i) => (
                <li key={i}>
                  <strong>{h.status}</strong>
                  <span>{formatDate(h.at)}</span>
                </li>
              ))}
            </ol>
          </div>
        </Modal>
      )}
    </>
  );
}
