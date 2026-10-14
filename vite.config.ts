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
 * Asks V8 (Chrome, Android) to compile the whole entry script up front on a background thread, so the
 * first render does not stop to compile each function as it first runs (home about 70 to 135 ms sooner
 * on a slow phone). Safari and Firefox ignore the comment. It must be the file's first line, so this
 * runs after Vite has added its own first line.
 */
function compileHints(): Plugin {
  return {
    name: 'kupa-compile-hints',
    apply: 'build',
    enforce: 'post',
    // The comment is added after file names are hashed: count it in the entry's hash, so the deploy that
    // adds it (or a later one that removes it) gives the file a new name and installed apps fetch it again.
    augmentChunkHash(chunk) {
      if (chunk.isEntry) return 'compile-hints:allFunctionsCalledOnLoad'
    },
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        for (const chunk of Object.values(bundle)) {
          if (chunk.type === 'chunk' && chunk.isEntry) chunk.code = `//# allFunctionsCalledOnLoad\n${chunk.code}`
        }
      },
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
    compileHints(),
    // The faces home draws with: Hebrew and Latin, regular, medium and bold (₪ comes from Hebrew).
    preloadCachedFonts(/rubik-(hebrew|latin)-(400|500|700)-normal-[\w-]+\.woff2$/),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        // English is the default language, so the installed app is named in English too.
        name: APP.nameEn,
        short_name: APP.nameEn,
        description: APP.descriptionEn,
        lang: 'en',
        dir: 'ltr',
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
