import { useEffect, useState } from 'preact/hooks';
import type { Dados } from '../db/repositorio.ts';
import { haQuantoTempo } from '../exportar/textos.ts';
import { IconeAvancar, IconeBackup } from './Icones.tsx';
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

export function useAgora(): number {
  // Atualiza o "há X min" sozinho enquanto a tela está aberta.
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  return agora;
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** "35 itens e 12 fotos ainda sem backup" (null se nada mudou; sem backup, conta tudo). */
export function textoPendencia(p: Pendencia): string | null {
  const partes = [
    p.itens > 0 && plural(p.itens, 'item', 'itens'),
    p.fotos > 0 && plural(p.fotos, 'foto', 'fotos'),
  ].filter(Boolean);
  return partes.length > 0 ? `${partes.join(' e ')} ainda sem backup` : null;
}

/**
 * "Último backup: há 5 h" e, embaixo, "35 itens e 12 fotos ainda sem backup", com a seta — a linha
 * inteira leva à tela de backup. Fica em destaque (amarelo) quando há o que salvar há mais de 4 h. `soAtrasado`: só
 * aparece em destaque (fim da ficha, para quem vai de equipamento em equipamento sem passar
 * pela lista).
 */
export function LinhaBackup({ dados, soAtrasado = false }: { dados: Dados; soAtrasado?: boolean }) {
  const agora = useAgora();
  const p = pendenciaDeBackup(dados, agora);
  if (soAtrasado && !p.atrasado) return null;
  const ultimo = dados.ultimoBackup;
  const pendente = textoPendencia(p);
  return (
    <a class="linha-backup" data-alerta={p.atrasado || undefined} href={rotas.exportar}>
      <span class="icone-fundo">
        <IconeBackup />
      </span>
      <span class="linha-backup-texto">
        {ultimo ? `Último backup: ${haQuantoTempo(ultimo.em, agora)}` : 'Nenhum backup ainda'}
        {pendente && <span class="linha-backup-depois">{pendente}</span>}
      </span>
      <span class="linha-backup-acao">
        <IconeAvancar />
      </span>
    </a>
  );
}
