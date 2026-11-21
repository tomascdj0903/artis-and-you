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
// « 1 photos ajoutées » → « 1 photo ajoutée » : mots au pluriel juste après {n} (fr, en, pt ; l'italien a ses propres pluriels)
const SAME = new Set(['avis', 'mois', 'fois', 'temps', 'frais', 'prix', 'devis', 'news', 'cvs']);
const KEEP = new Set(['pas', 'sans', 'plus', 'mais', 'dans', 'vous', 'nous', 'les', 'des', 'aux', 'ses', 'mes', 'tes', 'ces', 'is', 'was', 'has', 'as', 'its', 'us', 'this', 'mês', 'vez', 'deus', 'mais', 'os', 'as']);
function singular(str) {
  if (lang === 'it') return str;
  return str.replace(/\{n\} ([^{}]+)/g, (m, rest) => {
    const w = rest.split(' '); let i = 0;
    for (; i < w.length && (lang === 'fr' || i === 0); i++) {
      const x = w[i], b = x.replace(/[.,;:!?…»)]+$/, ''), tail = x.slice(b.length);
      if (SAME.has(b.toLowerCase())) continue;
      if (!/[a-zà-ÿ]s$/.test(b) || /ss$/.test(b) || KEEP.has(b.toLowerCase())) break;
      w[i] = b.slice(0, -1) + tail;
    }
    return '{n} ' + w.join(' ');
  });
}
export function t(s, vars) {
  let out = (lang !== 'fr' && dicts[lang]?.[s]) || s;
  if (vars && Number(vars.n) === 1 && out.includes('{n} ')) out = singular(out);
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.split('{' + k + '}').join(v);
  return out;
}
export const locale = () => ({ fr: 'fr-FR', en: 'en-GB', pt: 'pt-PT', it: 'it-IT' }[lang] || 'fr-FR');
