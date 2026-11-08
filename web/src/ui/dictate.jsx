// Dictée vocale (reconnaissance vocale du navigateur : Chrome, Edge, Safari)
import { useRef, useState } from 'react';
import { LuMic, LuMicOff } from 'react-icons/lu';
import { t, getLang } from '../lib/i18n.js';

const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
export const canDictate = !!SR;
const LOC = { fr: 'fr-FR', en: 'en-GB', pt: 'pt-PT', it: 'it-IT' };

export function DictateButton({ onText, className = 'link', style }) {
  const [on, setOn] = useState(false);
  const rec = useRef(null);
  if (!SR) return null;
  const toggle = () => {
    if (on) { rec.current?.stop(); return; }
    const r = new SR(); rec.current = r;
    r.lang = LOC[getLang?.() || 'fr'] || 'fr-FR'; r.interimResults = false; r.continuous = false;
    r.onresult = (e) => { const s = Array.from(e.results).map((x) => x[0].transcript).join(' ').trim(); if (s) onText(s); };
    r.onend = () => setOn(false); r.onerror = () => setOn(false);
    r.start(); setOn(true);
  };
  return <button type="button" className={className + (on ? ' rec' : '')} style={style} onMouseDown={(e) => e.preventDefault()} onClick={toggle} aria-label={on ? t('Arrêter la dictée') : t('Dicter')} title={on ? t('Arrêter la dictée') : t('Dicter')}>{on ? <LuMicOff /> : <LuMic />}</button>;
}
