// D Perfume House - Push Notification Service Worker
self.addEventListener('push', function (event) {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'D Perfume House', body: event.data.text() };
  }

  const title = payload.title || 'D Perfume House';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icons/dp-logo-full.png',
    badge: '/icons/dp-logo-full.png',
    data: payload.data || {},
    vibrate: [200, 100, 200],
    requireInteraction: false,
    tag: payload.data?.orderId || 'dph-notification',
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const orderNumber = event.notification.data?.orderNumber;
  const url = orderNumber
    ? `/orders?highlight=${orderNumber}`
    : '/orders';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    }),
  );
});
