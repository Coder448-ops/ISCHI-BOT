'use client';
import { useEffect, useState } from 'react';
const staleChunk =
  /ChunkLoadError|Loading chunk|dynamically imported module|Importing a module script failed/i;
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [recovering, setRecovering] = useState(false);
  useEffect(() => {
    // A new deploy replaces hashed JS chunks; one silent reload picks up the new build.
    if (!staleChunk.test(`${error.name} ${error.message}`)) return;
    try {
      const key = 'ischi-chunk-reload';
      const last = Number(sessionStorage.getItem(key) || 0);
      if (Date.now() - last < 10000) return;
      sessionStorage.setItem(key, String(Date.now()));
      setRecovering(true);
      window.location.reload();
    } catch {
      /* Storage disabled: the manual button below is still available. */
    }
  }, [error]);
  return (
    <main className="page-container error-state" style={{ minHeight: '75vh' }}>
      <h1>{recovering ? 'Sahifa yangilanmoqda…' : 'Texnik xatolik yuz berdi'}</h1>
      <p>
        {recovering
          ? 'Saytning yangi versiyasi yuklanmoqda. Bir necha soniya kuting.'
          : 'Sahifani qayta yuklang. Muammo takrorlansa, server holatini tekshiring.'}
      </p>
      <button className="button primary" onClick={reset}>
        Qayta urinish
      </button>
      <a className="text-link" href="/api/health" target="_blank" rel="noreferrer">
        Server holati
      </a>
      <a className="text-link" href="/">
        Bosh sahifa
      </a>
      {error.digest && <small className="error-digest">Xato kodi: {error.digest}</small>}
    </main>
  );
}
