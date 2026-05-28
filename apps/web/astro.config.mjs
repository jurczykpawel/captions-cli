import { defineConfig } from 'astro/config';

// Static output (CF Pages). Cross-origin isolation headers are set both for
// dev (vite) and prod (public/_headers) so SharedArrayBuffer-backed WASM
// (whisper) works the same in both. COEP=credentialless avoids needing CORP
// headers on cross-origin model/CDN fetches (Chrome/Edge).
const coiHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'credentialless',
};

export default defineConfig({
  site: 'https://captions.techskills.academy',
  trailingSlash: 'never',
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'pl'],
    routing: { prefixDefaultLocale: false },
  },
  vite: {
    server: { headers: coiHeaders },
    preview: { headers: coiHeaders },
    // transformers.js loads its own wasm/workers at runtime; pre-bundling it
    // with esbuild breaks that in dev.
    optimizeDeps: { exclude: ['@huggingface/transformers'] },
  },
});
