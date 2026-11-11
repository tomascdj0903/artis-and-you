// Champ mot de passe avec jauge de force (faible / moyen / fort) et refus des mots de passe trop évidents
import { useState } from 'react';
import { LuEye, LuEyeOff } from 'react-icons/lu';
import { Field } from './index.jsx';
import { t } from '../lib/i18n.js';

// Les plus courants en France (toutes les variantes de casse sont couvertes par la normalisation)
const COMMON = ['123456', '1234567', '12345678', '123456789', '1234567890', '111111', '11111111', '00000000', 'password', 'password1', 'motdepasse', 'motdepasse1', 'azerty', 'azerty123', 'azertyuiop', 'qwerty', 'qwerty123', 'qwertyuiop', 'abc123', 'abcd1234', 'soleil', 'soleil1', 'bonjour', 'bonjour1', 'marseille', 'doudou', 'loulou', 'chouchou', 'iloveyou', 'welcome', 'admin', 'letmein', 'artesa', 'artesa123', 'artisan', 'artisan1'];
const SEQ = 'abcdefghijklmnopqrstuvwxyz0123456789azertyuiopqsdfghjklmwxcvbn';

// Renvoie { score: 0..3, label, ok } ; ok = acceptable à l'inscription (8 caractères, un chiffre, pas trop évident)
export function pwStrength(pw) {
  const p = pw || '';
  const low = p.toLowerCase().replace(/[^a-z0-9]/g, '');
  const common = COMMON.includes(low) || COMMON.some((c) => low.startsWith(c) && low.length - c.length <= 2);
  const repeated = /^(.)\1+$/.test(p);
  const sequence = low.length >= 6 && (SEQ.includes(low) || SEQ.includes([...low].reverse().join('')));
  const obvious = common || repeated || sequence;
  const long = p.length >= 8, digit = /\d/.test(p);
  let score = 0;
  if (long && digit && !obvious) {
    score = 1;
    const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(p)).length;
    if (p.length >= 10 && kinds >= 3) score = 2;
    if (p.length >= 12 && kinds >= 3) score = 3;
  }
  const label = !p ? '' : score === 0 ? t('Faible') : score === 1 ? t('Correct') : score === 2 ? t('Bon') : t('Fort');
  return { score, label, ok: score >= 1, obvious };
}

// Message d'erreur à afficher à l'envoi du formulaire, ou '' si le mot de passe convient
export function pwError(pw) {
  const s = pwStrength(pw);
  if (s.ok) return '';
  if ((pw || '').length < 8 || !/\d/.test(pw || '')) return t('Le mot de passe doit contenir au moins 8 caractères, dont un chiffre.');
  return t('Ce mot de passe est trop facile à deviner : choisissez-en un autre.');
}

export function PasswordField({ value, onChange, label, hint, autoComplete = 'new-password', ...rest }) {
  const [show, setShow] = useState(false);
  const s = pwStrength(value);
  return (
    <Field label={label || t('Mot de passe')} hint={hint ?? t('8 caractères minimum, dont un chiffre')}>
      <div className="pw-wrap">
        <input type={show ? 'text' : 'password'} value={value} onChange={onChange} required minLength={8} autoComplete={autoComplete} {...rest} />
        <button type="button" className="pw-eye" onClick={() => setShow(!show)} aria-label={show ? t('Masquer le mot de passe') : t('Afficher le mot de passe')}>{show ? <LuEyeOff /> : <LuEye />}</button>
      </div>
      {value && (
        <div className={'pw-meter s' + s.score} role="status" aria-live="polite">
          <div className="pw-bars" aria-hidden="true"><i /><i /><i /></div>
          <small>{s.label}{s.score === 0 && s.obvious ? ' · ' + t('trop facile à deviner') : ''}</small>
        </div>
      )}
    </Field>
  );
}
