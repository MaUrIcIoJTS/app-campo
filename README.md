# Levantamento PCM

App para levantar medidas de equipamentos em campo e conferir com o PCM (Programa de Controle e
Manutenção). Roda no navegador do celular, instala na tela inicial e funciona **sem internet**.

- Os dados ficam **só no aparelho** (IndexedDB). Nada é enviado para servidor.
- O PCM é importado no próprio celular (`.xls`/`.xlsx`); o site publicado não contém dados.
- Exporta o PCM atualizado (`.xlsx`), backup completo (`.json`) e fotos (`.zip`), e compartilha
  por WhatsApp, Drive ou e-mail.

## Desenvolvimento

Requer Node 22+.

```bash
npm install
npm run dev          # desenvolvimento
npm test             # testes unitários
npm run test:e2e     # build + testes no navegador (inclui modo offline)
npm run build        # produção em dist/
```

Planilha real para testes locais: `dados/pcm.xls` (fora do git). Os testes usam a fixture
fictícia `tests/fixtures/pcm-ficticio.xls` (`npm run pcm:fixture`).

Deploy: push na `main` publica no GitHub Pages via GitHub Actions
(Settings → Pages → Source = GitHub Actions).

Detalhes de arquitetura, regras e glossário: [CLAUDE.md](CLAUDE.md).
