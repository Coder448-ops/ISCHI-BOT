import type { Order } from '../format';
import { money } from '../format';

export function telegramConfig() {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  return token && chatId ? { token, chatId } : null;
}
export function orderMessage(order: Order, kind: 'new' | 'status' | 'cancel') {
  const heading =
    kind === 'new'
      ? '🛍 Yangi buyurtma!'
      : kind === 'cancel'
        ? '❌ Buyurtma bekor qilindi.'
        : `🔄 Buyurtma holati: ${order.status}`;
  const lines = [heading, `👤 Ism: ${order.customerName}`, `📞 Telefon: ${order.phone}`];
  if (order.items.length === 1) {
    lines.push(`📦 Mahsulot: ${order.items[0].name}`, `🔢 Soni: ${order.items[0].quantity} ta`);
  } else {
    lines.push(
      '📦 Mahsulotlar:',
      ...order.items.map((item) => `• ${item.name} — ${item.quantity} ta`),
    );
  }
  lines.push(`💰 Jami: ${money(order.total)}`);
  return lines.join('\n');
}
export type DeliveryResult = {
  kind: 'sent' | 'retry' | 'failed' | 'uncertain';
  delayMs?: number;
  error?: string;
};
export async function sendTelegram(message: string): Promise<DeliveryResult> {
  const config = telegramConfig();
  if (!config) return { kind: 'retry', delayMs: 30000, error: 'Telegram sozlamalari kutilmoqda.' };
  try {
    const response = await fetch(`https://api.telegram.org/bot${config.token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: config.chatId,
        text: message,
        link_preview_options: { is_disabled: true },
      }),
      signal: AbortSignal.timeout(10000),
      redirect: 'manual',
      cache: 'no-store',
    });
    if (response.ok) {
      const result = (await response.json()) as { ok?: boolean };
      return result.ok === true
        ? { kind: 'sent' }
        : {
            kind: 'uncertain',
            error:
              'Telegram javobi noaniq. Xabar administrator Telegram chatida tekshirilishi kerak.',
          };
    }
    if (response.status === 429) {
      const result = (await response.json().catch(() => ({}))) as {
        parameters?: { retry_after?: number };
      };
      return {
        kind: 'retry',
        delayMs: Math.min(3600, Math.max(1, result.parameters?.retry_after || 30)) * 1000,
        error: 'Telegram vaqtinchalik band. Xabar navbatda.',
      };
    }
    if (response.status >= 500 || response.status === 408)
      return { kind: 'uncertain', error: 'Telegram javobi noaniq. Takroriy xabar yuborilmadi.' };
    return {
      kind: 'failed',
      error:
        response.status === 403 || response.status === 400
          ? 'Telegram chatini tekshiring: administrator botni ishga tushirgan bo‘lishi kerak.'
          : 'Telegram token yoki chat ma’lumotlarini tekshiring.',
    };
  } catch {
    // A timeout does not prove rejection. Never blindly resend an accepted message.
    return {
      kind: 'uncertain',
      error: 'Telegram javobi noaniq. Takroriy xabarni oldini olish uchun to‘xtatildi.',
    };
  }
}
