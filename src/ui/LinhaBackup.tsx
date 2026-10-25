import { useEffect, useState } from 'preact/hooks';
import type { Dados } from '../db/repositorio.ts';
import { haQuantoTempo } from '../exportar/textos.ts';
import { rotas } from './rota.ts';

/** Com mudanças depois do último backup, quanto tempo até a linha ficar em destaque. */
const ATRASO = 4 * 60 * 60 * 1000;

interface Pendencia {
  /** Itens/equipamentos com medida ou observação alterada depois do último backup. */
  itens: number;
  fotos: number;
  atrasado: boolean;
}

/** O que mudou desde o último backup (sem backup: tudo). */
export function pendenciaDeBackup(dados: Dados, agora: number): Pendencia {
  const ultimo = dados.ultimoBackup;
  const depois = (r: { atualizadaEm: string }) => !ultimo || r.atualizadaEm > ultimo.em;
  const itens =
    [...dados.medicoes.values()].filter(depois).length +
    [...dados.notas.values()].filter(depois).length;
  let total = 0;
  for (const n of dados.fotosPorAlvo.values()) total += n;
  const fotos = Math.max(0, total - (ultimo?.fotos ?? 0));
  const mudou = itens + fotos > 0;
  return {
    itens,
    fotos,
    atrasado: mudou && (!ultimo || agora - Date.parse(ultimo.em) > ATRASO),
  };
}

function useAgora(): number {
  // Atualiza o "há X min" sozinho enquanto a tela está aberta.
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  return agora;
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/**
 * "Último backup: há 5 h · 35 itens e 12 fotos depois ›" — leva à tela de backup. Fica em
 * destaque (amarelo) quando há o que salvar há mais de 4 h. `soAtrasado`: só aparece em destaque
 * (fim da ficha, para quem vai de equipamento em equipamento sem passar pela lista).
 */
export function LinhaBackup({ dados, soAtrasado = false }: { dados: Dados; soAtrasado?: boolean }) {
  const agora = useAgora();
  const p = pendenciaDeBackup(dados, agora);
  if (soAtrasado && !p.atrasado) return null;
  const ultimo = dados.ultimoBackup;
  const mudancas = [
    p.itens > 0 && plural(p.itens, 'item', 'itens'),
    p.fotos > 0 && plural(p.fotos, 'foto', 'fotos'),
  ].filter(Boolean);
  return (
    <a class="linha-backup" data-alerta={p.atrasado || undefined} href={rotas.exportar}>
      <span>
        {ultimo ? `Último backup: ${haQuantoTempo(ultimo.em, agora)}` : 'Nenhum backup ainda'}
        {ultimo && mudancas.length > 0 && (
          <span class="linha-backup-depois"> · {mudancas.join(' e ')} depois</span>
        )}
      </span>
      <span class="linha-backup-acao">Backup ›</span>
    </a>
  );
}
