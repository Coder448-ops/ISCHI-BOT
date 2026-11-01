'use client';
import { useEffect, useState } from 'react';
import { Bell, Check, LoaderCircle, RefreshCw, Send, ShieldCheck } from 'lucide-react';

type Summary = {
  total: number;
  sent: number;
  pending: number;
  uncertain: number;
  failed: number;
  configured: boolean;
  recipient: string;
};
type NotificationEvent = {
  id: number;
  kind: 'new' | 'status' | 'cancel';
  state: 'pending' | 'sending' | 'sent' | 'uncertain' | 'failed';
  attempts: number;
  error: string | null;
  createdAt: number;
  number: string;
};
const eventKinds = {
  new: 'Yangi buyurtma',
  status: 'Buyurtma holati o‘zgardi',
  cancel: 'Buyurtma bekor qilindi',
};
const stateLabels = {
  pending: 'Navbatda',
  sending: 'Yuborilmoqda',
  sent: 'Yuborildi',
  uncertain: 'Tekshiruv kutilmoqda',
  failed: 'Yuborilmadi',
};
export default function NotificationsPanel() {
  const [events, setEvents] = useState<NotificationEvent[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [revision, setRevision] = useState(0);
  const [confirm, setConfirm] = useState<{ id: number; resolution: 'confirmed' | 'resend' } | null>(
    null,
  );
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      try {
        const response = await fetch('/api/admin/notifications', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (response.status === 401) {
          window.location.assign('/admin/login');
          return;
        }
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Xabarlarni yuklab bo‘lmadi.');
        setEvents(data.events);
        setSummary(data.summary);
        setError('');
      } catch (error) {
        if (!controller.signal.aborted)
          setError(error instanceof Error ? error.message : 'Ulanishda xatolik.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [revision]);
  async function act(
    action: 'retry' | 'resolve',
    resolution?: 'confirmed' | 'resend',
    id?: number,
  ) {
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action === 'retry' ? { action } : { action, resolution, id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Amalni bajarib bo‘lmadi.');
      setMessage(
        action === 'retry'
          ? 'Navbat yangilandi. Yuborilmagan xabarlar qayta tekshiriladi.'
          : 'Xabar holati yangilandi.',
      );
      setConfirm(null);
      setRevision((n) => n + 1);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Ulanishda xatolik.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <h1>Telegram xabarlari</h1>
          <p>Buyurtmalar bo‘yicha bildirishnomalar holati.</p>
        </div>
        <button
          className="button button-secondary"
          disabled={loading || busy}
          onClick={() => setRevision((n) => n + 1)}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Yangilash
        </button>
      </div>
      <div className={`telegram-banner ${summary && !summary.configured ? 'warning' : ''}`}>
        <Send size={21} />
        <div>
          <strong>
            {summary?.configured
              ? `Qabul qiluvchi: ${summary.recipient}`
              : 'Bot tokeni kiritilmagan'}
          </strong>
          <p>
            {summary?.configured
              ? `${summary.sent} ta yuborildi · ${summary.pending} ta navbatda · ${summary.uncertain} ta tekshiruvda · ${summary.failed} ta yuborilmadi`
              : 'TELEGRAM_BOT_TOKEN qiymatini serverda sozlang. Buyurtmalar bazaga saqlanishda davom etadi.'}
          </p>
        </div>
      </div>
      <div className="telegram-banner">
        <ShieldCheck size={21} />
        <div>
          <strong>Takroriy xabarlar yuborilmaydi</strong>
          <p>
            Har bir buyurtma voqeasi bir marta navbatga olinadi. Telegram javobi noaniq bo‘lsa,
            xabar avtomatik qayta yuborilmaydi.
          </p>
        </div>
        {summary && summary.failed > 0 && (
          <button disabled={busy} onClick={() => act('retry')}>
            Rad etilganlarni qayta yuborish
          </button>
        )}
      </div>
      {error && (
        <div className="error-banner admin-error" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="telegram-banner" role="status">
          <Check size={17} />
          <strong>{message}</strong>
        </div>
      )}
      <section className="orders-panel" style={{ padding: 22 }}>
        <div className="section-heading" style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, margin: 0 }}>Oxirgi xabarlar</h2>
          <span className="small muted">Oxirgi 100 ta voqea</span>
        </div>
        {loading && !events.length ? (
          <div className="orders-loading">
            <LoaderCircle className="spin" size={24} />
            Yuklanmoqda...
          </div>
        ) : !events.length ? (
          <div className="empty-state">
            <Bell size={32} />
            <h3>Hali xabarlar yo‘q</h3>
            <p>Yangi buyurtma yoki holat o‘zgarishi shu yerda ko‘rinadi.</p>
          </div>
        ) : (
          events.map((event) => (
            <article className="notification-event" key={event.id}>
              <div className="notification-event-header">
                <strong>{event.number}</strong>
                <span
                  className={`status-badge ${event.state === 'sent' ? 'status-delivered' : event.state === 'failed' ? 'status-cancelled' : event.state === 'uncertain' ? 'status-preparing' : 'status-new'}`}
                >
                  <span />
                  {stateLabels[event.state]}
                </span>
              </div>
              <span className="event-kind">{eventKinds[event.kind]}</span>
              <p>
                {new Date(event.createdAt).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })} ·{' '}
                {event.attempts} ta urinish
              </p>
              {event.error && <p>{event.error}</p>}
              {event.state === 'uncertain' && (
                <>
                  <p className="detail-note">
                    Avval Telegram chatini tekshiring. Xabar borgan bo‘lsa, qayta yubormang.
                  </p>
                  {confirm?.id === event.id ? (
                    <div className="notification-confirm">
                      {confirm.resolution === 'confirmed'
                        ? 'Bu xabar Telegramda qabul qilinganini tekshirdingizmi?'
                        : 'Bu xabar Telegramga yetib bormaganini tekshirdingizmi? Aks holda takroriy xabar yuborilishi mumkin.'}
                      <div>
                        <button
                          disabled={busy}
                          onClick={() => act('resolve', confirm.resolution, event.id)}
                        >
                          {busy ? 'Saqlanmoqda...' : 'Ha, tasdiqlayman'}
                        </button>
                        <button disabled={busy} onClick={() => setConfirm(null)}>
                          Bekor qilish
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="notification-actions">
                      <button
                        disabled={busy}
                        onClick={() => setConfirm({ id: event.id, resolution: 'confirmed' })}
                      >
                        Telegramda yuborilgan
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => setConfirm({ id: event.id, resolution: 'resend' })}
                      >
                        Yuborilmagan — qayta yuborish
                      </button>
                    </div>
                  )}
                </>
              )}
            </article>
          ))
        )}
      </section>
    </>
  );
}
