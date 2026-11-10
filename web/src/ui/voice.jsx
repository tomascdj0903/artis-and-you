// Messages vocaux : enregistrement au micro (MediaRecorder) et lecteur avec forme d'onde, comme sur WhatsApp
import { useEffect, useRef, useState } from 'react';
import { LuMic, LuPlay, LuPause, LuTrash2, LuSend, LuLoader } from 'react-icons/lu';
import { fileUrls, cachedUrl } from '../lib/api.js';
import { t } from '../lib/i18n.js';

export const canRecord = typeof window !== 'undefined' && !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
// mp4/AAC d'abord : lisible partout (iPhone compris) ; sinon webm/ogg (Opus)
const TYPES = ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
const pickType = () => TYPES.find((x) => { try { return MediaRecorder.isTypeSupported(x); } catch { return false; } }) || '';
const MAX = 180; // 3 minutes
const BARS = 40;
export const mmss = (s) => { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

// Réduit les niveaux relevés pendant l'enregistrement à 40 barres entre 0.08 et 1
function shrink(levels) {
  if (!levels.length) return Array(BARS).fill(0.15);
  const out = [];
  for (let i = 0; i < BARS; i++) {
    const a = Math.floor((i * levels.length) / BARS), b = Math.max(a + 1, Math.floor(((i + 1) * levels.length) / BARS));
    out.push(Math.max(...levels.slice(a, b)));
  }
  const top = Math.max(...out, 0.01);
  return out.map((v) => Math.round(Math.max(0.08, v / top) * 100) / 100);
}

// Barre d'enregistrement : démarre dès l'affichage, « Envoyer » renvoie { file, duration, wave }
export function VoiceRecorder({ onSend, onCancel, onError }) {
  const [sec, setSec] = useState(0);
  const [live, setLive] = useState([]);
  const st = useRef({});
  useEffect(() => {
    let dead = false;
    const s = st.current;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        if (dead) { stream.getTracks().forEach((x) => x.stop()); return; }
        s.stream = stream; s.chunks = []; s.levels = [];
        const type = pickType();
        const rec = new MediaRecorder(stream, type ? { mimeType: type, audioBitsPerSecond: 48000 } : undefined);
        s.rec = rec;
        rec.ondataavailable = (e) => e.data.size && s.chunks.push(e.data);
        rec.start(250);
        s.t0 = Date.now();
        try {
          const ctx = new (window.AudioContext || window.webkitAudioContext)(); s.ctx = ctx;
          const an = ctx.createAnalyser(); an.fftSize = 512; ctx.createMediaStreamSource(stream).connect(an);
          const buf = new Uint8Array(an.fftSize);
          s.meter = setInterval(() => {
            an.getByteTimeDomainData(buf);
            let sum = 0; for (const v of buf) sum += ((v - 128) / 128) ** 2;
            const lv = Math.min(1, Math.sqrt(sum / buf.length) * 4);
            s.levels.push(lv); setLive((l) => [...l.slice(-29), lv]);
          }, 100);
        } catch { /* pas de forme d'onde, l'enregistrement continue */ }
        s.tick = setInterval(() => {
          const v = (Date.now() - s.t0) / 1000; setSec(v);
          if (v >= MAX) finish(true);
        }, 200);
      } catch (e) {
        onError?.(e?.name === 'NotAllowedError' ? t('Autorisez l’accès au micro pour enregistrer un vocal.') : t('Micro indisponible sur cet appareil.'));
      }
    })();
    return () => { dead = true; stop(); };
  }, []);
  const stop = () => {
    const s = st.current;
    clearInterval(s.tick); clearInterval(s.meter);
    const c = s.ctx; s.ctx = null; if (c && c.state !== 'closed') c.close().catch(() => {});
    s.stream?.getTracks().forEach((x) => x.stop());
  };
  const finish = (send) => {
    const s = st.current;
    if (s.done) return; s.done = true;
    const duration = (Date.now() - (s.t0 || Date.now())) / 1000;
    if (!s.rec || s.rec.state === 'inactive') { stop(); onCancel(); return; }
    s.rec.onstop = () => {
      stop();
      if (!send || duration < 0.8) { if (send) onError?.(t('Vocal trop court : appuyez sur le micro et parlez.')); onCancel(); return; }
      const mime = (s.rec.mimeType || s.chunks[0]?.type || 'audio/webm').split(';')[0];
      const ext = mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm';
      const blob = new Blob(s.chunks, { type: mime });
      const name = t('Message vocal') + ' ' + new Date().toLocaleTimeString().slice(0, 5).replace(':', 'h') + '.' + ext;
      onSend({ file: new File([blob], name, { type: mime }), duration: Math.round(duration * 10) / 10, wave: shrink(s.levels) });
    };
    s.rec.stop();
  };
  return (
    <div className="composer vrec" role="group" aria-label={t('Enregistrement d’un message vocal')}>
      <button type="button" className="att" onClick={() => finish(false)} aria-label={t('Annuler le vocal')}><LuTrash2 /></button>
      <div className="vrec-mid">
        <span className="vrec-dot" />
        <b className="vrec-time">{mmss(sec)}</b>
        <div className="vrec-wave" aria-hidden="true">{live.map((v, i) => <i key={i} style={{ height: Math.max(3, v * 26) }} />)}</div>
        {sec > MAX - 15 && <small className="muted">{t('max. 3 min')}</small>}
      </div>
      <button type="button" className="send" onClick={() => finish(true)} aria-label={t('Envoyer le vocal')}><LuSend /></button>
    </div>
  );
}

// Un seul vocal lu à la fois dans toute l'appli
let playing = null;

export function VoiceNote({ att, mine }) {
  const [url, setUrl] = useState(cachedUrl(att.path));
  const [on, setOn] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(att.duration || 0);
  const [rate, setRate] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const au = useRef(null);
  const wave = att.wave?.length ? att.wave : Array(BARS).fill(0.3);
  useEffect(() => () => { au.current?.pause(); }, []);
  const ensure = async () => {
    if (au.current) return au.current;
    setBusy(true);
    let u = url;
    if (!u) { u = (await fileUrls([att.path]).catch(() => ({})))[att.path]; setUrl(u); }
    setBusy(false);
    if (!u) { setErr(true); return null; }
    const a = new Audio(u); a.preload = 'auto'; a.playbackRate = rate;
    a.ontimeupdate = () => setPos(a.currentTime);
    a.onloadedmetadata = () => { if (isFinite(a.duration) && a.duration > 0) setDur(a.duration); };
    a.onended = () => { setOn(false); setPos(0); if (playing === a) playing = null; };
    a.onpause = () => setOn(false); a.onplay = () => setOn(true);
    a.onerror = () => { setErr(true); setOn(false); };
    au.current = a; return a;
  };
  const toggle = async () => {
    const a = await ensure(); if (!a) return;
    if (!a.paused) { a.pause(); return; }
    if (playing && playing !== a) playing.pause();
    playing = a;
    a.play().catch(() => setErr(true));
  };
  const seek = async (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const a = await ensure(); if (!a) return;
    const d = isFinite(a.duration) && a.duration > 0 ? a.duration : dur;
    a.currentTime = f * d; setPos(a.currentTime);
  };
  const speed = () => { const n = rate === 1 ? 1.5 : rate === 1.5 ? 2 : 1; setRate(n); if (au.current) au.current.playbackRate = n; };
  const p = dur ? pos / dur : 0;
  return (
    <div className={'vnote' + (mine ? ' r' : '')}>
      <button type="button" className="vplay" onClick={toggle} aria-label={on ? t('Pause') : t('Écouter le message vocal')}>{busy ? <LuLoader className="spin" /> : on ? <LuPause /> : <LuPlay />}</button>
      <div className="vbody">
        <div className="vwave" onClick={seek} role="slider" aria-label={t('Position')} aria-valuemin={0} aria-valuemax={Math.round(dur)} aria-valuenow={Math.round(pos)} tabIndex={0}
          onKeyDown={(e) => { if (au.current && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) au.current.currentTime += e.key === 'ArrowRight' ? 5 : -5; }}>
          {wave.map((v, i) => <i key={i} className={i / wave.length < p ? 'on' : ''} style={{ height: Math.max(4, v * 26) }} />)}
        </div>
        <div className="vmeta">
          <span>{err ? t('Lecture impossible') : mmss(on || pos ? pos : dur)}</span>
          <button type="button" className="vrate" onClick={speed} aria-label={t('Vitesse de lecture')}>{rate}×</button>
        </div>
      </div>
      <LuMic className="vmic" aria-hidden="true" />
    </div>
  );
}
