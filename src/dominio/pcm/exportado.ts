/**
 * O que o app acrescenta ao PCM ao exportar o `.xlsx` atualizado. O arquivo exportado tem que
 * poder ser importado de novo como PCM e dar exatamente os mesmos equipamentos e itens:
 * - as 4 colunas novas ficam depois das colunas do PCM (o parser só lê A–D);
 * - as abas novas começam com `MARCA_ABA_DO_APP` na célula A1 e o parser as ignora;
 * - exportar de novo um arquivo já exportado reaproveita as colunas e troca as abas do app.
 */

/** Início do texto da célula A1 das abas criadas pelo app ("Resumo", "Fora do PCM"). */
export const MARCA_ABA_DO_APP = 'Gerado pelo app Levantamento PCM';

export const COLUNAS_DO_APP = ['Medido', 'Confere/Diverge', 'Observação', 'Data'] as const;

export const ABA_RESUMO = 'Resumo';
export const ABA_FORA_DO_PCM = 'Fora do PCM';
