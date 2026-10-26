/**
 * Barra de progresso com o texto embaixo ("Preparando… 120 de 300 fotos"). Sem `total`, a barra
 * só mostra que o app está trabalhando (planilha, gravação).
 */
export function Progresso({
  texto,
  feitas = 0,
  total,
  nota,
}: {
  texto: string;
  feitas?: number;
  total?: number;
  /** Linha extra embaixo ("Não feche o app."). */
  nota?: string;
}) {
  const pct = total ? Math.min(100, Math.max(0, Math.round((100 * feitas) / total))) : null;
  return (
    <div class="progresso" role="status">
      <div
        class={pct === null ? 'progresso-barra progresso-barra--continua' : 'progresso-barra'}
        role="progressbar"
        aria-label={texto}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct ?? undefined}
      >
        <span style={pct === null ? undefined : { transform: `scaleX(${pct / 100})` }} />
      </div>
      <p class="progresso-texto">{texto}</p>
      {nota && <p class="progresso-nota">{nota}</p>}
    </div>
  );
}
