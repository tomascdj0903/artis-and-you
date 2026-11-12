// Bandeau « Hors ligne » : lecture du dernier état connu, messages mis en attente
import { useEffect, useState } from 'react';
import { LuWifiOff } from 'react-icons/lu';
import { isOffline, onNetwork, queued } from '../lib/offline.js';
import { t } from '../lib/i18n.js';

export function OfflineBanner() {
  const [off, setOff] = useState(isOffline());
  const [n, setN] = useState(0);
  useEffect(() => {
    const count = () => queued((q) => q.table === 'messages').then((l) => setN(l.length)).catch(() => {});
    count();
    return onNetwork((o) => { setOff(o); count(); });
  }, []);
  if (!off && !n) return null;
  return (
    <div className="offline-bar" role="status">
      <LuWifiOff size={14} />
      {off ? t('Hors ligne : vous consultez les dernières données reçues.') : t('Connexion rétablie.')}
      {n > 0 && ' ' + t('{n} message(s) en attente d’envoi.', { n })}
    </div>
  );
}
