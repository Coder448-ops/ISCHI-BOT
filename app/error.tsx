'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="page-container error-state" style={{ minHeight: '75vh' }}>
      <h1>Texnik xatolik yuz berdi</h1>
      <p>Server bilan ulanishni tekshirib, qayta urinib ko‘ring.</p>
      <button className="button primary" onClick={reset}>
        Qayta urinish
      </button>
      <a className="text-link" href="/">
        Bosh sahifa
      </a>
    </main>
  );
}
