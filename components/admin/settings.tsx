'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Send, ShieldCheck, Trash2 } from 'lucide-react';
import type { Settings } from '@/lib/types';
import { Loading } from '@/components/ui';
import { adminRequest } from './client';
import {
  AdminError,
  AdminHeading,
  ImageUploader,
  LocalizedInput,
  SaveButton,
  Toggle,
  useAdminData,
} from './common';
export function AdminSettings() {
  const { data, error, loading, reload } = useAdminData<{
    settings: Settings;
    telegramConfigured: boolean;
    recipient: string;
  }>('/settings');
  const [settings, setSettings] = useState<Settings | null>(null),
    [formError, setFormError] = useState(''),
    [busy, setBusy] = useState(false),
    [success, setSuccess] = useState(''),
    [telegramBusy, setTelegramBusy] = useState(false),
    [telegramResult, setTelegramResult] = useState('');
  useEffect(() => {
    if (data) setSettings(structuredClone(data.settings));
  }, [data]);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setBusy(true);
    setFormError('');
    setSuccess('');
    try {
      await adminRequest('/settings', 'PATCH', settings);
      setSuccess('Kompaniya ma’lumotlari saqlandi.');
      reload();
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const telegram = async (action: 'verify' | 'test') => {
    setTelegramBusy(true);
    setTelegramResult('');
    try {
      const result = await adminRequest<{ username?: string; chatId?: number; ok?: boolean }>(
        '/telegram',
        'POST',
        { action },
      );
      setTelegramResult(
        action === 'test'
          ? 'Sinov xabari yuborildi.'
          : `Ulanish tasdiqlandi. Chat: ${result.username || result.chatId}`,
      );
    } catch (e) {
      setTelegramResult((e as Error).message);
    } finally {
      setTelegramBusy(false);
    }
  };
  if (loading || !settings)
    return (
      <>
        <Loading />
        <AdminError error={error} />
      </>
    );
  const update = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setSettings({ ...settings, [key]: value });
  return (
    <>
      <AdminHeading
        title="Kompaniya sozlamalari"
        text="Sayt matnlari, aloqa ma’lumotlari va Telegram ulanishi."
      />
      <form onSubmit={save} className="admin-settings">
        <section className="admin-panel">
          <h2>Kompaniya</h2>
          <div className="form-row">
            <label>
              Kompaniya nomi
              <input
                required
                value={settings.companyName}
                onChange={(e) => update('companyName', e.target.value)}
                maxLength={100}
              />
            </label>
            <label>
              Sayt sarlavhasi
              <input
                required
                value={settings.websiteTitle}
                onChange={(e) => update('websiteTitle', e.target.value)}
                maxLength={300}
              />
            </label>
          </div>
          <label>
            Ommaviy sayt manzili (Android ulashish havolalari uchun)
            <input
              type="url"
              value={settings.websiteUrl}
              placeholder="https://shop.your-company.example"
              onChange={(e) => update('websiteUrl', e.target.value.trim())}
              maxLength={500}
            />
            <small>Haqiqiy HTTPS manzil. Bo‘sh qoldirilsa, joriy sayt manzili ishlatiladi.</small>
          </label>
          <label>
            Sayt tavsifi
            <textarea
              value={settings.websiteDescription}
              onChange={(e) => update('websiteDescription', e.target.value)}
              maxLength={500}
              rows={2}
            />
          </label>
          <ImageUploader
            images={settings.logo ? [settings.logo] : []}
            multiple={false}
            onChange={(images) => update('logo', images[0] || '')}
            onError={setFormError}
          />
          <div className="form-row">
            <label>
              Telefon raqamlari (vergul bilan)
              <input
                value={settings.phones.join(', ')}
                placeholder="+998XXXXXXXXX"
                onChange={(e) =>
                  update(
                    'phones',
                    e.target.value
                      .split(',')
                      .map((x) => x.trim())
                      .filter(Boolean),
                  )
                }
              />
            </label>
            <label>
              WhatsApp raqami
              <input
                value={settings.whatsapp}
                placeholder="+998XXXXXXXXX"
                onChange={(e) => update('whatsapp', e.target.value)}
              />
            </label>
          </div>
          <LocalizedInput
            label="Manzil"
            value={settings.address}
            onChange={(v) => update('address', v)}
            multiline
          />
          <LocalizedInput
            label="Ish vaqti"
            value={settings.workingHours}
            onChange={(v) => update('workingHours', v)}
          />
          <Toggle
            label="Namoyish katalogi haqida ogohlantirishni ko‘rsatish"
            checked={settings.demoCatalog}
            onChange={(v) => update('demoCatalog', v)}
          />
        </section>
        <section className="admin-panel">
          <h2>Kompaniya sahifalari</h2>
          {(
            [
              ['about', 'Biz haqimizda'],
              ['delivery', 'Yetkazib berish'],
              ['payment', 'To‘lov shartlari'],
              ['privacy', 'Maxfiylik siyosati'],
              ['announcement', 'E’lon matni'],
            ] as const
          ).map(([key, label]) => (
            <LocalizedInput
              key={key}
              label={label}
              value={settings[key]}
              onChange={(v) => update(key, v)}
              multiline
            />
          ))}
        </section>
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <h2>Savol-javoblar</h2>
            <button
              type="button"
              className="button secondary"
              onClick={() =>
                update('faq', [
                  ...settings.faq,
                  { id: 'faq-' + Date.now(), question: { uz: '' }, answer: { uz: '' } },
                ])
              }
            >
              <Plus size={16} />
              Savol qo‘shish
            </button>
          </div>
          {settings.faq.map((faq, i) => (
            <div className="admin-repeat-item" key={faq.id}>
              <button
                type="button"
                className="icon-button"
                onClick={() =>
                  update(
                    'faq',
                    settings.faq.filter((_, j) => i !== j),
                  )
                }
                aria-label="Savolni o‘chirish"
              >
                <Trash2 size={17} />
              </button>
              <LocalizedInput
                label="Savol"
                value={faq.question}
                onChange={(question) =>
                  update(
                    'faq',
                    settings.faq.map((x, j) => (i === j ? { ...x, question } : x)),
                  )
                }
              />
              <LocalizedInput
                label="Javob"
                value={faq.answer}
                onChange={(answer) =>
                  update(
                    'faq',
                    settings.faq.map((x, j) => (i === j ? { ...x, answer } : x)),
                  )
                }
                multiline
              />
            </div>
          ))}
        </section>
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <h2>Mijozlar fikrlari</h2>
            <button
              type="button"
              className="button secondary"
              onClick={() =>
                update('testimonials', [
                  ...settings.testimonials,
                  { id: 'review-' + Date.now(), name: '', text: '', enabled: false },
                ])
              }
            >
              <Plus size={16} />
              Fikr qo‘shish
            </button>
          </div>
          <p className="muted small-text">
            Faqat haqiqiy va tasdiqlangan mijoz fikrlarini rozilik bilan joylang.
          </p>
          {settings.testimonials.map((review, i) => (
            <div className="admin-repeat-item" key={review.id}>
              <button
                type="button"
                className="icon-button"
                onClick={() =>
                  update(
                    'testimonials',
                    settings.testimonials.filter((_, j) => i !== j),
                  )
                }
                aria-label="Fikrni o‘chirish"
              >
                <Trash2 size={17} />
              </button>
              <label>
                Mijoz ismi
                <input
                  value={review.name}
                  required
                  onChange={(e) =>
                    update(
                      'testimonials',
                      settings.testimonials.map((x, j) =>
                        i === j ? { ...x, name: e.target.value } : x,
                      ),
                    )
                  }
                />
              </label>
              <label>
                Fikri
                <textarea
                  value={review.text}
                  required
                  rows={3}
                  onChange={(e) =>
                    update(
                      'testimonials',
                      settings.testimonials.map((x, j) =>
                        i === j ? { ...x, text: e.target.value } : x,
                      ),
                    )
                  }
                />
              </label>
              <Toggle
                label="Saytda ko‘rsatish"
                checked={review.enabled}
                onChange={(enabled) =>
                  update(
                    'testimonials',
                    settings.testimonials.map((x, j) => (i === j ? { ...x, enabled } : x)),
                  )
                }
              />
            </div>
          ))}
        </section>
        <section className="admin-panel">
          <h2>Telegram bildirishnomalari</h2>
          <div className="telegram-status">
            <ShieldCheck size={25} />
            <div>
              <strong>
                {data?.telegramConfigured
                  ? 'Bot tokeni serverda sozlangan'
                  : 'Bot tokeni hali sozlanmagan'}
              </strong>
              <p>Qabul qiluvchi: {data?.recipient}</p>
            </div>
          </div>
          <p className="muted">
            Xavfsizlik uchun token va qabul qiluvchi faqat serverning TELEGRAM_BOT_TOKEN va
            TELEGRAM_CHAT_ID o‘zgaruvchilarida saqlanadi. Administrator botni ochib /start bosishi
            kerak. Barcha xabarlar o‘zbek tilida.
          </p>
          <div className="form-actions">
            <button
              type="button"
              className="button secondary"
              disabled={telegramBusy || !data?.telegramConfigured}
              onClick={() => telegram('verify')}
            >
              <ShieldCheck size={16} />
              Ulanishni tekshirish
            </button>
            <button
              type="button"
              className="button secondary"
              disabled={telegramBusy || !data?.telegramConfigured}
              onClick={() => telegram('test')}
            >
              <Send size={16} />
              Sinov xabari
            </button>
          </div>
          {telegramResult && (
            <p role="status" className="small-text">
              {telegramResult}
            </p>
          )}
        </section>
        <AdminError error={formError} />
        {success && (
          <div className="success-note" role="status">
            {success}
          </div>
        )}
        <div className="sticky-actions">
          <SaveButton busy={busy} />
        </div>
      </form>
    </>
  );
}
