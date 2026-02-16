// Project Cerberus Service Worker
// Version: 0.1.1 BETA RELEASE

const CACHE_NAME = 'cerberus-static-v0.1.1-beta';

// 1. INSTALLATION & PRECACHING
self.addEventListener('install', (event) => {
    // Force new service worker to activate immediately, skipping the 'waiting' state
    self.skipWaiting();
});

// 2. ACTIVATION
self.addEventListener('activate', (event) => {
    // Claim any clients immediately so they are controlled by this new SW
    event.waitUntil(clients.claim());
});

// 3. FETCH STRATEGY
self.addEventListener('fetch', (event) => {
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => {
                return caches.match(event.request);
            })
        );
    }
});

// 4. PUSH NOTIFICATIONS
self.addEventListener('push', (event) => {
    let data = {};
    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data = { title: 'Project Cerberus', body: event.data.text() };
        }
    }

    const options = {
        body: data.body || 'Ysaraith requires your attention.',
        icon: '/public/icons/icon-192.png', 
        badge: '/public/icons/icon-192.png', 
        vibrate: [100, 50, 100],
        data: data.payload || {},
        tag: data.tag || 'cerberus-task',
        requireInteraction: true, 
        renotify: true, 
        actions: [
            { action: 'complete', title: '✔️ Complete' },
            { action: 'snooze', title: '⏳ Snooze' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'Incoming Transmission', options)
    );
});

// 5. NOTIFICATION CLICK
self.addEventListener('notificationclick', (event) => {
    const notification = event.notification;
    const action = event.action;

    notification.close();

    if (!action) {
        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
                if (windowClients.length > 0) {
                    return windowClients[0].focus();
                }
                return clients.openWindow('/');
            })
        );
    }
});