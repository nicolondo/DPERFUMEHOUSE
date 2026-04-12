import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported, Messaging } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyB9iiR1qE4-p7R5g0Ui_sF2HPkYW89OurY',
  authDomain: 'dperfumehouse.firebaseapp.com',
  projectId: 'dperfumehouse',
  storageBucket: 'dperfumehouse.firebasestorage.app',
  messagingSenderId: '733287910276',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:733287910276:web:2212c0ae5b7354b9f42bd1',
};

const VAPID_KEY = 'BBCizJDogtYNQWsA8yRSNPr869mqrLAD7tPTpNhzjb3zaQxE_Rrqz9hGbUE1M1GK9AHV4oPDm765FP8OZtlrZCk';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

let messagingInstance: Messaging | null = null;

export async function getFirebaseMessaging(): Promise<Messaging | null> {
  if (typeof window === 'undefined') return null;
  const supported = await isSupported();
  if (!supported) return null;
  if (!messagingInstance) {
    messagingInstance = getMessaging(app);
  }
  return messagingInstance;
}

export async function requestNotificationPermission(): Promise<string | null> {
  try {
    const messaging = await getFirebaseMessaging();
    if (!messaging) {
      console.warn('[Push] Firebase messaging not supported on this device');
      return null;
    }

    if (Notification.permission !== 'granted') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return null;
    }

    // Register service worker
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    await navigator.serviceWorker.ready;

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (token) {
      console.log('[Push] FCM token obtained:', token?.slice(0, 20) + '...');
    }

    return token;
  } catch (error) {
    console.error('[Push] Failed to get push token:', error);
    return null;
  }
}

export function onForegroundMessage(callback: (payload: any) => void) {
  getFirebaseMessaging().then((messaging) => {
    if (messaging) {
      onMessage(messaging, callback);
    }
  });
}
