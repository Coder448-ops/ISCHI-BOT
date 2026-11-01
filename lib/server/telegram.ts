import type { Order } from '../types';
import { groupNumber, unitLabel } from '../money';
export function telegramConfig() {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim() || '@Navroz0909';
  return token ? { token, chatId } : null;
}
export function orderMessage(order: Order, kind: 'new' | 'status' | 'cancel') {
  const heading =
    kind === 'new'
      ? '🛒 Yangi buyurtma!'
      : kind === 'cancel'
        ? '❌ Buyurtma bekor qilindi'
        : `🔄 Buyurtma holati: ${order.status}`;
  return `${heading}\n\n👤 Ism: ${order.customerName}\n📞 Telefon: ${order.phone}\n\n📦 Mahsulotlar:\n${order.items.map((i) => `• ${i.name} — ${groupNumber(i.quantity)} ${unitLabel(i.unit, 'uz')}`).join('\n')}${order.discount ? `\n🏷 Chegirma: ${groupNumber(order.discount)} so‘m` : ''}\n\n💰 Jami: ${groupNumber(order.total)} so‘m`;
}
async function call(method: string, body?: Record<string, unknown>) {
  const config = telegramConfig();
  if (!config) return { kind: 'missing' as const, error: 'Bot tokeni sozlanmagan.' };
  try {
    const response = await fetch(`https://api.telegram.org/bot${config.token}/${method}`, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    });
    const result = (await response.json()) as {
      ok?: boolean;
      result?: Record<string, unknown>;
      description?: string;
      parameters?: { retry_after?: number };
    };
    if (response.ok && result.ok) return { kind: 'sent' as const, result: result.result };
    if (response.status === 429 || response.status === 400 || response.status === 403)
      return {
        kind: 'retry' as const,
        error: 'Telegram xabarni qabul qilmadi. Bot va qabul qiluvchi sozlamalarini tekshiring.',
        delayMs: Math.min(3600, result.parameters?.retry_after || 60) * 1000,
      };
    return {
      kind: 'uncertain' as const,
      error: 'Telegram javobi noaniq. Avval chatni tekshiring.',
    };
  } catch {
    return {
      kind: 'uncertain' as const,
      error: 'Telegram javobi noaniq. Takroriy xabar oldini olish uchun tekshiruv kutilmoqda.',
    };
  }
}
export async function sendOrderMessage(message: string) {
  const config = telegramConfig();
  if (!config) return { kind: 'missing' as const, error: 'Bot tokeni sozlanmagan.' };
  return call('sendMessage', {
    chat_id: config.chatId,
    text: message,
    link_preview_options: { is_disabled: true },
  });
}
export async function verifyTelegram() {
  if (!telegramConfig()) throw new Error('Bot tokeni sozlanmagan.');
  const bot = await call('getMe');
  if (bot.kind !== 'sent') throw new Error('Bot tokenini tekshiring.');
  const chat = await call('getChat', { chat_id: telegramConfig()!.chatId });
  if (chat.kind !== 'sent')
    throw new Error('Qabul qiluvchi topilmadi. Administrator botni ochib /start bosishi kerak.');
  const username = typeof chat.result?.username === 'string' ? '@' + chat.result.username : null;
  return { botUsername: bot.result?.username, chatId: chat.result?.id, username, verified: true };
}
