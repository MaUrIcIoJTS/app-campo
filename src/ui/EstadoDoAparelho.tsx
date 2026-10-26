import type { Dados } from '../db/repositorio.ts';
import { LinhaBackup } from './LinhaBackup.tsx';
import { IconeAviso } from './Icones.tsx';

export interface StatusAparelho {
  offline: boolean;
  persistente: boolean | null;
}

/** O que ainda NÃO está pronto para o campo (vazio = tudo certo). */
export function problemasDoAparelho(status: StatusAparelho): string[] {
  return [
    !status.offline && 'Ainda não está pronto para uso sem internet. Mantenha a internet ligada.',
    status.persistente === false && 'Instale o app na tela inicial para proteger os dados.',
  ].filter((p): p is string => !!p);
}

/**
 * Topo da lista: um bloco só com o estado do aparelho — último backup (leva à tela de backup) e,
 * embaixo, o que falta para o campo (instalar o app, preparar o uso sem internet).
 */
export function EstadoDoAparelho({ status, dados }: { status: StatusAparelho; dados?: Dados }) {
  const problemas = problemasDoAparelho(status);
  if (!dados && problemas.length === 0) return null;
  return (
    <section class="estado" aria-label="Estado do aparelho">
      {dados && <LinhaBackup dados={dados} />}
      {problemas.map((p) => (
        <p key={p} class="estado-aviso" role="status">
          <IconeAviso />
          <span>{p}</span>
        </p>
      ))}
    </section>
  );
}
