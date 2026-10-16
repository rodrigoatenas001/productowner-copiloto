// Buscador rápido (Ctrl+K) y atajos de teclado. Todo local: busca en el proyecto abierto.
import { h } from './dom.js';
import { enfocarHistoria } from './backlog.js';
import { abrirFicha } from './sprint.js';
import { ESTADOS } from '../nucleo/proyecto.js';

export const ATAJOS = [
  ['Ctrl + K  o  /', 'Buscar historias, secciones y acciones'],
  ['I', 'Ir a Inicio'],
  ['N', 'Ir a Notas'],
  ['B', 'Ir al Backlog'],
  ['C', 'Ir a Cliente'],
  ['S', 'Ir al Sprint'],
  ['?', 'Ver estos atajos'],
  ['Enter / doble clic', 'Abrir una tarjeta del tablero'],
  ['← →', 'Mover una tarjeta seleccionada de columna'],
  ['Esc', 'Cerrar un diálogo'],
];
const TECLAS = { i: 'inicio', n: 'notas', b: 'backlog', c: 'cliente', s: 'sprint' };

const normalizar = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Opciones del buscador: secciones, acciones e historias que contienen todas las palabras. */
export function resultados(app, consulta, vistas) {
  const palabras = normalizar(consulta).split(/\s+/).filter(Boolean);
  const coincide = (texto) => palabras.every((p) => normalizar(texto).includes(p));
  const acciones = [
    { tipo: 'Acción', texto: 'Descargar respaldo', hacer: () => { app.descargarRespaldo(); app.avisar('Respaldo descargado.'); } },
    { tipo: 'Acción', texto: 'Ver el proyecto de ejemplo', hacer: () => app.cargarEjemplo() },
    { tipo: 'Acción', texto: 'Hacer el recorrido de 4 pasos', hacer: () => app.iniciarRecorrido() },
    { tipo: 'Acción', texto: app.modoSimple ? 'Desactivar el modo simple' : 'Activar el modo simple', hacer: () => app.cambiarModoSimple(!app.modoSimple) },
    { tipo: 'Acción', texto: 'Ver atajos de teclado', hacer: () => mostrarAtajos() },
  ];
  const secciones = Object.entries(vistas).map(([clave, v]) => ({ tipo: 'Sección', texto: v.titulo, hacer: () => app.ir(clave) }));
  const historias = app.proyecto.historias.map((x) => ({
    tipo: ESTADOS[x.estado] || 'Historia',
    texto: x.titulo || '(sin título)',
    extra: `${x.epica || ''} ${x.quiero} ${x.para} ${x.rol}`,
    hacer: () => {
      if (x.estado === 'backlog' || !x.sprintId) { enfocarHistoria(x.id); app.ir('backlog'); } else { app.ir('sprint'); abrirFicha(app, x.id); }
    },
  }));
  if (!palabras.length) return [...secciones, ...acciones].slice(0, 12);
  return [...secciones, ...acciones, ...historias].filter((r) => coincide(`${r.texto} ${r.extra || ''}`)).slice(0, 12);
}

export function abrirBuscador(app, vistas) {
  if (document.querySelector('dialog[open]')) return;
  let elegido = 0;
  let lista = [];
  const caja = h('ul', { class: 'buscador-lista', role: 'listbox', id: 'buscador-lista' });
  const entrada = h('input', {
    type: 'search', placeholder: 'Busca una historia, una sección o una acción…', 'aria-label': 'Buscar',
    role: 'combobox', 'aria-controls': 'buscador-lista', 'aria-expanded': 'true', autocomplete: 'off',
    oninput: () => { elegido = 0; pintar(); },
    onkeydown: (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); elegido = Math.min(lista.length - 1, elegido + 1); pintar(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); elegido = Math.max(0, elegido - 1); pintar(); }
      if (e.key === 'Enter') { e.preventDefault(); ejecutar(lista[elegido]); }
    },
  });
  const dialogo = h('dialog', { class: 'buscador', 'aria-label': 'Buscador', onclose: () => dialogo.remove(), onclick: (e) => { if (e.target === dialogo) dialogo.close(); } },
    entrada, caja, h('p', { class: 'ayuda buscador-pie' }, '↑ ↓ para elegir · Enter para abrir · Esc para cerrar'));
  const ejecutar = (r) => { if (!r) return; dialogo.close(); r.hacer(); };
  function pintar() {
    lista = resultados(app, entrada.value, vistas);
    caja.replaceChildren(...(lista.length ? lista.map((r, i) => h('li', {
      role: 'option', id: `buscador-op-${i}`, 'aria-selected': String(i === elegido), class: i === elegido ? 'is-elegido' : null,
      onclick: () => ejecutar(r), onmousemove: () => { if (elegido !== i) { elegido = i; pintar(); } },
    }, h('span', {}, r.texto), h('span', { class: 'chip' }, r.tipo))) : [h('li', { class: 'buscador-vacio' }, 'Nada coincide. Prueba con otra palabra.')]));
    entrada.setAttribute('aria-activedescendant', lista.length ? `buscador-op-${elegido}` : '');
  }
  pintar();
  document.body.append(dialogo);
  dialogo.showModal();
  entrada.focus();
}

export function mostrarAtajos() {
  if (document.querySelector('dialog[open]')) return;
  const dialogo = h('dialog', { class: 'dialogo-pregunta', 'aria-label': 'Atajos de teclado', onclose: () => dialogo.remove(), onclick: (e) => { if (e.target === dialogo) dialogo.close(); } },
    h('p', { class: 'dialogo-pregunta-texto' }, 'Atajos de teclado'),
    h('dl', { class: 'atajos' }, ATAJOS.flatMap(([t, d]) => [h('dt', {}, h('kbd', {}, t)), h('dd', {}, d)])),
    h('div', { class: 'acciones' }, h('button', { type: 'button', class: 'btn', onclick: () => dialogo.close() }, 'Entendido')));
  document.body.append(dialogo);
  dialogo.showModal();
}

/** Escucha el teclado en toda la app (salvo al escribir en un campo). */
export function activarAtajos(app, vistas) {
  document.addEventListener('keydown', (e) => {
    if (!app.proyecto) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); abrirBuscador(app, vistas); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest?.('input, textarea, select, [contenteditable], dialog')) return;
    if (e.key === '/') { e.preventDefault(); abrirBuscador(app, vistas); return; }
    if (e.key === '?') { e.preventDefault(); mostrarAtajos(); return; }
    const vista = TECLAS[e.key.toLowerCase()];
    if (vista && !e.shiftKey) { e.preventDefault(); app.ir(vista); }
  });
}
