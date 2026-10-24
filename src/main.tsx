import { render } from 'preact';
import { App } from './app.tsx';
import { instalarDescargaAoSair } from './db/salvamento.ts';
import { aplicarTema, lerTema } from './ui/tema.ts';
import './estilos.css';

aplicarTema(lerTema()); // antes de desenhar, sem piscar o tema errado
instalarDescargaAoSair();

const raiz = document.getElementById('app');
if (raiz) render(<App />, raiz);
