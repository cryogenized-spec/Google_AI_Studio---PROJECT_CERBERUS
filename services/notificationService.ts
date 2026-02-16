
import { db } from './organizerDb';
import { OrgTask, OrgEvent } from '../types';

export const requestNotificationPermission = async () => {
    if (!('Notification' in window)) return false;
    const result = await Notification.requestPermission();
    return result === 'granted';
};

export const sendLocalNotification = (title: string, options?: NotificationOptions) => {
    if (Notification.permission === 'granted') {
        // Use Service Worker if available for better mobile handling
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.ready.then(registration => {
                registration.showNotification(title, {
                    icon: '/public/icons/icon-192.png',
                    badge: '/public/icons/icon-192.png',
                    vibrate: [100, 50, 100],
                    requireInteraction: true,
                    ...options
                } as any);
            });
        } else {
            // Fallback to standard API
            new Notification(title, options);
        }
    }
};

export const checkReminders = async () => {
    if (Notification.permission !== 'granted') return;

    const now = Date.now();
    const oneHourFromNow = now + 60 * 60 * 1000;

    // 1. Check Events starting soon (10-60 mins out)
    // We filter roughly using DB then refine in memory to avoid "notified" flag complexity for this MVP
    // Ideally we'd mark them as "notified" in a local map or DB field.
    // For this MVP, we will rely on checking a 'last_notified' map in localStorage
    
    const events = await db.events.where('startAt').between(now, oneHourFromNow).toArray();
    const notifiedMap = JSON.parse(localStorage.getItem('cerberus_notified_ids') || '{}');

    events.forEach(ev => {
        if (!notifiedMap[ev.id]) {
            const mins = Math.round((ev.startAt - now) / 60000);
            if (mins <= 30) {
                sendLocalNotification(`Upcoming: ${ev.title}`, {
                    body: `Starts in ${mins} minutes.`,
                    tag: ev.id,
                    data: { url: '/calendar' }
                });
                notifiedMap[ev.id] = Date.now();
            }
        }
    });

    // 2. Check Tasks due today/soon
    // Find tasks due between now and end of day that haven't been notified
    const todayEnd = new Date(); todayEnd.setHours(23,59,59,999);
    const tasks = await db.tasks
        .where('status').equals('open')
        .filter(t => t.dueAt !== undefined && t.dueAt > now && t.dueAt < todayEnd.getTime())
        .toArray();

    tasks.forEach(t => {
        if (t.dueAt && !notifiedMap[t.id]) {
            const mins = Math.round((t.dueAt - now) / 60000);
            if (mins <= 60) {
                sendLocalNotification(`Due Soon: ${t.title}`, {
                    body: `Due in ${mins} minutes.`,
                    tag: t.id,
                    actions: [{ action: 'complete', title: 'Complete' }]
                } as any);
                notifiedMap[t.id] = Date.now();
            }
        }
    });

    // Cleanup notified map (older than 24h)
    Object.keys(notifiedMap).forEach(key => {
        if (now - notifiedMap[key] > 24 * 60 * 60 * 1000) delete notifiedMap[key];
    });
    localStorage.setItem('cerberus_notified_ids', JSON.stringify(notifiedMap));
};