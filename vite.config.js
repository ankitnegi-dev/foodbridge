import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: 'FoodBridge',
        short_name: 'FoodBridge',
        description: 'Rescue Food. Feed Communities.',
        theme_color: '#0F6E56',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  server: {
    port: 3001,
    host: '0.0.0.0',
  },
  preview: {
    port: 3001,
    host: '0.0.0.0',
    allowedHosts: ['nqn4w18k.run.complete.dev'],
  },
})
