// Tablero continuo (Kanban): sin sprints. Se trae trabajo del backlog cuando hay capacidad, se limita el
// trabajo en curso y se mira el flujo: rendimiento, tiempos de entrega y de ciclo, y el flujo acumulado.
import { h, selector, pedirTexto, termino, vacio } from './dom.js';
import { cambiarEstado, ESTADOS } from '../nucleo/proyecto.js';
import { columnasDe, bloquear, desbloquear, diasBloqueada } from '../nucleo/flujo.js';
import { itemsTablero, traerAlTablero, usoWipKanban, metricasKanban, flujoAcumulado, DIAS_VISIBLE_HECHO } from '../nucleo/kanban.js';
import { panelDaily } from './sprint.js';

let verDaily = false;
let arrastrada = null;

const NS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs = {}) => { const el = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v); return el; };
const dias = (n) => (n === null ? '—' : `${n.toLocaleString('es-CL')} ${n === 1 ? 'día' : 'días'}`);

export function vistaKanban(app) {
  const p = app.proyecto;
  const ahora = new Date();
  const { visibles, archivadas } = itemsTablero(p, ahora);
  const m = metricasKanban(p, ahora);
  const columnas = columnasDe(p);
  const backlog = p.historias.filter((x) => x.estado === 'backlog');
  // Si se desactivó la columna de revisión, lo que estaba en revisión se ve en «En curso»
  const enColumna = (x, estado) => x.estado === estado || (estado === 'doing' && x.estado === 'review' && !columnas.includes('review'));
  const mover = (id, estado) => app.cambiar((x) => ({ ...x, historias: x.historias.map((y) => (y.id === id ? cambiarEstado(y, estado) : y)) }));

  const tarjeta = (x) => {
    const i = columnas.findIndex((c) => enColumna(x, c));
    const desde = x.estado === 'todo' ? x.entrada : x.estado === 'done' ? x.terminada : x.iniciada;
    const edad = desde ? Math.floor((ahora - new Date(desde)) / 86400000) : null;
    return h('li', {
      class: `ficha${x.bloqueo ? ' is-bloqueada' : ''}`, draggable: 'true',
      ondragstart: (e) => { arrastrada = x.id; e.dataTransfer.effectAllowed = 'move'; },
    },
    h('p', { class: 'ficha-titulo' }, x.titulo),
    h('p', { class: 'tarjeta-meta' }, [x.epica, x.puntos ? `${x.puntos} pts` : null, x.estado !== 'done' && edad !== null ? `${dias(edad)} aquí` : null].filter(Boolean).join(' · ')),
    x.bloqueo ? h('p', { class: 'ficha-bloqueo-texto' }, `Bloqueada hace ${dias(diasBloqueada(x, ahora))}: ${x.bloqueo.motivo}`) : null,
    h('div', { class: 'ficha-acciones' },
      x.estado === 'done' ? null : h('button', {
        type: 'button', class: 'btn-texto ficha-bloqueo',
        onclick: async () => {
          if (x.bloqueo) { app.cambiar((y) => ({ ...y, historias: y.historias.map((z) => (z.id === x.id ? desbloquear(z) : z)) })); return; }
          const motivo = await pedirTexto('¿Qué la bloquea?', { aceptar: 'Bloquear', placeholder: 'Ej.: falta el repuesto, espera de aprobación' });
          if (motivo) app.cambiar((y) => ({ ...y, historias: y.historias.map((z) => (z.id === x.id ? bloquear(z, motivo) : z)) }));
        },
      }, x.bloqueo ? 'Desbloquear' : 'Bloquear'),
      i > 0 ? h('button', { type: 'button', class: 'icono', 'aria-label': `Mover «${x.titulo}» a ${ESTADOS[columnas[i - 1]]}`, onclick: () => mover(x.id, columnas[i - 1]) }, '←') : null,
      i < columnas.length - 1 ? h('button', { type: 'button', class: 'icono', 'aria-label': `Mover «${x.titulo}» a ${ESTADOS[columnas[i + 1]]}`, onclick: () => mover(x.id, columnas[i + 1]) }, '→') : null));
  };

  const columna = (estado) => {
    const lista = visibles.filter((x) => enColumna(x, estado));
    const wip = usoWipKanban(p, estado);
    return h('section', {
      class: `columna columna--${estado}${wip.excede ? ' is-excedida' : ''}`, 'aria-labelledby': `kb-${estado}`,
      ondragover: (e) => { if (arrastrada) e.preventDefault(); },
      ondrop: (e) => { e.preventDefault(); if (arrastrada) { const id = arrastrada; arrastrada = null; mover(id, estado); } },
    },
    h('h2', { id: `kb-${estado}` }, ESTADOS[estado],
      h('span', { class: `chip${wip.excede ? ' chip--aviso' : ''}`, title: wip.limite ? 'En la columna / límite' : 'En la columna' }, wip.limite ? `${wip.cuenta}/${wip.limite}` : String(lista.length))),
    wip.excede ? h('p', { class: 'ayuda' }, 'Sobre el límite: terminen algo antes de empezar otra cosa.') : null,
    h('ol', { class: 'fichas' }, lista.map(tarjeta)),
    estado === 'done' && archivadas ? h('p', { class: 'ayuda' }, `${archivadas} terminadas hace más de ${DIAS_VISIBLE_HECHO} días (siguen en las métricas).`) : null);
  };

  // Pull: traer del backlog, en su orden de prioridad
  const elegir = selector({ '': 'Elige una historia del backlog…', ...Object.fromEntries(backlog.slice(0, 50).map((x) => [x.id, x.titulo])) }, '', { 'aria-label': 'Historia del backlog para traer al tablero' });
  const traer = () => { if (elegir.value) app.cambiar((x) => traerAlTablero(x, [elegir.value])); };
  const traerSiguiente = () => { if (backlog[0]) app.cambiar((x) => traerAlTablero(x, [backlog[0].id])); };

  const cifra = (nombre, valor, extra, clave) => h('div', { class: 'cifra' }, h('dt', {}, nombre, clave ? termino(clave) : null), h('dd', {}, valor, extra ? h('span', { class: 'tarjeta-meta' }, extra) : null));

  return h('div', { class: 'vista' },
    h('header', { class: 'vista-cabecera' },
      h('p', { class: 'eyebrow' }, p.nombre),
      h('h1', {}, 'Tablero (flujo continuo)'),
      h('p', { class: 'bajada' }, 'Sin sprints: traes trabajo del backlog cuando hay capacidad y lo llevas hasta terminarlo. Para soporte, incidencias y mejoras que llegan todos los días. Se cambia a sprints en Ajustes › Flujo del tablero.')),
    h('dl', { class: 'cifras cifras--4' },
      cifra('En curso', String(m.enCurso), m.edadPromedio !== null ? ` · ${dias(m.edadPromedio)} en promedio` : '', 'wip'),
      cifra('Terminadas por semana', m.rendimiento.toLocaleString('es-CL'), ' (últimas 4)'),
      cifra('Tiempo de entrega', dias(m.entrega.p85), m.entrega.p85 !== null ? ' el 85% o menos' : '', 'entrega'),
      cifra('Tiempo de ciclo', dias(m.ciclo.p85), m.ciclo.p85 !== null ? ' el 85% o menos' : '')),
    verDaily
      ? panelDaily(app, { id: null, nombre: 'Tablero', objetivo: '', ultimaDaily: p.flujo?.ultimaDaily || null }, {
        alMarcar: (x, cuando) => ({ ...x, flujo: { ...x.flujo, ultimaDaily: cuando } }),
        alCerrar: () => { verDaily = false; app.render(); },
      })
      : null,
    h('div', { class: 'barra-filtros kanban-pull' },
      elegir,
      h('button', { type: 'button', class: 'btn btn--secundario', onclick: traer }, 'Traer al tablero'),
      backlog.length ? h('button', { type: 'button', class: 'btn-texto', onclick: traerSiguiente }, `Traer la siguiente: «${backlog[0].titulo}»`) : h('span', { class: 'ayuda' }, 'El backlog está vacío.'),
      verDaily ? null : h('button', { type: 'button', class: 'btn btn--secundario', onclick: () => { verDaily = true; app.render(); } }, 'Abrir la Daily')),
    visibles.length
      ? h('div', { class: `tablero tablero--${columnas.length}` }, columnas.map(columna))
      : vacio('El tablero está vacío.', 'Trae del backlog lo más importante. Trae solo lo que el equipo puede empezar: el límite de trabajo en curso evita tener veinte cosas abiertas y ninguna terminada.'),
    panelMetricas(p, m, ahora));
}

/** Rendimiento por semana y diagrama de flujo acumulado de los últimos 30 días. */
function panelMetricas(p, m, ahora) {
  const cfd = flujoAcumulado(p, ahora, 30);
  const maximo = Math.max(1, ...cfd.map((d) => d.porHacer + d.enCurso + d.hecho));
  const [ancho, alto, margen] = [600, 160, 24];
  const x = (i) => margen + (i / (cfd.length - 1)) * (ancho - margen - 6);
  const y = (v) => alto - margen - (v / maximo) * (alto - margen - 8);
  const banda = (abajo, arriba, clase) => svg('polygon', {
    class: clase,
    points: [...cfd.map((d, i) => `${x(i)},${y(arriba(d))}`), ...cfd.map((d, i) => `${x(i)},${y(abajo(d))}`).reverse()].join(' '),
  });
  const grafico = svg('svg', { viewBox: `0 0 ${ancho} ${alto}`, class: 'cfd', role: 'img', 'aria-label': `Flujo acumulado: hoy ${cfd.at(-1).hecho} hechas, ${cfd.at(-1).enCurso} en curso y ${cfd.at(-1).porHacer} por hacer` });
  grafico.append(
    banda((d) => 0, (d) => d.hecho, 'cfd-hecho'),
    banda((d) => d.hecho, (d) => d.hecho + d.enCurso, 'cfd-curso'),
    banda((d) => d.hecho + d.enCurso, (d) => d.hecho + d.enCurso + d.porHacer, 'cfd-hacer'),
  );
  for (const [i, d] of [[0, cfd[0]], [cfd.length - 1, cfd.at(-1)]]) {
    const t = svg('text', { x: x(i), y: alto - 6, 'text-anchor': i ? 'end' : 'start', class: 'etiqueta-eje' });
    t.textContent = new Date(`${d.dia}T12:00:00`).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
    grafico.append(t);
  }
  const maxSemana = Math.max(1, ...m.porSemana.map((s) => s.terminadas));
  return h('section', { class: 'panel', 'aria-labelledby': 'kb-metricas' },
    h('h2', { id: 'kb-metricas' }, 'Flujo', termino('cfd')),
    h('div', { class: 'kanban-metricas' },
      h('figure', {},
        grafico,
        h('figcaption', { class: 'ayuda' },
          h('span', { class: 'vsm-muestra cfd-hacer' }), ' por hacer  ', h('span', { class: 'vsm-muestra cfd-curso' }), ' en curso  ', h('span', { class: 'vsm-muestra cfd-hecho' }), ' hecho',
          ' · Si la banda «en curso» se ensancha, entra más de lo que sale.')),
      h('figure', {},
        h('ol', { class: 'kanban-semanas', 'aria-label': 'Terminadas por semana' }, m.porSemana.map((s) => {
          const barra = h('span', { class: 'kanban-barra' });
          barra.style.height = `${(s.terminadas / maxSemana) * 100}%`;
          return h('li', { title: `Semana del ${s.semana}: ${s.terminadas}` }, h('span', { class: 'kanban-valor' }, String(s.terminadas)), barra);
        })),
        h('figcaption', { class: 'ayuda' }, 'Terminadas por semana (últimas 8).'))));
}
