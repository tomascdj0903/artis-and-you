// Traductions : le texte français sert de clé ; les autres langues le traduisent.
import en from '../i18n/en.js';
import pt from '../i18n/pt.js';
import it from '../i18n/it.js';
export const LANGS = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
  { code: 'pt', label: 'Português' },
  { code: 'it', label: 'Italiano' },
];
const dicts = { en, pt, it };
let lang = (() => { try { return localStorage.getItem('ay-lang') || 'fr'; } catch { return 'fr'; } })();
export const getLang = () => lang;
export function setLang(l) { lang = l; try { localStorage.setItem('ay-lang', l); } catch {} document.documentElement.lang = l; }
export function t(s, vars) {
  let out = (lang !== 'fr' && dicts[lang]?.[s]) || s;
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.split('{' + k + '}').join(v);
  return out;
}
export const locale = () => ({ fr: 'fr-FR', en: 'en-GB', pt: 'pt-PT', it: 'it-IT' }[lang] || 'fr-FR');
