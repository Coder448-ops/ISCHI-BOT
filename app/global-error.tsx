'use client';
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="uz">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: 24,
          background: '#f5f5f2',
          color: '#202322',
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
        }}
      >
        <div>
          <h1 style={{ fontSize: 26, margin: '0 0 10px' }}>Texnik xatolik yuz berdi</h1>
          <p style={{ color: '#5c635e', margin: '0 0 18px' }}>
            Sahifani qayta yuklang. Muammo takrorlansa, server holatini tekshiring.
          </p>
          <button
            onClick={reset}
            style={{
              border: 0,
              borderRadius: 6,
              padding: '12px 22px',
              background: '#e76f32',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Qayta urinish
          </button>
          <p style={{ marginTop: 14 }}>
            <a href="/api/health" style={{ color: '#e76f32' }}>
              Server holati
            </a>
          </p>
          {error.digest && <small style={{ color: '#8a908b' }}>Xato kodi: {error.digest}</small>}
        </div>
      </body>
    </html>
  );
}
