---
name: testar-offline
description: Use para verificar que o app funciona sem internet e não perde dados — rodar build, preview e o E2E offline, inspecionar o service worker e o IndexedDB, ou testar no celular de verdade (modo avião, fechar à força). Use antes de qualquer entrega e sempre que mexer em vite.config.ts, service worker, IndexedDB ou importação/exportação.
---

# Testar offline

O service worker **só existe no build de produção**. `npm run dev` não serve para testar offline.

## 1. Automático (sempre)

```bash
npm run test:e2e        # faz build + preview na porta 4173 e roda o Playwright em 360 px
```

O teste `tests/e2e/offline.spec.ts` abre o app, espera o SW assumir a página, liga
`context.setOffline(true)`, recarrega e confere que o app abriu. `tests/e2e/medicao.spec.ts`
cobre a perda de dado, em modo avião:

- 20 medidas + ✓/✗ + observações → `page.close()` sem esperar → página nova: tudo lá;
- fechar 100 ms depois de digitar (antes da fila gravar) → o valor continua;
- **app morto sem aviso**: `SIGKILL` no processo do renderer (pega o PID com
  `SystemInfo.getProcessInfo` via `browser.newBrowserCDPSession()`). Nenhum `pagehide` roda;
  o teste confere que o valor estava só no diário e que voltou ao reabrir.
  Não use `chrome://crash` nem `Page.crash`: no headless o evento de crash leva 20–30 s.

Se falhar: `npx playwright show-report` (trace com rede e console).

## 2. Manual no computador

```bash
npm run build && npm run preview     # http://localhost:4173
```

No Chrome, DevTools → **Application**:

- **Service workers**: status "activated and is running"; "Update on reload" desligado.
- **Cache storage**: `workbox-precache-…` com todos os `.js` (inclusive os chunks de SheetJS/JSZip).
- **Manifest**: sem erros, ícones 192/512, instalável.
- **IndexedDB** → `levantamento-pcm`: confira os dados depois de editar.
- **Network** → "Offline", recarregue: tem que abrir igual. Na aba Network, nada pode ir para
  outro domínio (nem fonte, nem CDN).

## 3. No celular (o teste que importa)

O service worker exige HTTPS (ou `localhost`). Um IP da rede local (`http://192.168…`) **não**
registra o SW. Opções:

- **Android + cabo USB** (mais rápido): depuração USB ligada, `npm run preview`, depois
  `adb reverse tcp:4173 tcp:4173` e abra `http://localhost:4173` no Chrome do celular.
  `chrome://inspect` no PC mostra o console do celular.
- **GitHub Pages** (sem cabo): faça o push (skill `publicar`) e abra a URL do Pages.

Roteiro no aparelho:

1. Abrir a URL com internet → esperar "Pronto para usar offline" → **Adicionar à tela inicial**.
2. Ligar **modo avião**. Abrir pelo ícone. Tem que abrir.
3. Importar o PCM, preencher medidas, tirar fotos.
4. **Fechar à força** (remover dos recentes) no meio de uma digitação. Reabrir em modo avião:
   tudo tem que estar lá, inclusive o último campo digitado.
5. Exportar `.xlsx` e backup `.json` em modo avião; compartilhar quando voltar o sinal.
   O aparelho de campo é **Android**; iPhone não é alvo de teste.

## Problemas comuns

- App "velho" depois do deploy: o SW novo espera; toque em "Atualizar" (registerType `prompt`).
- Chunk faltando offline: o arquivo não casou com `globPatterns` em `vite.config.ts` ou passou de
  `maximumFileSizeToCacheInBytes`. Veja a lista "precache N entries" no fim do `npm run build`.
