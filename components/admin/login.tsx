'use client';
import { useState, type FormEvent } from 'react';
import { LockKeyhole, ArrowRight } from 'lucide-react';
export function AdminLogin() {
  const [username, setUsername] = useState(''),
    [password, setPassword] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      window.location.assign('/admin');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ulanishda xatolik.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="admin-login-form">
      <label>
        Administrator logini
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          required
          maxLength={100}
        />
      </label>
      <label>
        Parol
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          maxLength={256}
        />
      </label>
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      <button className="button primary full-width" disabled={busy}>
        <LockKeyhole size={17} />
        {busy ? 'Tekshirilmoqda...' : 'Panelga kirish'}
        <ArrowRight size={17} />
      </button>
    </form>
  );
}
