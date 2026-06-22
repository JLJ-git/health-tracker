self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'Health Tracker', {
      body:  data.body || '',
      icon:  '/health-tracker/icon.png',
      badge: '/health-tracker/icon.png',
      tag:   data.tag || 'health-tracker',
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(list => {
      for (const client of list) {
        if (client.url.includes('/health-tracker/') && 'focus' in client) return client.focus();
      }
      return clients.openWindow('/health-tracker/');
    })
  );
});
