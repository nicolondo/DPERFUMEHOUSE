'use client';

import { useEffect, useRef } from 'react';
import { requestNotificationPermission, onForegroundMessage } from '@/lib/firebase';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

export function useNotifications() {
  const { isAuthenticated } = useAuthStore();
  const initialized = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || initialized.current) return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    initialized.current = true;

    // Auto-request if already granted, otherwise wait for explicit prompt
    if (Notification.permission === 'granted') {
      registerToken();
    }

    // Listen for foreground messages — show native notification
    onForegroundMessage((payload) => {
      const title = payload.notification?.title || 'D Perfume House';
      const body = payload.notification?.body || '';
      console.log('[Push] Foreground message:', title);

      // Show native notification even when app is in foreground
      if (Notification.permission === 'granted') {
        const n = new Notification(title, {
          body,
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-72x72.png',
        });
        n.onclick = () => {
          window.focus();
          n.close();
        };
      }
    });
  }, [isAuthenticated]);

  async function registerToken() {
    try {
      const token = await requestNotificationPermission();
      if (token) {
        await api.post('/notifications/register-token', {
          token,
          device: navigator.userAgent.includes('Mobile') ? 'mobile' : 'desktop',
        });
        console.log('[Push] Token registered with server');
        return true;
      }
      console.warn('[Push] No token received from Firebase');
      return false;
    } catch (err) {
      console.error('[Push] Failed to register push token:', err);
      return false;
    }
  }

  async function promptPermission() {
    if (typeof window === 'undefined' || !('Notification' in window)) return false;
    if (Notification.permission === 'granted') {
      await registerToken();
      return true;
    }
    if (Notification.permission === 'denied') return false;

    // Ask permission
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      await registerToken();
      return true;
    }
    return false;
  }

  return { promptPermission };
}
