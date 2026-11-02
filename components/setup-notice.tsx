/**
 * Shown when the site is hosted somewhere without a durable disk (for example Vercel)
 * and `API_ORIGIN` is not configured yet. The shop cannot serve data in that state,
 * so explain the fix instead of showing a raw server error.
 */
export function SetupNotice({ missing }: { missing: 'api-origin' | 'storage' }) {
  return (
    <main className="setup-notice">
      <div className="setup-card">
        <span className="eyebrow">SOZLASH KERAK</span>
        <h1>Sayt hali ma’lumot serveriga ulanmagan</h1>
        <p>
          Bu hostingda doimiy disk yo‘q, shuning uchun mahsulotlar va buyurtmalar shu yerda
          saqlanmaydi. Hech qanday buyurtma yo‘qolmadi — hozircha ma’lumot manbasi ko‘rsatilmagan.
        </p>
        <ol>
          <li>
            JSON omborini doimiy diskli serverda ishga tushiring (Docker + Caddy, VPS yoki doimiy
            volume berilgan hosting).
          </li>
          <li>
            Shu loyihaning Environment Variables bo‘limiga <code>API_ORIGIN</code> qiymatini
            qo‘shing, masalan <code>https://api.mening-dokonim.uz</code>. Faqat origin yoziladi:
            oxirida <code>/</code> yoki <code>/api</code> bo‘lmaydi.
          </li>
          <li>
            API serverda <code>PUBLIC_WEB_ORIGIN</code> ga shu saytning manzilini yozing va qayta
            deploy qiling.
          </li>
        </ol>
        <p className="setup-check">
          Tekshirish: <code>/api/health</code> javobi <code>{'{"ok":true,"mode":"proxy"}'}</code>{' '}
          bo‘lishi kerak.
        </p>
        <p className="setup-meta">
          {missing === 'storage'
            ? 'Batafsil: docs/DEPLOYMENT.md — «Vercel UI + doimiy API server».'
            : 'API_ORIGIN hozir bo‘sh yoki noto‘g‘ri.'}
        </p>
      </div>
    </main>
  );
}
