/* eslint-disable no-restricted-globals */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyB9iiR1qE4-p7R5g0Ui_sF2HPkYW89OurY',
  authDomain: 'dperfumehouse.firebaseapp.com',
  projectId: 'dperfumehouse',
  storageBucket: 'dperfumehouse.firebasestorage.app',
  messagingSenderId: '733287910276',
  appId: '1:733287910276:web:2212c0ae5b7354b9f42bd1',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  // Firebase auto-displays notifications when 'notification' key is present.
  // Only show manually for data-only messages.
  if (payload.notification) return;

  const title = payload.data?.title || 'D Perfume House';
  const body = payload.data?.body || '';
  const url = payload.data?.url || '/';

  self.registration.showNotification(title, {
    body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    data: { url },
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
