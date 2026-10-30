import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig, loadEnv } from 'vite'

// GitHub Pages serves the app under /<repo>/. Override with VITE_BASE_PATH for another host.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const base = env.VITE_BASE_PATH ?? (mode === 'production' ? '/jmfit/' : '/')

  return {
    base,
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'prompt',
        // public/icons is already precached by globPatterns; listing the icons again duplicated them.
        includeManifestIcons: false,
        manifest: {
          id: '/jmfit/',
          name: 'Forja',
          short_name: 'Forja',
          description: 'Entrenamiento guiado: progresión, récords, cuerpo y recuperación.',
          lang: 'es',
          dir: 'ltr',
          start_url: base,
          scope: base,
          display: 'standalone',
          orientation: 'any',
          background_color: '#000000',
          theme_color: '#000000',
          categories: ['fitness', 'health', 'sports'],
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            {
              src: 'icons/icon-512-maskable.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'],
          navigateFallback: `${base}index.html`,
          runtimeCaching: [
            {
              // Supabase is never served from cache: TanStack Query owns offline persistence.
              urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
              handler: 'NetworkOnly',
            },
            {
              // Exercise video stills: requested with CORS, so they are cached at their real
              // size and the lists show them without signal in the gym.
              urlPattern: /^https:\/\/i\.ytimg\.com\/vi\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'video-stills',
                expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 60 },
                cacheableResponse: { statuses: [200] },
              },
            },
          ],
          // Push and notification-click handlers for rest alarms (public/push-sw.js).
          importScripts: ['push-sw.js'],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
        },
        devOptions: { enabled: false },
      }),
    ],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    build: {
      target: 'es2022',
      sourcemap: true,
      chunkSizeWarningLimit: 700,
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: 'vendor',
                test: /[\\/]node_modules[\\/](?:react|react-dom|scheduler|react-router|react-router-dom)[\\/]/,
                priority: 60,
              },
              { name: 'supabase', test: /[\\/]node_modules[\\/]@supabase[\\/]/, priority: 50 },
              { name: 'query', test: /[\\/]node_modules[\\/]@tanstack[\\/]/, priority: 40 },
              { name: 'icons', test: /[\\/]node_modules[\\/]lucide-react[\\/]/, priority: 20 },
              // The exercise catalog changes far less often than the screens around it.
              {
                name: 'catalog',
                test: /[\\/]src[\\/]content[\\/]/,
                tags: ['$initial'],
                priority: 15,
              },
              { name: 'libs', test: /[\\/]node_modules[\\/]/, tags: ['$initial'], priority: 1 },
            ],
          },
        },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
    },
  }
})
