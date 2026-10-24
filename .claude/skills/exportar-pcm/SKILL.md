---
name: exportar-pcm
description: Use ao implementar ou mudar qualquer exportação/restauração — o PCM atualizado em .xlsx (colunas Medido, Confere/Diverge, Observação, Data), o backup .json com fotos, o .zip de fotos, os nomes de arquivo e o compartilhamento via Web Share API (WhatsApp, Drive, e-mail) ou download.
---

# Exportar o PCM e os dados

Tudo roda **no celular, sem internet**. SheetJS e JSZip entram com `import()` dinâmico e ficam
no precache. Código previsto em `src/exportar/`.

## 1. PCM atualizado (`.xlsx`)

- Parte do **arquivo original** guardado na importação (store `importacoes`), para manter abas,
  cabeçalho, mesclagens e larguras. Nunca reconstrua a planilha do zero.
- Em cada aba, acrescenta 4 colunas **depois da última coluna usada daquela aba** (as abas não têm
  todas a mesma largura): `Medido`, `Confere/Diverge`, `Observação`, `Data`. Título na mesma linha
  do cabeçalho "EQUIPAMENTOS PARA INSPEÇÃO", repetido na linha de subtítulos.
- Escreve na **linha original do item** (`ItemPcm.linha`):
  - `Medido`: `rótulo: valor unidade (Δ)` dos campos preenchidos, separados por `; `.
    Ex.: `Largura: 660 mm (Δ −0,4); Lonas: 2; Centro a centro LD: 12450 mm`. Valores como o
    técnico digitou (vírgula decimal).
  - `Confere/Diverge`: `Confere` se todos os campos marcados conferem; `Diverge: Largura, Lonas`
    listando os divergentes; vazio se nada foi marcado.
  - Campo marcado **"Não tem"** (`conferencia[campo] === 'naoTem'`, peça que não existe no
    equipamento): entra no `Medido` como `Ponta do acoplamento: não se aplica` e não conta
    como confere nem diverge.
  - `Observação`: observação do item (+ `N foto(s)` se houver).
  - `Data`: última alteração, `dd/mm/aaaa hh:mm` (hora local).
- Itens que **não estão no PCM** (tambores deduzidos, itens criados em campo) vão para uma aba nova
  `Fora do PCM`: Aba, TAG, Equipamento, Item, Medido, Confere/Diverge, Observação, Data.
- Aba nova `Resumo`: por equipamento — Aba, TAG, Equipamento, % preenchido, nº de fotos,
  nº de divergências, observação do equipamento.
- Nunca altera as colunas originais (A–D, serviço, periodicidade, equipe).

## 2. Backup completo (`.json`) e restauração

```jsonc
{
  "formato": "levantamento-pcm-backup",
  "versao": 1, // versão do FORMATO do backup (não do app)
  "criadoEm": "2026-10-26T14:30:00-03:00",
  "esquemaDb": 1,
  "importacoes": [{ "...": "...", "arquivoBase64": "..." }],
  "equipamentos": [],
  "itens": [],
  "medicoes": [],
  "notas": [],
  "fotos": [{ "id": "...", "alvoId": "...", "tipo": "image/jpeg", "base64": "..." }],
}
```

- Restaurar: valida `formato` e `versao` (versões antigas passam por migração), mostra o que será
  restaurado (equipamentos, medições, fotos) e pede confirmação. **Antes de substituir, gera um
  backup automático do estado atual.** Restauração numa transação só: ou entra tudo, ou nada.
- Teste obrigatório: exportar → apagar banco → restaurar → comparar igual (inclusive bytes das fotos).

## 3. Fotos (`.zip`)

- Nome: `<TAG>_<ITEM>_<n>.jpg`, ex.: `XA-TC-01_MOTOR_1.jpg`; foto do equipamento:
  `XA-TC-01_GERAL_1.jpg`. Sem TAG: nome do equipamento em slug maiúsculo, até 30 caracteres.
  Só `A–Z 0–9 - _`, sem acento nem espaço; `n` começa em 1 por item.
- Fotos já estão comprimidas (≤ 1600 px, JPEG ~0,8): no zip use `STORE` (sem recomprimir).

## 4. Nomes de arquivo

`pcm-atualizado-AAAA-MM-DD-HHmm.xlsx`, `levantamento-backup-AAAA-MM-DD-HHmm.json`,
`fotos-AAAA-MM-DD-HHmm.zip` (hora local). Esses padrões estão no `.gitignore`.

## 5. Compartilhar

1. **Gere o arquivo antes**, com feedback ("Preparando…"); depois mostre o botão **Compartilhar**.
   O `navigator.share` precisa ser chamado direto do toque (no iOS a permissão do gesto expira
   rápido — não gere o arquivo dentro do clique de compartilhar).
2. `navigator.canShare?.({ files: [arquivo] })` → `navigator.share({ files: [arquivo], title })`.
   WhatsApp, Drive e e-mail aparecem na folha de compartilhamento.
3. Se não suportar ou o usuário cancelar (`AbortError` não é erro): botão **Baixar** com
   `<a download>` + `URL.createObjectURL` (revogar depois).
4. MIME: xlsx `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`,
   json `application/json`, zip `application/zip`.
5. Registre a data do último backup no store `meta` e mostre "Último backup: há 2 h" na tela inicial.
