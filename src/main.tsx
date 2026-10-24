import { render } from 'preact';
import { App } from './app.tsx';
import './estilos.css';

const raiz = document.getElementById('app');
if (raiz) render(<App />, raiz);
