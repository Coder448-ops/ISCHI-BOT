'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  ShoppingBag,
  UserRound,
} from 'lucide-react';
export default function AdminLogin() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Kirishda xatolik yuz berdi.');
      setPassword('');
      router.replace('/admin');
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Ulanishda xatolik. Qayta urinib ko‘ring.');
      setBusy(false);
    }
  }
  return (
    <div className="admin-login-page">
      <section className="login-story">
        <Link className="logo logo-light" href="/">
          <span className="logo-symbol">
            <ShoppingBag size={22} />
          </span>
          <span>
            ishchi<span className="logo-dot">.</span>
          </span>
        </Link>
        <div className="login-story-content">
          <div className="eyebrow">ADMINISTRATOR UCHUN</div>
          <h1>
            Har bir buyurtma.
            <br />
            O‘z nazoratingizda.
          </h1>
          <p>
            Buyurtmalarni ko‘ring, holatini yangilang va mijozlaringizga o‘z vaqtida xizmat
            ko‘rsating.
          </p>
        </div>
        <div className="login-story-footer">
          <ShieldCheck size={16} /> Faqat administratorlar uchun himoyalangan kirish
        </div>
      </section>
      <main className="login-form-side">
        <div className="login-card">
          <div className="login-icon">
            <LockKeyhole size={25} />
          </div>
          <h2>Xush kelibsiz!</h2>
          <p>
            Buyurtmalarni boshqarish uchun
            <br />
            administrator ma’lumotlari bilan kiring.
          </p>
          <form onSubmit={submit}>
            <div className="form-field">
              <label htmlFor="admin-username">Administrator logini</label>
              <div className="input-wrap">
                <UserRound size={18} />
                <input
                  id="admin-username"
                  name="username"
                  autoComplete="username"
                  placeholder="Loginingizni kiriting"
                  required
                  maxLength={100}
                  value={username}
                  disabled={busy}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>
            <div className="form-field">
              <label htmlFor="admin-password">Parol</label>
              <div className="input-wrap">
                <LockKeyhole size={18} />
                <input
                  id="admin-password"
                  name="password"
                  type={visible ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Parolingizni kiriting"
                  required
                  maxLength={256}
                  value={password}
                  disabled={busy}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="password-toggle"
                  aria-label={visible ? 'Parolni yashirish' : 'Parolni ko‘rsatish'}
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>
            {error && (
              <div className="error-banner" role="alert" style={{ marginBottom: 17 }}>
                {error}
              </div>
            )}
            <button className="button button-primary full-width" disabled={busy} type="submit">
              {busy ? (
                <>
                  <LoaderCircle size={18} className="spin" /> Tekshirilmoqda...
                </>
              ) : (
                <>
                  Panelga kirish <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
          <Link href="/" className="login-back">
            <ArrowLeft size={15} /> Do‘konga qaytish
          </Link>
          <p className="login-help">
            Bu kirish faqat administrator uchun. Xarid qilish uchun hisob yoki parol kerak emas.
          </p>
        </div>
      </main>
    </div>
  );
}
