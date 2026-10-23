import { locale, t } from './i18n.js';
export const money = (n, dec = 2) => new Intl.NumberFormat(locale(), { style: 'currency', currency: 'EUR', minimumFractionDigits: dec, maximumFractionDigits: dec }).format(Number(n) || 0);
export const money0 = (n) => money(n, 0);
export const num = (n, d = 2) => new Intl.NumberFormat(locale(), { maximumFractionDigits: d }).format(Number(n) || 0);
const D = (s) => (s instanceof Date ? s : new Date(s && s.length === 10 ? s + 'T12:00:00' : s));
export const date = (s) => (s ? D(s).toLocaleDateString(locale(), { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');
export const dateLong = (s) => (s ? D(s).toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' }) : '');
export const dateMed = (s) => (s ? D(s).toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' }) : '');
export const dateShort = (s) => (s ? D(s).toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short' }) : '');
export const time = (s) => (s ? D(s).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' }).replace(':', ' h ') : '');
export const hm = (s) => (s ? D(s).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' }) : '');
export const dateTime = (s) => (s ? `${date(s)} ${t('à')} ${hm(s)}` : '—');
export function rel(s) {
  if (!s) return '';
  const d = D(s), n = new Date();
  const days = Math.floor((new Date(n.toDateString()) - new Date(d.toDateString())) / 864e5);
  if (days === 0) return hm(d);
  if (days === 1) return t('Hier');
  if (days < 7) return d.toLocaleDateString(locale(), { weekday: 'short' });
  return d.toLocaleDateString(locale(), { day: '2-digit', month: '2-digit' });
}
export const iso = (d) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };
export const initials = (a = '', b = '') => ((a || '').trim()[0] || '').toUpperCase() + ((b || '').trim()[0] || '').toUpperCase() || '?';
export const fullName = (p) => [p?.first_name, p?.last_name].filter(Boolean).join(' ').trim();
export const clientName = (c) => (!c ? '—' : c.type === 'pro' ? c.trade_name || c.company_name || fullName(c) : fullName(c) || c.company_name || '—');
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const startOfWeek = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); return x; };
export const weekNumber = (d) => { const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = x.getUTCDay() || 7; x.setUTCDate(x.getUTCDate() + 4 - day); const y = new Date(Date.UTC(x.getUTCFullYear(), 0, 1)); return Math.ceil(((x - y) / 864e5 + 1) / 7); };
export const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;
