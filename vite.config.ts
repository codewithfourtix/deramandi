import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Installable, and works without signal after the first visit: the app
    // shell, fonts, samples AND the khajoor grade model are precached when the
    // service worker installs, so grading works offline in the field.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Dera Mandi · ڈیرہ منڈی',
        short_name: 'Dera Mandi',
        description: 'Grade your crop from a photo, see a fair price, and reach buyers, storage and transport in D.I. Khan.',
        lang: 'ur',
        dir: 'rtl',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#3B2A1E',
        background_color: '#FBF7F0',
        categories: ['business', 'productivity'],
        icons: [
          { src: '/icon-any-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-any-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,jpg,json,bin,mp3}'],
        // Installed up front: the app, the khajoor model and the Urdu voice clips.
        // The wheat, sugarcane and melon models (11 MB) are cached the first time they
        // are used, or all at once from Settings > "Ready for offline".
        globIgnores: ['__parity*/**', 'models/**'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/models\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/models/'),
            handler: 'CacheFirst',
            options: { cacheName: 'crop-models', expiration: { maxEntries: 40 } },
          },
        ],
      },
    }),
  ],
})
