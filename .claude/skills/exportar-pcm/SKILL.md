---
name: exportar-pcm
description: Use ao implementar ou mudar qualquer exportação/restauração — o PCM atualizado em .xlsx (colunas Medido, Confere/Diverge, Observação, Data), o backup .json com fotos, o .zip de fotos, os nomes de arquivo e o compartilhamento via Web Share API (WhatsApp, Drive, e-mail) ou download.
---

# Exportar o PCM e os dados

Tudo roda **no celular, sem internet**. SheetJS entra com `import()` dinâmico (só para a planilha)
e fica no precache. Código em `src/exportar/` (feito na Fase 4, 25/10/2026):
`textos.ts` (colunas), `nomes.ts`, `planilha.ts`, `backup.ts`, `lerBackup.ts`, `base64.ts`,
`zip.ts`, `preparar.ts` (banco + diário → arquivo), `restaurar.ts`, `compartilhar.ts`; telas
`ui/TelaExportar.tsx`, `ui/TelaRestaurar.tsx`, `ui/ArquivoPronto.tsx`.

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
    listando os divergentes; vazio se nada foi marcado. Campo com ✓ e sem valor entra no `Medido`
    como `Lonas: conforme PCM`.
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
- **O `.xlsx` exportado tem que ser um PCM válido para o próprio app** (pedido do usuário): importado
  de novo, dá exatamente os mesmos equipamentos e itens (mesmos ids, medidas e fotos ficam).
  Por isso (`dominio/pcm/exportado.ts`):
  - as abas "Resumo" e "Fora do PCM" começam com `MARCA_ABA_DO_APP` na A1 e o parser as ignora;
  - exportar de novo um arquivo já exportado reaproveita as 4 colunas (acha os títulos na linha
    do cabeçalho) e refaz as abas do app — nada duplica;
  - leitura com `cellNF: true` (o texto dos números volta igual) e `cellStyles: true` (larguras);
  - linha e coluna contam a partir do início do `!ref` da aba, igual ao parser;
  - rede de segurança: se a coluna B da linha não bate com o nome do item, o item vai para
    "Fora do PCM" — nunca escreve na linha de outro item.
    Testado com a fixture (`tests/unit/planilha.test.ts`, `tests/e2e/exportar.spec.ts`) e conferido
    localmente com o PCM real (84 equipamentos, 717 itens, reimportação idêntica, 0 células alteradas).
- Limitação: a versão gratuita do SheetJS **não grava fontes, bordas nem cores** (mantém abas,
  textos, mesclagens, larguras, alturas e formato de número). Melhorar o visual = pós-processar o
  `.xlsx` (sessão de aparência); manter 100% exigiria editar o `.xls` binário.

## 2. Backup completo (`.json`) e restauração

```jsonc
{
  "formato": "levantamento-pcm-backup",
  "versao": 1, // versão do FORMATO do backup (não do app)
  "criadoEm": "2026-10-26T14:30:00-03:00",
  "esquemaDb": 1,
  "app": "0.1.0",
  "resumo": {
    "importacoes": 1,
    "equipamentos": 84,
    "itens": 762,
    "medicoes": 120,
    "notas": 12,
    "fotos": 300,
  },
  "importacaoAtual": "imp-…",
  "importacoes": [
    {
      "id": "…",
      "nomeArquivo": "…",
      "importadaEm": "…",
      "tamanho": 0,
      "abas": [],
      "tipo": "…",
      "arquivoBase64": "…",
    },
  ],
  "equipamentos": [], // um registro por linha, como no banco
  "itens": [],
  "medicoes": [],
  "notas": [],
  "fotos": [
    // por último (a parte pesada), uma por linha, na ordem em que foram tiradas
    {
      "id": "…",
      "alvoId": "…",
      "criadaEm": "…",
      "largura": 1600,
      "altura": 1200,
      "daPlaca": true,
      "tipo": "image/jpeg",
      "miniaturaTipo": "image/jpeg",
      "base64": "…",
      "miniaturaBase64": "…",
    },
  ],
}
```

- `formato`, `versao` e `resumo` vêm antes das listas. `resumo` confere que o arquivo não foi
  cortado. Foto sem `miniaturaBase64` (antiga) restaura sem miniatura e abre pelo blob grande.
- **Memória** (300–400 fotos ≈ 250 MB de .json): NUNCA montar o .json como string nem ler com
  `file.text()` (passa do limite de string do Chrome 32 bits). Gerar: uma foto por vez → base64
  (FileReader) → `new Blob([...])` pequeno → string descartada; o Blob final só junta os pedaços.
  Ler: fatias de 1 MB + `separarJson` (corta o objeto raiz em campos e as listas em elementos; um
  `JSON.parse` por elemento); cada foto vira Blob na hora. Medido (CPU 4× mais lenta, 300 fotos):
  heap JS ≤ 21 MB.
- Restaurar (`exportar/restaurar.ts`): bloqueia como a importação (fila, diário, foto gravando =
  `emOperacaoCritica`); valida tudo (formato, versão, tipos, base64, contagens, ids repetidos);
  prévia (o que entra × o que está no aparelho; aviso vermelho + 2ª confirmação se o celular tem
  algo que o backup não tem). **Enquanto restaura, o app mostra só a tela de restaurar**
  (`useRestaurando`): medir no meio seria apagado. **Antes de substituir, gera um backup .json
  completo do estado atual e grava NA MESMA transação** em `meta.copiaAntesDeRestaurar:<data>`
  (ficam as 2 últimas; se a restauração falhar, as cópias antigas não mudam); aparelho vazio não
  gera cópia. A transação confere a `impressaoDe` (medições/notas com `atualizadaEm`, ids de
  fotos e importações) lida para a cópia: se mudou, aborta. A tela mostra as cópias com "Voltar
  para esta cópia", Baixar e "Apagar esta cópia". Tudo numa transação só (`gravarRestauracao` +
  `tudoOuNada`).
- **`tudoOuNada`**: um `put()` recusado na hora (chave inválida, valor que não clona) NÃO aborta a
  transação sozinho — o que veio antes (ex.: `clear()`) seria gravado. Toda escrita em várias
  stores aborta explicitamente em qualquer erro.
- Exportar leva o que o técnico vê: descarrega a fila e sobrepõe o que ainda está só no diário.
- Teste obrigatório: exportar → apagar banco → restaurar → comparar igual (inclusive bytes das fotos).

## 3. Fotos (`.zip`)

- Nome: `<TAG>_<ITEM>_<n>.jpg`, ex.: `XA-TC-01_MOTOR_1.jpg`; foto do equipamento:
  `XA-TC-01_GERAL_1.jpg`. Sem TAG: nome do equipamento em slug maiúsculo, até 30 caracteres.
  Só `A–Z 0–9 - _`, sem acento nem espaço; `n` começa em 1 por item.
- Fotos já estão comprimidas (≤ 1600 px, JPEG ~0,8): no zip use `STORE` (sem recomprimir).
- Gerador próprio (`exportar/zip.ts`, PKZIP clássico, CRC-32): os blobs das fotos entram no Blob
  final por referência. O JSZip montaria o zip inteiro na memória — ele só é usado nos testes,
  para conferir o zip gerado.

## 4. Nomes de arquivo

`pcm-atualizado-AAAA-MM-DD-HHmm.xlsx`, `levantamento-backup-AAAA-MM-DD-HHmm.json`,
`fotos-AAAA-MM-DD-HHmm.zip` (hora local). Esses padrões estão no `.gitignore`.

## 5. Compartilhar

**O Chrome do Android NÃO compartilha `.xlsx`, `.json` nem `.zip` pelo Web Share**: só imagem,
áudio, vídeo, PDF e texto (.txt/.csv), até 50 MB no total (`ShareServiceImpl.java` do Chromium).
`canShare()` diz que sim, mas `share()` falha com `NotAllowedError` ("Permission denied").
Decisão do usuário (25/10): **"Baixar" é o caminho principal** e o envio é pelo app de arquivos
do celular (Downloads → Compartilhar → WhatsApp).

1. **Gere o arquivo antes**, com feedback ("Preparando…", tela acesa); depois mostre **Baixar**
   e, **fora do Android**, **Compartilhar**. Depois de baixar, diga onde está ("Downloads") e
   como mandar: "app de arquivos do celular → Downloads → segure “nome-do-arquivo” →
   Compartilhar → WhatsApp". Testado no Android (25/10): o "clipe → Documento" do WhatsApp **não
   lista .json**; pelo app de arquivos funcionou para .xlsx e .json. O `navigator.share` precisa ser chamado direto do toque (no iOS a permissão
   do gesto expira rápido — não gere o arquivo dentro do clique de compartilhar).
2. **Baixar** é um `<a href={objectURL} download>` de verdade (revogar a URL ~60 s depois de sair).
3. **Compartilhar**: `canShare` → `share({ files: [arquivo], title })`. `AbortError` (fechou a
   folha) não é erro. Recusado (`NotAllowedError`/sem suporte): baixa na hora e explica o caminho
   do WhatsApp. Funciona de verdade no iPhone.
4. MIME: xlsx `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`,
   json `application/json`, zip `application/zip`.
5. Registre a data do último backup no store `meta` (`ultimoBackup`, ao tocar Baixar/Compartilhar
   do backup) e mostre "Último backup: há 2 h" no topo da lista (amarelo se nunca ou > 1 dia).
6. Restaurar: `<input type="file">` **sem `accept`** — o Android esconde no seletor o .json que
   chega pelo WhatsApp marcado como "binário"; o conteúdo é validado depois.
