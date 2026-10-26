import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

// No GitHub Pages o app fica em https://<usuario>.github.io/<repo>/.
// O workflow de deploy define BASE_PATH=/<repo>/; localmente fica "/".
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [
    preact(),
    VitePWA({
      // 'prompt': nunca recarrega sozinho no meio de uma medição;
      // o usuário toca em "Atualizar" quando quiser.
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Levantamento PCM',
        short_name: 'Levant. PCM',
        description: 'Levantamento de medidas de equipamentos em campo, offline.',
        lang: 'pt-BR',
        dir: 'ltr',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f0f4f9',
        theme_color: '#f0f4f9',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Pré-carrega TODO o app shell, inclusive chunks carregados sob demanda
        // (SheetJS, JSZip), para importar/exportar em modo avião.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        // Nenhum runtimeCaching: o app não faz requisições de rede em runtime.
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  build: {
    target: 'es2020',
    sourcemap: true,
  },
});
