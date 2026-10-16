// Sprint: planificar con la capacidad del equipo, trabajar en un tablero y cerrar con burndown y velocidad.
import { h, campo } from './dom.js';
import { definicionesDe, avance, marcar } from '../nucleo/definiciones.js';
import { listaVerificacion } from './historia.js';
import { dependenciasPendientes, bloqueosDelSprint } from '../nucleo/dependencias.js';
import { columnasDe, usoWip, cicloPromedio, bloquear, desbloquear, diasBloqueada } from '../nucleo/flujo.js';
import { botonesMarkdown } from './compartir.js';
import { reporteSprint, notasDeVersion, informeCliente } from '../nucleo/reportes.js';
import { sugerirObjetivo } from '../nucleo/objetivo.js';
import { iaConfigurada, objetivoConIa, notasConIa } from '../ia.js';

let notasIa = null; // { sprintId, estado: 'corriendo'|'lista'|'error', texto, error }
import {
  nuevoSprint, sugerirSprint, resumenSprint, burndown, cerrarSprint, cambiarEstado, velocidad, puntosDe, ESTADOS, feedbackAHistorias,
} from '../nucleo/proyecto.js';

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
        id: 'objetivo-sprint', type: 'text', value: sprint.objetivo, placeholder: 'Qué valor entregamos al terminar', maxlength: 300,
        oninput: (e) => editarSprint({ objetivo: e.target.value }),
      })),
      h('div', { class: 'acciones acciones--compactas' },
        h('button', {
          type: 'button', class: 'btn-texto', disabled: !resumen.historias,
          title: resumen.historias ? null : 'Elige historias primero',
          onclick: () => { const o = sugerirObjetivo(app.proyecto, sprint.id); if (o) editarSprint({ objetivo: o }, true); },
        }, 'Sugerir un objetivo'),
        iaConfigurada(app.ia) ? h('button', {
          type: 'button', class: 'btn-texto', disabled: !resumen.historias,
          onclick: async (e) => {
            const boton = e.currentTarget;
            boton.disabled = true;
            boton.textContent = 'Pensando…';
            try {
              const hs = app.proyecto.historias.filter((x) => x.sprintId === sprint.id);
              editarSprint({ objetivo: await objetivoConIa(app.ia, hs, `Proyecto: ${app.proyecto.nombre}`) }, true);
            } catch (err) {
              app.avisar(err.message, 'error');
              boton.disabled = false;
              boton.textContent = 'Sugerir con IA';
            }
          },
        }, 'Sugerir con IA') : null)),
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
            avance(x, definicionesDe(p).ready, 'ready').completa ? '' : h('span', { class: 'chip chip--aviso', title: 'No cumple la Definition of Ready' }, ' no lista'),
            dependenciasPendientes(p, x).length ? h('span', { class: 'chip chip--aviso', title: `Espera a: ${dependenciasPendientes(p, x).map((d) => d.titulo).join(', ')}` }, ' depende de algo pendiente') : ''))))) : h('p', { class: 'vacio' }, 'El backlog está vacío.')),
      avisoDependencias(p, sprint.id),
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
  const COLUMNAS = columnasDe(p);
  // Si se desactivó la columna de revisión, lo que estaba en revisión se ve en "En curso"
  const enColumna = (x, estado) => x.estado === estado || (estado === 'doing' && x.estado === 'review' && !COLUMNAS.includes('review'));
  const moverA = (id, estado) => {
    const historia = p.historias.find((y) => y.id === id);
    app.cambiar((x) => ({ ...x, historias: x.historias.map((y) => (y.id === id ? cambiarEstado(y, estado) : y)) }));
    const faltan = estado === 'done' && historia ? avance(historia, dod, 'done').faltan.length : 0;
    if (faltan) app.avisar(`"${historia.titulo}" pasó a Hecho, pero le faltan ${faltan} puntos de la Definition of Done.`, 'error');
    const wip = usoWip(app.proyecto, sprint.id, estado);
    if (wip.excede) app.avisar(`"${ESTADOS[estado]}" tiene ${wip.cuenta} ítems y el límite es ${wip.limite}. Terminen algo antes de empezar más.`, 'error');
  };
  const terminadas = p.historias.filter((x) => x.sprintId === sprint.id && x.estado === 'done');
  const ciclo = cicloPromedio(terminadas);
  const bloqueadas = p.historias.filter((x) => x.sprintId === sprint.id && x.bloqueo && x.estado !== 'done');

  const columna = (estado) => {
    const hs = p.historias.filter((x) => x.sprintId === sprint.id && enColumna(x, estado));
    const i = COLUMNAS.indexOf(estado);
    const wip = usoWip(p, sprint.id, estado);
    return h('section', {
      class: `columna columna--${estado}`, 'aria-labelledby': `col-${estado}`,
      ondragover: (e) => { if (arrastrando) { e.preventDefault(); e.currentTarget.classList.add('is-destino'); } },
      ondragleave: (e) => e.currentTarget.classList.remove('is-destino'),
      ondrop: (e) => { e.preventDefault(); const id = arrastrando; arrastrando = null; if (id) moverA(id, estado); },
    },
    h('h2', { id: `col-${estado}` }, ESTADOS[estado],
      h('span', { class: `nav-conteo${wip.excede ? ' wip-excedido' : ''}`, title: wip.limite ? `Límite de trabajo en curso: ${wip.limite}` : null },
        wip.limite ? `${wip.cuenta}/${wip.limite}` : `${puntosDe(hs)} pts`)),
    h('ul', {}, hs.map((x) => h('li', {
      class: `ficha${x.bloqueo ? ' is-bloqueada' : ''}`, draggable: 'true',
      ondragstart: (e) => { arrastrando = x.id; e.dataTransfer.effectAllowed = 'move'; },
    },
    h('span', { class: 'ficha-titulo' }, x.titulo),
    x.bloqueo ? h('span', { class: 'bloqueo' }, h('strong', {}, 'Bloqueada'), ` hace ${diasBloqueada(x)} ${diasBloqueada(x) === 1 ? 'día' : 'días'}: ${x.bloqueo.motivo}`) : null,
    dependenciasPendientes(p, x).length && x.estado !== 'done' ? h('span', { class: 'chip chip--aviso' }, `espera a: ${dependenciasPendientes(p, x).map((d) => d.titulo).join(', ')}`) : null,
    estado !== 'todo' ? listaVerificacion(x, dod, 'done', (item, valor) => app.cambiar((y) => ({
      ...y, historias: y.historias.map((z) => (z.id === x.id ? marcar(z, 'done', item, valor) : z)),
    }), { redibujar: false })) : null,
    h('span', { class: 'ficha-pie' },
      h('span', { class: 'tarjeta-meta' }, x.puntos ? `${x.puntos} pts` : 'sin estimar'),
      estado !== 'done' ? h('button', {
        type: 'button', class: 'btn-texto ficha-bloqueo',
        onclick: () => {
          if (x.bloqueo) { app.cambiar((y) => ({ ...y, historias: y.historias.map((z) => (z.id === x.id ? desbloquear(z) : z)) })); return; }
          const motivo = prompt('¿Qué la bloquea? (por ejemplo: esperando credenciales del cliente)');
          if (motivo === null) return;
          try {
            app.cambiar((y) => ({ ...y, historias: y.historias.map((z) => (z.id === x.id ? bloquear(z, motivo) : z)) }));
          } catch (err) { app.avisar(err.message, 'error'); }
        },
      }, x.bloqueo ? 'Desbloquear' : 'Bloquear') : null,
      h('span', { class: 'tarjeta-mover' },
        i > 0 ? h('button', { type: 'button', class: 'icono', 'aria-label': `Mover a ${ESTADOS[COLUMNAS[i - 1]]}: ${x.titulo}`, onclick: () => moverA(x.id, COLUMNAS[i - 1]) }, '←') : null,
        i < COLUMNAS.length - 1 ? h('button', { type: 'button', class: 'icono', 'aria-label': `Mover a ${ESTADOS[COLUMNAS[i + 1]]}: ${x.titulo}`, onclick: () => moverA(x.id, COLUMNAS[i + 1]) }, '→') : null))))));
  };

  return h('div', {},
    h('dl', { class: 'cifras' },
      h('div', { class: 'cifra' }, h('dt', {}, 'Terminado'), h('dd', {}, `${resumen.hechos} / ${resumen.puntos} pts`)),
      h('div', { class: 'cifra' }, h('dt', {}, 'Días restantes'), h('dd', {}, String(restantes))),
      h('div', { class: 'cifra' }, h('dt', {}, 'Fechas'), h('dd', {}, `${formatear(sprint.inicio)} – ${formatear(sprint.fin)}`)),
      h('div', { class: 'cifra' }, h('dt', {}, 'Capacidad'), h('dd', {}, sprint.capacidad ? `${sprint.capacidad} pts` : '—')),
      h('div', { class: 'cifra' }, h('dt', {}, 'Tiempo de ciclo'), h('dd', {}, ciclo === null ? '—' : `${ciclo.toLocaleString('es-CL')} días`))),
    bloqueadas.length ? h('p', { class: 'aviso-bloqueos', role: 'status' }, `${bloqueadas.length} ${bloqueadas.length === 1 ? 'ítem bloqueado' : 'ítems bloqueados'}: pídelo en la Daily o escálalo hoy.`) : null,
    h('div', { class: `tablero tablero--${COLUMNAS.length}` }, COLUMNAS.map(columna)),
    seccionReview(app, sprint),
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
      }, 'Cerrar sprint')),
    h('div', { class: 'compartir' },
      botonesMarkdown(app, 'Informe para el cliente', 'informe-cliente', () => informeCliente(app.proyecto)),
      botonesMarkdown(app, 'Reporte del sprint', sprint.nombre, () => reporteSprint(app.proyecto, sprint.id)),
      botonesMarkdown(app, 'Notas de versión', `notas-${sprint.nombre}`, () => notasDeVersion(app.proyecto, { sprintId: sprint.id })),
      iaConfigurada(app.ia) ? h('button', {
        type: 'button', class: 'btn-texto', disabled: notasIa?.estado === 'corriendo',
        onclick: async () => {
          notasIa = { sprintId: sprint.id, estado: 'corriendo', texto: '', error: '' };
          app.render();
          try {
            notasIa.texto = await notasConIa(app.ia, notasDeVersion(app.proyecto, { sprintId: sprint.id }));
            notasIa.estado = 'lista';
          } catch (err) {
            notasIa.estado = 'error';
            notasIa.error = err.message;
          }
          app.render();
        },
      }, 'Redactar notas con IA') : null),
    notasIa?.sprintId === sprint.id ? panelNotasIa(app) : null);
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
    h('div', { class: 'tabla-scroll' }, h('table', { class: 'tabla' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Sprint'), h('th', {}, 'Fechas'), h('th', {}, 'Terminado'), h('th', {}, 'Capacidad'), h('th', {}, 'Compartir'))),
      h('tbody', {}, [...cerrados].reverse().map((s) => h('tr', {},
        h('td', {}, s.nombre),
        h('td', {}, `${formatear(s.inicio)} – ${formatear(s.fin)}`),
        h('td', {}, `${puntosDe(p.historias.filter((x) => x.sprintId === s.id && x.estado === 'done'))} pts`),
        h('td', {}, s.capacidad ? `${s.capacidad} pts` : '—'),
        h('td', {}, botonesMarkdown(app, 'Reporte', s.nombre, () => reporteSprint(app.proyecto, s.id)),
          botonesMarkdown(app, 'Notas de versión', `notas-${s.nombre}`, () => notasDeVersion(app.proyecto, { sprintId: s.id })))))))));
}

function formatear(iso) {
  const [a, m, d] = String(iso).split('-');
  return a && m && d ? `${d}-${m}` : iso;
}

/** Notas de versión redactadas por la IA: se pueden editar antes de copiarlas. */
function panelNotasIa(app) {
  if (notasIa.estado === 'corriendo') return h('p', { class: 'revision-paso--pensando', role: 'status' }, 'Redactando las notas de versión…');
  if (notasIa.estado === 'error') return h('p', { class: 'error', role: 'alert' }, notasIa.error);
  const area = h('textarea', { rows: 12, 'aria-label': 'Notas de versión redactadas con IA', oninput: (e) => { notasIa.texto = e.target.value; } }, notasIa.texto);
  return h('section', { class: 'panel', 'aria-label': 'Notas de versión con IA' },
    h('h2', {}, 'Notas de versión (borrador de la IA)'),
    h('p', { class: 'ayuda' }, 'Revísalas y corrígelas antes de publicarlas: la IA puede exagerar o equivocarse.'),
    area,
    h('div', { class: 'compartir' },
      botonesMarkdown(app, 'Notas', 'notas-version', () => notasIa.texto),
      h('button', { type: 'button', class: 'btn-texto', onclick: () => { notasIa = null; app.render(); } }, 'Cerrar')));
}

/** Lo que dicen los stakeholders en la Sprint Review, para que vuelva al backlog en vez de perderse. */
function seccionReview(app, sprint) {
  const area = h('textarea', {
    id: 'feedback-review', rows: 4, maxlength: 5000,
    placeholder: 'Una idea por línea. Ej.: - que el reporte se pueda filtrar por sucursal',
    oninput: (e) => app.cambiar((x) => ({ ...x, sprints: x.sprints.map((s) => (s.id === sprint.id ? { ...s, feedback: e.target.value } : s)) }), { redibujar: false }),
  }, sprint.feedback || '');
  return h('section', { class: 'panel', 'aria-labelledby': 'review-titulo' },
    h('h2', { id: 'review-titulo' }, 'Sprint Review: lo que dijeron los stakeholders'),
    h('p', { class: 'ayuda' }, 'Anota los comentarios durante la Review y pásalos al backlog para priorizarlos después.'),
    area,
    h('div', { class: 'acciones' },
      h('button', {
        type: 'button', class: 'btn btn--secundario',
        onclick: () => {
          const nuevas = feedbackAHistorias(app.proyecto, sprint.id, area.value);
          if (!nuevas.length) { app.avisar('Escribe al menos un comentario.', 'error'); return; }
          app.cambiarConDeshacer(`${nuevas.length} ${nuevas.length === 1 ? 'comentario pasó' : 'comentarios pasaron'} al backlog.`, (x) => ({
            ...x,
            historias: [...x.historias, ...nuevas],
            sprints: x.sprints.map((s) => (s.id === sprint.id ? { ...s, feedback: '' } : s)),
          }));
        },
      }, 'Pasar al backlog')));
}

/** En la planificación: historias del sprint que esperan algo que no está terminado ni entra en este sprint. */
function avisoDependencias(proyecto, sprintId) {
  const bloqueos = bloqueosDelSprint(proyecto, sprintId);
  if (!bloqueos.length) return null;
  return h('ul', { class: 'invest' }, bloqueos.map((b) => h('li', { class: 'invest--aviso' },
    `"${b.historia.titulo}" depende de ${b.espera.map((d) => `"${d.titulo}"`).join(', ')}, que no está terminada ni en este sprint.`)));
}
