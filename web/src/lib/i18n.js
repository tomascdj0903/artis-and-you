// Traductions : le texte français sert de clé ; les autres langues le traduisent.
export const LANGS = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
  { code: 'pt', label: 'Português' },
  { code: 'it', label: 'Italiano' },
];
const dicts = {};
const loaders = { en: () => import('../i18n/en.js'), pt: () => import('../i18n/pt.js'), it: () => import('../i18n/it.js') };
// Charge le dictionnaire d'une langue à la demande (le français est intégré)
export async function loadLang(l) { if (l !== 'fr' && !dicts[l] && loaders[l]) dicts[l] = (await loaders[l]()).default; }
let lang = (() => { try { return localStorage.getItem('ay-lang') || 'fr'; } catch { return 'fr'; } })();
export const getLang = () => lang;
export function setLang(l) { lang = l; try { localStorage.setItem('ay-lang', l); } catch {} document.documentElement.lang = l; }
export function t(s, vars) {
  let out = (lang !== 'fr' && dicts[lang]?.[s]) || s;
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.split('{' + k + '}').join(v);
  return out;
}
export const locale = () => ({ fr: 'fr-FR', en: 'en-GB', pt: 'pt-PT', it: 'it-IT' }[lang] || 'fr-FR');
