// Statistiques de la fiche publique : vues, clics « Appeler », partages, demandes reçues, taux et délai de réponse (30 derniers jours)
import { LuEye, LuPhone, LuShare2, LuCalendarPlus, LuHeart, LuTimer } from 'react-icons/lu';
import { api } from '../../lib/api.js';
import { t } from '../../lib/i18n.js';
import { useData, Loader } from '../../ui/index.jsx';

const delay = (m) => (m == null ? '—' : m < 60 ? t('{n} min', { n: Math.max(1, Math.round(m)) }) : m < 1440 ? t('{n} h', { n: Math.round(m / 60) }) : t('{n} j', { n: Math.round(m / 1440) }));

export function ProfileStats({ days = 30, compact = false }) {
  const [s] = useData(() => api.rpc('my_profile_stats', { p_days: days }).then((x) => x || { none: true }, () => ({ none: true })), [days]);
  if (!s) return compact ? null : <Loader />;
  if (s.none) return null;
  const rate = s.requests ? Math.round((s.answered / s.requests) * 100) : null;
  const tiles = [
    [LuEye, t('Vues de la fiche'), s.views],
    [LuPhone, t('Clics « Appeler »'), s.calls],
    [LuCalendarPlus, t('Demandes reçues'), s.requests],
    [LuTimer, t('Taux de réponse'), rate == null ? '—' : rate + ' %'],
    ...(compact ? [] : [[LuShare2, t('Partages'), s.shares], [LuHeart, t('Dans les sélections'), s.favorites], [LuTimer, t('Délai de réponse moyen'), delay(s.response_minutes)]]),
  ];
  const daily = s.daily || [];
  const max = Math.max(1, ...daily.map((d) => d.views));
  return (
    <div className="pstats">
      <div className="pstats-grid">{tiles.map(([I, l, v]) => <div key={l} className="pstat"><I aria-hidden /><b>{v}</b><span>{l}</span></div>)}</div>
      {!compact && daily.length > 1 && <div className="pstats-bars" role="img" aria-label={t('Vues par jour sur {n} jours', { n: days })}>{daily.map((d) => <i key={d.day} style={{ height: Math.max(3, (d.views / max) * 48) }} title={d.day + ' · ' + d.views} />)}</div>}
      <p className="small faint">{t('Sur les {n} derniers jours. Vos propres visites ne sont pas comptées.', { n: days })}</p>
    </div>
  );
}
