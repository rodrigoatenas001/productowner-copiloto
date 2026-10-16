// Retrospectiva para proyectar: notas anónimas en tres columnas, votos y acciones con responsable.
import { h } from './dom.js';
import { botonesMarkdown } from './compartir.js';
import { reporteRetro } from '../nucleo/reportes.js';
import {
  COLUMNAS_RETRO, nuevaRetro, agregarNota, votar, quitarNota, notasDe, agregarAccion, alternarAccion, accionesPendientes,
} from '../nucleo/retro.js';

let retroActiva = null;

export function vistaRetro(app) {
  const retros = app.proyecto.retros || [];
  const actual = retros.find((r) => r.id === retroActiva) || retros[retros.length - 1] || null;
  retroActiva = actual?.id || null;

  const crear = () => {
    const r = nuevaRetro(app.proyecto);
    retroActiva = r.id;
    app.cambiar((x) => ({ ...x, retros: [...(x.retros || []), r] }));
  };

  return h('div', { class: 'vista' },
    h('header', { class: 'vista-cabecera' },
      h('p', { class: 'eyebrow' }, app.proyecto.nombre),
      h('h1', {}, actual ? actual.titulo : 'Retrospectiva'),
      h('p', { class: 'bajada' }, 'Las notas son anónimas. Al final, voten lo más importante y acuerden pocas acciones concretas, con responsable.')),
    h('div', { class: 'barra-filtros' },
      retros.length > 1 ? h('select', {
        'aria-label': 'Elegir retrospectiva',
        onchange: (e) => { retroActiva = e.target.value; app.render(); },
      }, [...retros].reverse().map((r) => h('option', { value: r.id, selected: r.id === actual?.id }, `${r.titulo} · ${r.fecha.split('-').reverse().join('-')}`))) : null,
      h('button', { type: 'button', class: actual ? 'btn btn--secundario' : 'btn', onclick: crear }, 'Nueva retrospectiva')),
    actual ? tablero(app, actual, retros) : h('div', { class: 'vacio' },
      h('p', {}, 'Aún no hay retrospectivas.'),
      h('p', { class: 'ayuda' }, 'Lo ideal es hacer una al cerrar cada sprint.')));
}

function tablero(app, retro, retros) {
  const editar = (transformar, redibujar = true) => app.cambiar((x) => ({
    ...x, retros: (x.retros || []).map((r) => (r.id === retro.id ? transformar(r) : r)),
  }), { redibujar });
  const pendientes = accionesPendientes(retros, retro.id);

  const columna = (clave) => {
    const entrada = h('textarea', {
      rows: 2, placeholder: 'Escribe y presiona Enter', 'aria-label': `Nueva nota en ${COLUMNAS_RETRO[clave]}`, maxlength: 500,
      onkeydown: (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          if (!e.target.value.trim()) return;
          editar((r) => agregarNota(r, clave, e.target.value));
          document.querySelector(`[data-columna="${clave}"] textarea`)?.focus();
        }
      },
    });
    return h('section', { class: `columna columna-retro columna-retro--${clave}`, 'aria-labelledby': `retro-${clave}`, dataset: { columna: clave } },
      h('h2', { id: `retro-${clave}` }, COLUMNAS_RETRO[clave]),
      entrada,
      h('ul', {}, notasDe(retro, clave).map((n) => h('li', { class: 'ficha nota-retro' },
        h('span', { class: 'ficha-titulo' }, n.texto),
        h('span', { class: 'ficha-pie' },
          h('span', { class: 'votos' },
            h('button', { type: 'button', class: 'icono', 'aria-label': `Votar: ${n.texto}`, onclick: () => editar((r) => votar(r, n.id, 1)) }, '+'),
            h('span', { 'aria-label': `${n.votos} votos` }, String(n.votos)),
            h('button', { type: 'button', class: 'icono', 'aria-label': `Quitar voto: ${n.texto}`, disabled: !n.votos, onclick: () => editar((r) => votar(r, n.id, -1)) }, '−')),
          h('button', { type: 'button', class: 'icono', 'aria-label': `Borrar nota: ${n.texto}`, onclick: () => editar((r) => quitarNota(r, n.id)) }, '×'))))));
  };

  const textoAccion = h('input', { type: 'text', placeholder: 'Acción concreta: qué haremos distinto', maxlength: 300, 'aria-label': 'Nueva acción' });
  const responsable = h('input', { type: 'text', placeholder: 'Responsable', maxlength: 80, 'aria-label': 'Responsable', class: 'input-responsable' });
  const agregar = () => {
    if (!textoAccion.value.trim()) return;
    editar((r) => agregarAccion(r, textoAccion.value, responsable.value));
  };

  return h('div', {},
    pendientes.length ? h('section', { class: 'panel recordatorio-acciones', 'aria-labelledby': 'pendientes-titulo' },
      h('h2', { id: 'pendientes-titulo' }, 'Antes de empezar: ¿cumplimos lo que acordamos?'),
      h('ul', { class: 'acciones-lista' }, pendientes.map((a) => h('li', {},
        h('label', { class: 'opcion' },
          h('input', {
            type: 'checkbox',
            onchange: () => app.cambiar((x) => ({ ...x, retros: x.retros.map((r) => (r.id === a.retroId ? alternarAccion(r, a.id) : r)) })),
          }),
          a.texto, a.responsable ? h('span', { class: 'tarjeta-meta' }, ` · ${a.responsable}`) : null,
          h('span', { class: 'tarjeta-meta' }, ` · ${a.retroTitulo}`)))))) : null,
    h('div', { class: 'tablero tablero-retro' }, Object.keys(COLUMNAS_RETRO).map(columna)),
    h('div', { class: 'compartir' }, botonesMarkdown(app, 'Reporte de la retro', retro.titulo, () => reporteRetro(app.proyecto, retro.id))),
    h('section', { class: 'panel', 'aria-labelledby': 'acciones-titulo' },
      h('h2', { id: 'acciones-titulo' }, 'Acciones acordadas'),
      h('p', { class: 'ayuda' }, 'Mejor dos acciones que se cumplen que diez que se olvidan.'),
      h('div', { class: 'fila-accion' }, textoAccion, responsable,
        h('button', { type: 'button', class: 'btn', onclick: agregar }, 'Agregar')),
      retro.acciones.length ? h('ul', { class: 'acciones-lista' }, retro.acciones.map((a) => h('li', {},
        h('label', { class: `opcion${a.hecha ? ' is-hecha' : ''}` },
          h('input', { type: 'checkbox', checked: a.hecha, onchange: () => editar((r) => alternarAccion(r, a.id)) }),
          a.texto, a.responsable ? h('span', { class: 'tarjeta-meta' }, ` · ${a.responsable}`) : null)))) : null));
}
