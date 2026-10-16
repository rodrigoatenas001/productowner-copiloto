// Sprint: planificar con la capacidad del equipo, trabajar en un tablero y cerrar con burndown y velocidad.
import { h, campo } from './dom.js';
import { definicionesDe, avance, marcar } from '../nucleo/definiciones.js';
import { listaVerificacion } from './historia.js';
import {
  nuevoSprint, sugerirSprint, resumenSprint, burndown, cerrarSprint, cambiarEstado, velocidad, puntosDe, ESTADOS,
} from '../nucleo/proyecto.js';

const COLUMNAS = ['todo', 'doing', 'done'];
let arrastrando = null;

export function vistaSprint(app) {
  const p = app.proyecto;
  const activo = p.sprints.find((s) => s.estado === 'activo');
  const planificado = p.sprints.find((s) => s.estado === 'planificado');
  const cerrados = p.sprints.filter((s) => s.estado === 'cerrado');

  return h('div', { class: 'vista' },
    h('header', { class: 'vista-cabecera' },
      h('p', { class: 'eyebrow' }, p.nombre),
      h('h1', {}, activo ? activo.nombre : planificado ? `Planificar ${planificado.nombre}` : 'Sprints'),
      activo?.objetivo ? h('p', { class: 'bajada' }, `Objetivo: ${activo.objetivo}`) : null),
    activo ? tablero(app, activo) : planificado ? planificar(app, planificado) : sinSprint(app),
    cerrados.length ? historial(app, cerrados) : null);
}

function sinSprint(app) {
  const vel = velocidad(app.proyecto);
  return h('div', { class: 'vacio' },
    h('p', {}, 'No hay un sprint en curso.'),
    vel ? h('p', { class: 'ayuda' }, `Tu velocidad promedio es ${vel} puntos por sprint.`) : null,
    h('button', {
      type: 'button', class: 'btn',
      onclick: () => app.cambiar((x) => ({ ...x, sprints: [...x.sprints, nuevoSprint(x)] })),
    }, 'Planificar un sprint'));
}

function planificar(app, sprint) {
  const p = app.proyecto;
  const resumen = resumenSprint(sprint, p.historias);
  const editarSprint = (cambios, redibujar = false) => app.cambiar((x) => ({ ...x, sprints: x.sprints.map((s) => (s.id === sprint.id ? { ...s, ...cambios } : s)) }), { redibujar });
  const alternar = (id, incluir) => app.cambiar((x) => ({
    ...x,
    historias: x.historias.map((y) => (y.id === id ? { ...y, sprintId: incluir ? sprint.id : null, estado: incluir ? 'todo' : 'backlog' } : y)),
  }));
  const candidatas = p.historias.filter((x) => x.estado === 'backlog' || x.sprintId === sprint.id);
  const capacidad = sprint.capacidad || 0;
  const porcentaje = capacidad ? Math.min(100, Math.round((resumen.puntos / capacidad) * 100)) : 0;

  return h('div', { class: 'planificacion' },
    h('section', { class: 'panel', 'aria-labelledby': 'datos-sprint' },
      h('h2', { id: 'datos-sprint' }, 'Datos del sprint'),
      h('div', { class: 'editor-fila' },
        campo('Inicio', h('input', { type: 'date', value: sprint.inicio, onchange: (e) => editarSprint({ inicio: e.target.value }, true) })),
        campo('Fin', h('input', { type: 'date', value: sprint.fin, min: sprint.inicio, onchange: (e) => editarSprint({ fin: e.target.value }, true) })),
        campo('Capacidad (puntos)', h('input', {
          type: 'number', min: 0, max: 500, value: sprint.capacidad ?? '',
          onchange: (e) => editarSprint({ capacidad: e.target.value === '' ? null : Math.max(0, Number(e.target.value)) }, true),
        }), velocidad(p) ? `Velocidad promedio: ${velocidad(p)} pts.` : 'Sin sprints anteriores: estima cuánto alcanzan a terminar.')),
      campo('Objetivo del sprint', h('input', {
        type: 'text', value: sprint.objetivo, placeholder: 'Qué valor entregamos al terminar', maxlength: 300,
        oninput: (e) => editarSprint({ objetivo: e.target.value }),
      }))),
    h('section', { class: 'panel', 'aria-labelledby': 'elegir-historias' },
      h('div', { class: 'candidatas-cabecera' },
        h('h2', { id: 'elegir-historias' }, 'Historias del sprint'),
        h('button', {
          type: 'button', class: 'btn btn--secundario', disabled: !capacidad,
          title: capacidad ? null : 'Indica la capacidad primero',
          onclick: () => {
            const libres = { ...p, historias: p.historias.filter((x) => x.sprintId !== sprint.id) };
            const { ids, puntos } = sugerirSprint(libres, capacidad - resumen.puntos);
            if (!ids.length) { app.avisar('No hay más historias estimadas que quepan.', 'error'); return; }
            app.cambiar((x) => ({ ...x, historias: x.historias.map((y) => (ids.includes(y.id) ? { ...y, sprintId: sprint.id, estado: 'todo' } : y)) }));
            app.avisar(`Agregamos ${ids.length} historias (${puntos} pts) en orden de prioridad.`);
          },
        }, 'Sugerir según capacidad')),
      h('div', { class: `capacidad${resumen.sobrecarga ? ' is-sobrecarga' : ''}` },
        h('div', { class: 'capacidad-barra', role: 'meter', 'aria-valuemin': 0, 'aria-valuemax': capacidad || resumen.puntos || 1, 'aria-valuenow': resumen.puntos, 'aria-label': 'Puntos comprometidos' },
          h('span', { class: `relleno-${Math.round(porcentaje / 5) * 5}` })),
        h('p', {}, `${resumen.puntos} de ${capacidad || '?'} puntos`, resumen.sobrecarga ? ' · supera la capacidad' : '', resumen.sinEstimar ? ` · ${resumen.sinEstimar} sin estimar` : '')),
      candidatas.length ? h('ul', { class: 'lista-elegir' }, candidatas.map((x) => h('li', {},
        h('label', {},
          h('input', { type: 'checkbox', checked: x.sprintId === sprint.id, onchange: (e) => alternar(x.id, e.target.checked) }),
          h('span', {}, x.titulo),
          h('span', { class: 'tarjeta-meta' }, x.puntos ? `${x.puntos} pts` : 'sin estimar',
            avance(x, definicionesDe(p).ready, 'ready').completa ? '' : h('span', { class: 'chip chip--aviso', title: 'No cumple la Definition of Ready' }, ' no lista')))))) : h('p', { class: 'vacio' }, 'El backlog está vacío.')),
    h('div', { class: 'acciones' },
      h('button', {
        type: 'button', class: 'btn btn--cobre', disabled: !resumen.historias,
        onclick: () => {
          app.cambiar((x) => ({ ...x, sprints: x.sprints.map((s) => (s.id === sprint.id ? { ...s, estado: 'activo' } : s)) }));
          app.avisar(`${sprint.nombre} iniciado.`);
        },
      }, 'Iniciar sprint'),
      h('button', {
        type: 'button', class: 'btn-texto btn-peligro',
        onclick: () => {
          app.cambiarConDeshacer('Planificación descartada. Las historias volvieron al backlog.', (x) => ({
            ...x,
            sprints: x.sprints.filter((s) => s.id !== sprint.id),
            historias: x.historias.map((y) => (y.sprintId === sprint.id ? { ...y, sprintId: null, estado: 'backlog' } : y)),
          }));
        },
      }, 'Descartar')));
}

function tablero(app, sprint) {
  const p = app.proyecto;
  const resumen = resumenSprint(sprint, p.historias);
  const hoy = new Date().toISOString().slice(0, 10);
  const restantes = Math.max(0, Math.round((new Date(sprint.fin) - new Date(hoy)) / 86400000));
  const dod = definicionesDe(p).done;
  const moverA = (id, estado) => {
    const historia = p.historias.find((y) => y.id === id);
    app.cambiar((x) => ({ ...x, historias: x.historias.map((y) => (y.id === id ? cambiarEstado(y, estado) : y)) }));
    const faltan = estado === 'done' && historia ? avance(historia, dod, 'done').faltan.length : 0;
    if (faltan) app.avisar(`"${historia.titulo}" pasó a Hecho, pero le faltan ${faltan} puntos de la Definition of Done.`, 'error');
  };

  const columna = (estado) => {
    const hs = p.historias.filter((x) => x.sprintId === sprint.id && x.estado === estado);
    const i = COLUMNAS.indexOf(estado);
    return h('section', {
      class: `columna columna--${estado}`, 'aria-labelledby': `col-${estado}`,
      ondragover: (e) => { if (arrastrando) { e.preventDefault(); e.currentTarget.classList.add('is-destino'); } },
      ondragleave: (e) => e.currentTarget.classList.remove('is-destino'),
      ondrop: (e) => { e.preventDefault(); const id = arrastrando; arrastrando = null; if (id) moverA(id, estado); },
    },
    h('h2', { id: `col-${estado}` }, ESTADOS[estado], h('span', { class: 'nav-conteo' }, `${puntosDe(hs)} pts`)),
    h('ul', {}, hs.map((x) => h('li', {
      class: 'ficha', draggable: 'true',
      ondragstart: (e) => { arrastrando = x.id; e.dataTransfer.effectAllowed = 'move'; },
    },
    h('span', { class: 'ficha-titulo' }, x.titulo),
    estado !== 'todo' ? listaVerificacion(x, dod, 'done', (item, valor) => app.cambiar((y) => ({
      ...y, historias: y.historias.map((z) => (z.id === x.id ? marcar(z, 'done', item, valor) : z)),
    }), { redibujar: false })) : null,
    h('span', { class: 'ficha-pie' },
      h('span', { class: 'tarjeta-meta' }, x.puntos ? `${x.puntos} pts` : 'sin estimar'),
      h('span', { class: 'tarjeta-mover' },
        i > 0 ? h('button', { type: 'button', class: 'icono', 'aria-label': `Mover a ${ESTADOS[COLUMNAS[i - 1]]}: ${x.titulo}`, onclick: () => moverA(x.id, COLUMNAS[i - 1]) }, '←') : null,
        i < COLUMNAS.length - 1 ? h('button', { type: 'button', class: 'icono', 'aria-label': `Mover a ${ESTADOS[COLUMNAS[i + 1]]}: ${x.titulo}`, onclick: () => moverA(x.id, COLUMNAS[i + 1]) }, '→') : null))))));
  };

  return h('div', {},
    h('dl', { class: 'cifras' },
      h('div', { class: 'cifra' }, h('dt', {}, 'Terminado'), h('dd', {}, `${resumen.hechos} / ${resumen.puntos} pts`)),
      h('div', { class: 'cifra' }, h('dt', {}, 'Días restantes'), h('dd', {}, String(restantes))),
      h('div', { class: 'cifra' }, h('dt', {}, 'Fechas'), h('dd', {}, `${formatear(sprint.inicio)} – ${formatear(sprint.fin)}`)),
      h('div', { class: 'cifra' }, h('dt', {}, 'Capacidad'), h('dd', {}, sprint.capacidad ? `${sprint.capacidad} pts` : '—'))),
    h('div', { class: 'tablero' }, COLUMNAS.map(columna)),
    h('section', { class: 'panel', 'aria-labelledby': 'burndown-titulo' },
      h('h2', { id: 'burndown-titulo' }, 'Burndown'),
      graficoBurndown(burndown(sprint, p.historias))),
    h('div', { class: 'acciones' },
      h('button', {
        type: 'button', class: 'btn',
        onclick: () => {
          const pendientes = p.historias.filter((x) => x.sprintId === sprint.id && x.estado !== 'done').length;
          const extra = pendientes ? ` ${pendientes} sin terminar volvieron al inicio del backlog.` : '';
          app.cambiarConDeshacer(`${sprint.nombre} cerrado: ${resumen.hechos} puntos terminados.${extra} Buen momento para la retrospectiva.`, (x) => cerrarSprint(x, sprint.id));
        },
      }, 'Cerrar sprint')));
}

/** Gráfico SVG accesible: línea ideal y real, con tabla equivalente para lectores de pantalla. */
function graficoBurndown(datos) {
  const ns = 'http://www.w3.org/2000/svg';
  const ancho = 640;
  const alto = 220;
  const margen = { izq: 36, der: 12, arr: 12, abj: 28 };
  const maximo = Math.max(1, ...datos.map((d) => d.ideal), ...datos.map((d) => d.pendiente ?? 0));
  const x = (i) => margen.izq + (i * (ancho - margen.izq - margen.der)) / Math.max(1, datos.length - 1);
  const y = (v) => margen.arr + (1 - v / maximo) * (alto - margen.arr - margen.abj);
  const svg = (tag, attrs) => { const el = document.createElementNS(ns, tag); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v); return el; };

  const lienzo = svg('svg', { viewBox: `0 0 ${ancho} ${alto}`, class: 'burndown', role: 'img', 'aria-label': 'Burndown: puntos pendientes por día comparados con la línea ideal' });
  lienzo.append(svg('line', { x1: margen.izq, y1: y(0), x2: ancho - margen.der, y2: y(0), class: 'eje' }));
  [0, Math.round(maximo / 2), maximo].forEach((v) => {
    const t = svg('text', { x: margen.izq - 6, y: y(v) + 4, 'text-anchor': 'end', class: 'etiqueta-eje' });
    t.textContent = v;
    lienzo.append(t);
  });
  lienzo.append(svg('polyline', { points: datos.map((d, i) => `${x(i)},${y(d.ideal)}`).join(' '), class: 'linea-ideal' }));
  const reales = datos.map((d, i) => [i, d.pendiente]).filter(([, v]) => v !== null);
  if (reales.length) {
    lienzo.append(svg('polyline', { points: reales.map(([i, v]) => `${x(i)},${y(v)}`).join(' '), class: 'linea-real' }));
    const [ui, uv] = reales[reales.length - 1];
    lienzo.append(svg('circle', { cx: x(ui), cy: y(uv), r: 4, class: 'punto-real' }));
  }
  [0, datos.length - 1].forEach((i) => {
    const t = svg('text', { x: x(i), y: alto - 8, 'text-anchor': i ? 'end' : 'start', class: 'etiqueta-eje' });
    t.textContent = formatear(datos[i].dia);
    lienzo.append(t);
  });

  return h('figure', { class: 'figura-burndown' },
    lienzo,
    h('figcaption', { class: 'leyenda' }, h('span', { class: 'leyenda-real' }, 'Pendiente real'), h('span', { class: 'leyenda-ideal' }, 'Ideal')),
    h('details', { class: 'tabla-alternativa' }, h('summary', {}, 'Ver como tabla'),
      h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Día'), h('th', {}, 'Pendiente'), h('th', {}, 'Ideal'))),
        h('tbody', {}, datos.map((d) => h('tr', {}, h('td', {}, formatear(d.dia)), h('td', {}, d.pendiente ?? '—'), h('td', {}, String(d.ideal))))))));
}

function historial(app, cerrados) {
  const p = app.proyecto;
  return h('section', { class: 'panel', 'aria-labelledby': 'historial-titulo' },
    h('h2', { id: 'historial-titulo' }, 'Sprints anteriores'),
    h('p', { class: 'ayuda' }, `Velocidad promedio (últimos 3): ${velocidad(p)} puntos.`),
    h('table', { class: 'tabla' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Sprint'), h('th', {}, 'Fechas'), h('th', {}, 'Terminado'), h('th', {}, 'Capacidad'))),
      h('tbody', {}, [...cerrados].reverse().map((s) => h('tr', {},
        h('td', {}, s.nombre),
        h('td', {}, `${formatear(s.inicio)} – ${formatear(s.fin)}`),
        h('td', {}, `${puntosDe(p.historias.filter((x) => x.sprintId === s.id && x.estado === 'done'))} pts`),
        h('td', {}, s.capacidad ? `${s.capacidad} pts` : '—'))))));
}

function formatear(iso) {
  const [a, m, d] = String(iso).split('-');
  return a && m && d ? `${d}-${m}` : iso;
}
