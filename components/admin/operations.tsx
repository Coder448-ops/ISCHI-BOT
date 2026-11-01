'use client';
import { useState } from 'react';
import { ArchiveRestore, Bell, Check, RefreshCw, Send, ShieldCheck } from 'lucide-react';
import type { NotificationEvent, SupportMessage } from '@/lib/types';
import { formatDate } from '@/lib/money';
import { Empty, Loading } from '@/components/ui';
import { adminRequest } from './client';
import { AdminError, AdminHeading, ConfirmAction, useAdminData } from './common';
type Notifications = {
  events: NotificationEvent[];
  summary: {
    total: number;
    pending: number;
    sent: number;
    uncertain: number;
    failed: number;
    configured: boolean;
    recipient: string;
  };
};
const states: Record<string, string> = {
  pending: 'Navbatda',
  sending: 'Yuborilmoqda',
  sent: 'Yuborildi',
  uncertain: 'Tekshiruv kutilmoqda',
  failed: 'Yuborilmadi',
};
export function AdminNotifications() {
  const { data, error, loading, reload } = useAdminData<Notifications>('/notifications');
  const [busy, setBusy] = useState(false),
    [actionError, setActionError] = useState(''),
    [resolve, setResolve] = useState<{ id: string; resolution: 'confirmed' | 'resend' } | null>(
      null,
    );
  const act = async (value: unknown) => {
    setBusy(true);
    setActionError('');
    try {
      await adminRequest('/notifications', 'POST', value);
      setTimeout(reload, 1200);
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <AdminHeading
        title="Telegram xabarlari"
        text="Buyurtma xabarlari navbati va yetkazilish holati."
        action="Navbatni yangilash"
        onAction={() => void act({ action: 'flush' })}
      />
      <AdminError error={error || actionError} />
      {loading || !data ? (
        <Loading />
      ) : (
        <>
          <div className="admin-stats">
            {[
              ['Jami', data.summary.total],
              ['Navbatda', data.summary.pending],
              ['Yuborildi', data.summary.sent],
              ['Tekshiruvda', data.summary.uncertain],
              ['Yuborilmadi', data.summary.failed],
            ].map(([label, value]) => (
              <div className="admin-stat" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <section className="admin-panel">
            <div className="telegram-status">
              <Send size={24} />
              <div>
                <strong>
                  {data.summary.configured
                    ? `Qabul qiluvchi: ${data.summary.recipient}`
                    : 'Bot tokeni sozlanmagan'}
                </strong>
                <p>
                  Yuborilgan xabarlar qayta yuborilmaydi. Noaniq javoblar administrator tekshiruvini
                  kutadi.
                </p>
              </div>
            </div>
            {data.summary.failed > 0 && (
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => act({ action: 'retry' })}
              >
                <RefreshCw size={16} />
                Rad etilganlarni qayta navbatga olish
              </button>
            )}
          </section>
          <div className="notification-list">
            {data.events.map((event) => (
              <article className="admin-panel notification-event" key={event.id}>
                <div className="admin-panel-heading">
                  <h3>
                    {event.kind === 'new'
                      ? 'Yangi buyurtma'
                      : event.kind === 'cancel'
                        ? 'Bekor qilish'
                        : 'Holat o‘zgarishi'}
                  </h3>
                  <span className="status-badge">{states[event.state]}</span>
                </div>
                <p className="muted small-text">
                  {formatDate(event.createdAt)} · {event.attempts} urinish
                </p>
                <pre>{event.message}</pre>
                {event.error && <p className="small-text orange-text">{event.error}</p>}
                {event.state === 'uncertain' && (
                  <>
                    <p className="small-text">
                      Avval Telegram chatini tekshiring. Xabar borgan bo‘lsa, qayta yubormang.
                    </p>
                    <div className="form-actions">
                      <button
                        className="button secondary"
                        disabled={busy}
                        onClick={() => setResolve({ id: event.id, resolution: 'confirmed' })}
                      >
                        <Check size={16} />
                        Telegramda yuborilgan
                      </button>
                      <button
                        className="button secondary"
                        disabled={busy}
                        onClick={() => setResolve({ id: event.id, resolution: 'resend' })}
                      >
                        Yuborilmagan — qayta yuborish
                      </button>
                    </div>
                  </>
                )}
              </article>
            ))}
          </div>
          {!data.events.length && <Empty title="Hali xabarlar yo‘q" />}
        </>
      )}
      {resolve && (
        <ConfirmAction
          title="Xabar holatini tasdiqlash"
          text={
            resolve.resolution === 'confirmed'
              ? 'Bu xabar Telegramga yetib borganini shaxsan tekshirdingizmi?'
              : 'Bu xabar Telegramga yetib bormaganini tekshirdingizmi? Aks holda takroriy xabar yuborilishi mumkin.'
          }
          onClose={() => setResolve(null)}
          onConfirm={async () => {
            await act({ action: 'resolve', ...resolve });
            reload();
          }}
        />
      )}
    </>
  );
}
export function AdminSupport() {
  const { data, error, loading, reload } = useAdminData<SupportMessage[]>('/support');
  const [busy, setBusy] = useState(''),
    [actionError, setActionError] = useState('');
  const resolve = async (message: SupportMessage) => {
    setBusy(message.id);
    try {
      await adminRequest('/support/' + message.id, 'PATCH', { resolved: !message.resolved });
      reload();
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy('');
    }
  };
  return (
    <>
      <AdminHeading
        title="Mijozlar xabarlari"
        text="Qo‘ng‘iroq va yordam uchun qoldirilgan arizalar."
      />
      <AdminError error={error || actionError} />
      {loading ? (
        <Loading />
      ) : !data?.length ? (
        <Empty title="Hali xabarlar yo‘q" />
      ) : (
        <div className="support-list">
          {data.map((message) => (
            <article className="admin-panel" key={message.id}>
              <div className="admin-panel-heading">
                <h3>{message.name}</h3>
                <span className="status-badge">
                  {message.resolved ? 'Hal qilindi' : 'Yangi ariza'}
                </span>
              </div>
              <a href={'tel:' + message.phone}>{message.phone}</a>
              <p className="muted small-text">{formatDate(message.createdAt)}</p>
              <p className="support-message">{message.message}</p>
              <button
                className="button secondary"
                disabled={busy === message.id}
                onClick={() => resolve(message)}
              >
                <Check size={16} />
                {message.resolved ? 'Qayta ochish' : 'Hal qilindi deb belgilash'}
              </button>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
type Backup = { id: string; createdAt: string; files: string[] };
export function AdminBackups() {
  const { data, error, loading, reload } = useAdminData<Backup[]>('/backups');
  const [restore, setRestore] = useState<string | null>(null),
    [actionError, setActionError] = useState('');
  return (
    <>
      <AdminHeading
        title="Zaxira nusxalar"
        text="Har bir muhim o‘zgarishdan oldin avtomatik nusxa olinadi. Oxirgi 40 tranzaksiya saqlanadi."
      />
      <div className="admin-panel">
        <ShieldCheck size={25} />
        <p>
          Fayllar serverning doimiy diskida saqlanadi. Tiklash tranzaksiyaning barcha fayllarini
          birga almashtiradi; oldin yangi zaxira olinadi. Disk nusxalarini alohida off-server
          zaxiralash tavsiya etiladi.
        </p>
      </div>
      <AdminError error={error || actionError} />
      {loading ? (
        <Loading />
      ) : !data?.length ? (
        <Empty title="Hali zaxira nusxalar yo‘q" />
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Sana</th>
                <th>Fayllar</th>
                <th>Tranzaksiyani tiklash</th>
              </tr>
            </thead>
            <tbody>
              {data.map((backup) => (
                <tr key={backup.id}>
                  <td>{formatDate(backup.createdAt)}</td>
                  <td>{backup.files.join(', ')}</td>
                  <td>
                    <button className="button secondary" onClick={() => setRestore(backup.id)}>
                      <ArchiveRestore size={14} />
                      Ushbu holatni tiklash
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {restore && (
        <ConfirmAction
          title="Zaxiradan tiklash"
          text="Ushbu tranzaksiyadagi barcha fayllar birga tiklanadi. Keyinroq qilingan buyurtmalar ushbu zaxirada yo‘q bo‘lishi mumkin. Joriy holatning yangi zaxirasi olinadi. Tiklangan xabarlar avtomatik qayta yuborilmaydi."
          onClose={() => setRestore(null)}
          onConfirm={async () => {
            await adminRequest('/backups', 'POST', { id: restore });
            reload();
          }}
        />
      )}
    </>
  );
}
