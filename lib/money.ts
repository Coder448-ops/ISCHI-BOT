import type { Language, Unit } from './types';
export function groupNumber(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 })
    .format(value)
    .replace(/,/g, ' ');
}
export function money(value: number, lang: Language = 'uz') {
  return groupNumber(value) + ' ' + { uz: 'so‘m', ru: 'сум', en: 'UZS' }[lang];
}
export function unitLabel(unit: Unit, lang: Language) {
  const labels: Record<Unit, Record<Language, string>> = {
    kg: { uz: 'kg', ru: 'кг', en: 'kg' },
    ton: { uz: 'tonna', ru: 'т', en: 't' },
    m: { uz: 'metr', ru: 'м', en: 'm' },
    'm²': { uz: 'm²', ru: 'м²', en: 'm²' },
    dona: { uz: 'dona', ru: 'шт.', en: 'pcs' },
    qop: { uz: 'qop', ru: 'меш.', en: 'bags' },
  };
  return labels[unit][lang];
}
export function formatDate(value: string | number, lang: Language = 'uz') {
  return new Intl.DateTimeFormat(lang === 'uz' ? 'uz-UZ' : lang === 'ru' ? 'ru-RU' : 'en-GB', {
    timeZone: 'Asia/Tashkent',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
export function formatPhone(raw: string) {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('998')) digits = digits.slice(3);
  digits = digits.slice(0, 9);
  const groups = [
    digits.slice(0, 2),
    digits.slice(2, 5),
    digits.slice(5, 7),
    digits.slice(7, 9),
  ].filter(Boolean);
  return '+998' + (groups.length ? ' ' + groups.join(' ') : raw.length ? ' ' : '');
}
