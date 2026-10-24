import { render } from 'preact';
import { App } from './app.tsx';
import { instalarDescargaAoSair } from './db/salvamento.ts';
import { aplicarTema, lerTema } from './ui/tema.ts';
import './estilos.css';

aplicarTema(lerTema()); // antes de desenhar, sem piscar o tema errado
instalarDescargaAoSair();
// A lista e a ficha lembram onde o técnico parou. A restauração automática do navegador, ao
// "voltar", rola a ficha ainda na tela para a posição da lista e estragaria essa memória.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

const raiz = document.getElementById('app');
if (raiz) render(<App />, raiz);
