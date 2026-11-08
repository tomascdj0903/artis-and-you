import { api, uid, OFFLINE } from './api.js';

// Abonnement Web Push : les notifications arrivent même application fermée (ordinateur, Android, iPhone si l'app est installée)
export async function subscribePush() {
  if (OFFLINE || !('serviceWorker' in navigator) || !('PushManager' in window) || Notification.permission !== 'granted') return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const key = await api.rpc('vapid_public_key', {});
      const raw = Uint8Array.from(atob(key.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - key.length % 4) % 4)), (c) => c.charCodeAt(0));
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: raw });
    }
    const j = sub.toJSON();
    await api.upsert('push_subscriptions', { endpoint: j.endpoint, user_id: uid(), p256dh: j.keys.p256dh, auth: j.keys.auth });
    return true;
  } catch (e) { console.warn('push', e); return false; }
}
