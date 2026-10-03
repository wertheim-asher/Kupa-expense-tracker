import { defineConfig } from 'vitest/config'
import { loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { APP } from './src/config.ts'

/** Builds with the shared backend open the connection to it while the app's code still downloads. */
function preconnect(url: string | undefined): Plugin {
  return {
    name: 'kupa-preconnect',
    transformIndexHtml() {
      if (!url) return []
      return [{ tag: 'link', attrs: { rel: 'preconnect', href: new URL(url).origin, crossorigin: '' }, injectTo: 'head' }]
    },
  }
}

/**
 * When the service worker serves the page (every launch after the first), the fonts home uses are in
 * its cache: ask for them at once, so home paints in Rubik and is not laid out again when they arrive.
 * Not on a first visit, where they would compete with the app's code on a slow connection.
 */
function preloadCachedFonts(pattern: RegExp): Plugin {
  return {
    name: 'kupa-preload-cached-fonts',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const files = Object.keys(ctx.bundle ?? {})
          .filter((file) => pattern.test(file))
          .map((file) => `/${file}`)
        if (files.length === 0) return html
        const script =
          `<script>try{if(navigator.serviceWorker&&navigator.serviceWorker.controller)${JSON.stringify(files)}.forEach(function(h){` +
          `var l=document.createElement('link');l.rel='preload';l.as='font';l.type='font/woff2';l.crossOrigin='';l.href=h;document.head.appendChild(l)})}catch(e){}</script>`
        // Right after the charset, before the stylesheet: an inline script after a stylesheet waits for it.
        return html.replace(/(<meta charset="UTF-8" \/>)/, `$1\n    ${script}`)
      },
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    preconnect(loadEnv(mode, '.', 'VITE_').VITE_SUPABASE_URL),
    // The faces home draws with: Hebrew and Latin, regular, medium and bold (₪ comes from Hebrew).
    preloadCachedFonts(/rubik-(hebrew|latin)-(400|500|700)-normal-[\w-]+\.woff2$/),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        name: APP.name,
        short_name: APP.name,
        description: APP.description,
        lang: 'he',
        dir: 'rtl',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#0F766E',
        background_color: '#F7F7F5',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: [
          '**/*.{js,css,html,svg,png}',
          '**/rubik-hebrew-*-normal-*.woff2',
          '**/rubik-latin-[0-9]*-normal-*.woff2',
          // ₪ (U+20AA) is drawn from the latin-ext face, so offline launches need it too.
          '**/rubik-latin-ext-*-normal-*.woff2',
        ],
        navigateFallback: '/index.html',
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    // Unit and flow tests always run on on-device storage, even when .env.local points at Supabase.
    env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
}))
