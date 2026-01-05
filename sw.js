
const CACHE_NAME = 'payment-sys-v4-push';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// *** CORE PUSH NOTIFICATION LOGIC ***
// This event fires in the BACKGROUND, even if the app is closed (on Android/Desktop and iOS 16.4+ PWA)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || 'پیام سیستم';
    
    const options = {
      body: data.body,
      icon: '/pwa-192x192.png',     // Must exist
      badge: '/pwa-192x192.png',    // Small icon for Android status bar
      dir: 'rtl',
      lang: 'fa',
      vibrate: [100, 50, 100],
      data: {
        url: data.url || '/'
      },
      tag: 'payment-sys-notification', // Overwrites older notifications with same tag
      renotify: true, // Play sound again for new notifications with same tag
      requireInteraction: true, // Keeps notification visible until user interacts
      actions: [
        { action: 'open', title: 'مشاهده' }
      ]
    };

    // waitUntil ensures the browser doesn't terminate the worker before showing the notification
    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  } catch (err) {
    console.error('Push processing error:', err);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Handle the click: Open the app window or focus existing one
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 1. Try to find an existing open tab
      for (const client of clientList) {
        // Match the base URL to find our app
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          return client.focus().then((focusedClient) => {
              // Optional: Send a message to the client to navigate to specific page
              if(focusedClient) {
                  focusedClient.navigate('/'); 
              }
              return focusedClient;
          });
        }
      }
      // 2. If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
