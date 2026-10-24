/**
 * Gera os ícones PNG do PWA a partir de public/favicon.svg (usa o Chromium do Playwright).
 *   npm run icones
 * Rode de novo só se mudar o favicon.svg; os PNGs gerados são versionados.
 */
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const svg = readFileSync('public/favicon.svg', 'utf8');
const FUNDO = '#0f172a';

const ICONES = [
  { arquivo: 'public/pwa-192.png', tamanho: 192, margem: 0 },
  { arquivo: 'public/pwa-512.png', tamanho: 512, margem: 0 },
  { arquivo: 'public/apple-touch-icon.png', tamanho: 180, margem: 0 },
  // Maskable: o Android recorta em círculo; o desenho fica dentro dos 80% centrais.
  { arquivo: 'public/pwa-maskable-512.png', tamanho: 512, margem: 0.1 },
];

const navegador = await chromium.launch();
const pagina = await navegador.newPage();
for (const { arquivo, tamanho, margem } of ICONES) {
  await pagina.setViewportSize({ width: tamanho, height: tamanho });
  const pad = Math.round(tamanho * margem);
  await pagina.setContent(
    `<html><body style="margin:0;background:${FUNDO}">
       <div style="width:${tamanho}px;height:${tamanho}px;padding:${pad}px;box-sizing:border-box">
         ${svg.replace('<svg ', '<svg width="100%" height="100%" ')}
       </div></body></html>`,
  );
  await pagina.screenshot({ path: arquivo, omitBackground: false });
  console.log(`Gerado: ${arquivo}`);
}
await navegador.close();
