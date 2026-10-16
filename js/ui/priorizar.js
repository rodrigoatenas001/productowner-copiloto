// Priorizar con números: WSJF o RICE, orden del backlog por puntaje y matriz valor/esfuerzo.
import { h, selector, vacio } from './dom.js';
import {
  METODOS, ESCALA_WSJF, IMPACTO_RICE, CONFIANZA_RICE, reordenarBacklog, matrizValorEsfuerzo, CUADRANTES,
} from '../nucleo/priorizacion.js';

let metodo = 'wsjf';

export function vistaPriorizar(app) {
  const backlog = app.proyecto.historias.filter((x) => x.estado === 'backlog');
  if (!backlog.length) return vacio('No hay nada que priorizar.', 'Cuando tengas historias en el backlog podrás ordenarlas por valor y esfuerzo.', ['Ir a Notas', () => app.ir('notas')]);
  const def = METODOS[metodo];

  const guardar = (id, cambios) => app.cambiar((x) => ({
    ...x, historias: x.historias.map((y) => (y.id === id ? { ...y, priorizacion: { ...(y.priorizacion || {}), ...cambios } } : y)),
  }), { redibujar: false });

  const escala = (valor, alCambiar, etiqueta) => selector({ '': '—', ...Object.fromEntries(ESCALA_WSJF.map((v) => [v, String(v)])) }, valor ?? '', {
    'aria-label': etiqueta, onchange: (e) => alCambiar(e.target.value ? Number(e.target.value) : null),
  });

  const fila = (x) => {
    const p = x.priorizacion || {};
    const celdaPuntaje = h('td', { class: 'puntaje-celda' });
    const pintar = () => {
      const actual = app.proyecto.historias.find((y) => y.id === x.id);
      const valor = def.puntaje(actual);
      celdaPuntaje.textContent = valor === null ? '—' : valor.toLocaleString('es-CL');
    };
    pintar();
    const cambiar = (campo) => (v) => { guardar(x.id, { [campo]: v }); pintar(); };
    const campos = metodo === 'wsjf'
      ? [
        h('td', {}, escala(p.valor, cambiar('valor'), `Valor para el negocio: ${x.titulo}`)),
        h('td', {}, escala(p.urgencia, cambiar('urgencia'), `Criticidad temporal: ${x.titulo}`)),
        h('td', {}, escala(p.riesgo, cambiar('riesgo'), `Reducción de riesgo: ${x.titulo}`)),
      ]
      : [
        h('td', {}, h('input', {
          type: 'number', min: 0, step: 1, value: p.alcance ?? '', class: 'input-corto', 'aria-label': `Alcance: ${x.titulo}`,
          onchange: (e) => cambiar('alcance')(e.target.value === '' ? null : Math.max(0, Math.round(Number(e.target.value)))),
        })),
        h('td', {}, selector({ '': '—', ...IMPACTO_RICE }, p.impacto ?? '', { 'aria-label': `Impacto: ${x.titulo}`, onchange: (e) => cambiar('impacto')(e.target.value ? Number(e.target.value) : null) })),
        h('td', {}, selector({ '': '—', ...CONFIANZA_RICE }, p.confianza ?? '', { 'aria-label': `Confianza: ${x.titulo}`, onchange: (e) => cambiar('confianza')(e.target.value ? Number(e.target.value) : null) })),
      ];
    return h('tr', {},
      h('th', { scope: 'row' }, x.titulo),
      ...campos,
      h('td', {}, x.puntos ? String(x.puntos) : h('span', { class: 'chip chip--aviso', title: 'Estímala para calcular el puntaje' }, 'sin estimar')),
      celdaPuntaje);
  };

  const cabeceras = metodo === 'wsjf'
    ? ['Valor para el negocio', 'Criticidad temporal', 'Reducción de riesgo']
    : ['Alcance (personas por trimestre)', 'Impacto', 'Confianza'];

  return h('div', { class: 'priorizar' },
    h('div', { class: 'barra-filtros' },
      h('div', { class: 'pestanas pestanas--chicas', role: 'tablist', 'aria-label': 'Método' },
        Object.entries(METODOS).map(([clave, m]) => h('button', {
          type: 'button', role: 'tab', class: 'pestana', 'aria-selected': String(metodo === clave),
          onclick: () => { metodo = clave; app.render(); },
        }, m.nombre))),
      h('button', {
        type: 'button', class: 'btn btn--secundario',
        onclick: () => app.cambiarConDeshacer(`Backlog ordenado por ${def.nombre}.`, (x) => ({ ...x, historias: reordenarBacklog(x.historias, metodo) })),
      }, `Ordenar el backlog por ${def.nombre}`)),
    h('p', { class: 'ayuda' }, def.explicacion, ' El tamaño o esfuerzo es la estimación en puntos. ',
      metodo === 'wsjf' ? 'Usa la escala relativa: compara cada historia con las demás, no en absoluto.' : 'Impacto y confianza siguen la escala de Intercom.'),
    h('div', { class: 'mapa-scroll' },
      h('table', { class: 'tabla tabla-priorizar' },
        h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Historia'), cabeceras.map((c) => h('th', { scope: 'col' }, c)), h('th', { scope: 'col' }, 'Puntos'), h('th', { scope: 'col' }, def.nombre))),
        h('tbody', {}, backlog.map(fila)))),
    metodo === 'wsjf' ? matriz(app, backlog) : null);
}

function matriz(app, backlog) {
  const { cuadrantes, sinDatos, cortes } = matrizValorEsfuerzo(backlog);
  return h('section', { class: 'panel matriz-panel', 'aria-labelledby': 'matriz-titulo' },
    h('h2', { id: 'matriz-titulo' }, 'Matriz valor / esfuerzo'),
    cortes
      ? h('p', { class: 'ayuda' }, `Valor = costo del retraso; esfuerzo = puntos. Los cortes son la mitad de tu backlog: valor ${cortes.valor} y ${cortes.esfuerzo} puntos.`)
      : h('p', { class: 'ayuda' }, 'Completa valor, urgencia, riesgo y puntos de algunas historias para ver la matriz.'),
    cortes ? h('div', { class: 'matriz' },
      h('span', { class: 'matriz-eje matriz-eje--y', 'aria-hidden': 'true' }, 'Más valor ↑'),
      h('span', { class: 'matriz-eje matriz-eje--x', 'aria-hidden': 'true' }, 'Más esfuerzo →'),
      ['rapida', 'grande', 'relleno', 'trampa'].map((clave) => h('div', { class: `cuadrante cuadrante--${clave}` },
        h('h3', {}, CUADRANTES[clave].nombre, h('span', { class: 'nav-conteo' }, String(cuadrantes[clave].length))),
        h('p', { class: 'ayuda' }, CUADRANTES[clave].ayuda),
        h('ul', {}, cuadrantes[clave].map((x) => h('li', {}, x.titulo)))))) : null,
    sinDatos.length && cortes ? h('p', { class: 'ayuda' }, `${sinDatos.length} ${sinDatos.length === 1 ? 'historia queda' : 'historias quedan'} fuera por falta de datos.`) : null);
}
