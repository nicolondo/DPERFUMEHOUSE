'use client';

import { useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const subscribe = useCallback(async () => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    try {
      // Get VAPID public key
      const { data } = await api.get<{ publicKey: string }>('/push/vapid-public-key');
      if (!data.publicKey) return;

      // Register service worker
      const reg = await navigator.serviceWorker.register('/sw-push.js', { scope: '/' });
      await navigator.serviceWorker.ready;

      // Check permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;

      // Check if already subscribed
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        // Re-send to server in case it was lost
        await sendSubscriptionToServer(existing);
        return;
      }

      // Subscribe
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.publicKey),
      });

      await sendSubscriptionToServer(subscription);
    } catch (err) {
      console.warn('[Push] Could not subscribe:', err);
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw-push.js');
      if (!reg) return;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await api.delete('/push/unsubscribe', { data: { endpoint: sub.endpoint } });
        await sub.unsubscribe();
      }
    } catch (err) {
      console.warn('[Push] Could not unsubscribe:', err);
    }
  }, []);

  useEffect(() => {
    subscribe();
  }, [subscribe]);

  return { subscribe, unsubscribe };
}

async function sendSubscriptionToServer(subscription: PushSubscription) {
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;
  try {
    await api.post('/push/subscribe', {
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    });
  } catch (err) {
    console.warn('[Push] Failed to send subscription to server:', err);
  }
}
