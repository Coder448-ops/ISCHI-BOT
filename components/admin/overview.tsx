'use client';
import {
  Package,
  ShoppingBag,
  CircleCheck,
  Wallet,
  Clock3,
  XCircle,
  ArrowUpRight,
  TriangleAlert,
} from 'lucide-react';
import { money, groupNumber, formatDate } from '@/lib/money';
import type { adminOverview } from '@/lib/server/commerce';
import { Loading } from '@/components/ui';
import { AdminError, AdminHeading, useAdminData } from './common';
export function AdminOverview() {
  const { data, error, loading, reload } =
    useAdminData<ReturnType<typeof adminOverview>>('/overview');
  if (loading) return <Loading />;
  if (!data)
    return (
      <>
        <AdminError error={error} />
        <button className="button secondary" onClick={reload}>
          Qayta urinish
        </button>
      </>
    );
  const stats = [
    { label: 'Jami buyurtmalar', value: data.totalOrders, icon: ShoppingBag },
    { label: 'Yangi buyurtmalar', value: data.newOrders, icon: Clock3 },
    { label: 'Tasdiqlangan', value: data.confirmedOrders, icon: CircleCheck },
    { label: 'Yetkazilgan', value: data.completedOrders, icon: Package },
    { label: 'Bekor qilingan', value: data.cancelledOrders, icon: XCircle },
    { label: 'Yetkazilgan savdo', value: money(data.revenue), icon: Wallet },
  ];
  const max = Math.max(1, ...data.monthly.map((x) => x.revenue));
  return (
    <>
      <AdminHeading
        title="Umumiy ko‘rinish"
        text="Do‘konning haqiqiy savdo va buyurtma ko‘rsatkichlari."
      />
      <div className="admin-stats">
        {stats.map(({ label, value, icon: Icon }) => (
          <article className="admin-stat" key={label}>
            <div>
              <span>{label}</span>
              <Icon size={19} />
            </div>
            <strong>{typeof value === 'number' ? groupNumber(value) : value}</strong>
          </article>
        ))}
      </div>
      <div className="admin-two-columns">
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <h2>Savdo dinamikasi</h2>
            <span>So‘nggi 6 oy</span>
          </div>
          <p className="muted small-text">
            Faqat yetkazilgan buyurtmalar summasi. Jami buyurtma qiymati: {money(data.orderValue)}
          </p>
          <div
            className="revenue-chart"
            role="img"
            aria-label="Oylar bo‘yicha yetkazilgan buyurtmalar summasi"
          >
            {data.monthly.map((month) => (
              <div key={month.month}>
                <span>{month.revenue ? money(month.revenue) : '0'}</span>
                <div className="chart-bar-track">
                  <i style={{ height: `${Math.max(2, (month.revenue / max) * 100)}%` }} />
                </div>
                <small>
                  {month.month.slice(5)} / {month.month.slice(2, 4)}
                </small>
                <b>{month.orders} buyurtma</b>
              </div>
            ))}
          </div>
        </section>
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <h2>Kam qolgan mahsulotlar</h2>
            <TriangleAlert size={19} />
          </div>
          {data.lowStock.length ? (
            <div className="admin-simple-list">
              {data.lowStock.map((p) => (
                <a href="/admin/products" key={p.id}>
                  <img src={p.images[0]} alt="" width="42" height="38" />
                  <span>
                    {p.name.uz}
                    <small>{p.code}</small>
                  </span>
                  <strong className="orange-text">
                    {groupNumber(p.stock)} {p.unit}
                  </strong>
                </a>
              ))}
            </div>
          ) : (
            <p className="muted">Barcha mahsulot qoldiqlari yetarli.</p>
          )}
        </section>
      </div>
      <div className="admin-two-columns">
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <h2>So‘nggi buyurtmalar</h2>
            <a href="/admin/orders">
              Barchasi
              <ArrowUpRight size={15} />
            </a>
          </div>
          {data.recentOrders.length ? (
            <div className="admin-simple-list">
              {data.recentOrders.map((o) => (
                <a href="/admin/orders" key={o.id}>
                  <span>
                    {o.number}
                    <small>
                      {o.customerName} · {formatDate(o.createdAt)}
                    </small>
                  </span>
                  <strong>{money(o.total)}</strong>
                </a>
              ))}
            </div>
          ) : (
            <p className="muted">Hali buyurtmalar yo‘q.</p>
          )}
        </section>
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <h2>Ko‘p sotilgan mahsulotlar</h2>
          </div>
          {data.bestsellers.length ? (
            <div className="admin-simple-list">
              {data.bestsellers.map(([id, p]) => (
                <div key={id}>
                  <span>
                    {p.name}
                    <small>{groupNumber(p.quantity)} birlik</small>
                  </span>
                  <strong>{money(p.revenue)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">Savdo statistikasi birinchi buyurtmalardan keyin shakllanadi.</p>
          )}
        </section>
      </div>
    </>
  );
}
