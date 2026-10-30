/*
 * Forja · rest alarms. Imported by the Workbox service worker (see vite.config.ts).
 * Payload from supabase/functions/rest-alarms: { title, body, url, tag }.
 * `url` is relative to the app scope, e.g. "#/session".
 */
/* eslint-env serviceworker */

const scoped = (path) => new URL(path || '', self.registration.scope).href

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Forja', {
      body: data.body || '',
      tag: data.tag || 'forja',
      renotify: true,
      icon: scoped('icons/icon-192.png'),
      badge: scoped('icons/icon-192.png'),
      vibrate: [180, 90, 180],
      data: { url: data.url || '' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || ''
  const target = scoped(url)
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const open = windows.find((c) => c.url.startsWith(self.registration.scope))
      if (open) {
        // Some browsers refuse focus() here; the system brings the app forward anyway.
        await open.focus().catch(() => {})
        // Same-origin client: the app routes by hash and navigates in place.
        // oxlint-disable-next-line unicorn/require-post-message-target-origin
        open.postMessage({ type: 'forja:open', hash: new URL(target).hash })
        return
      }
      await self.clients.openWindow(target)
    })(),
  )
})
