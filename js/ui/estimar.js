// Estimación en equipo en una sola pantalla: cada persona elige su carta sin ver las demás,
// se revelan juntas y se acuerda el valor. Pensado para una reunión (presencial o compartiendo pantalla).
import { h } from './dom.js';
import { enunciado, ESCALA_PUNTOS } from '../nucleo/historias.js';
import { consenso, siguienteSinEstimar } from '../nucleo/estimacion.js';

const sesion = {
  participantes: ['Persona 1', 'Persona 2', 'Persona 3'],
  historiaId: null,
  votos: {},       // nombre → número o "?"
  eligiendo: null, // nombre de quien está eligiendo su carta
  revelado: false,
};

const CARTAS = [...ESCALA_PUNTOS, '?'];

function reiniciarRonda() {
  sesion.votos = {};
  sesion.eligiendo = null;
  sesion.revelado = false;
}

export function vistaEstimar(app) {
  const historias = app.proyecto.historias;
  let actual = historias.find((x) => x.id === sesion.historiaId && x.estado === 'backlog' && !x.puntos);
  if (!actual) {
    actual = siguienteSinEstimar(historias);
    sesion.historiaId = actual?.id || null;
    reiniciarRonda();
  }
  const pendientes = historias.filter((x) => x.estado === 'backlog' && !x.puntos && x.prioridad !== 'wont').length;

  return h('div', { class: 'estimar' },
    participantes(app),
    actual ? ronda(app, actual, pendientes) : h('div', { class: 'vacio' },
      h('p', {}, '¡Todo el backlog está estimado!'),
      h('p', { class: 'ayuda' }, 'Agrega historias o quita la estimación de alguna para volver a estimarla.')));
}

function participantes(app) {
  return h('details', { class: 'panel participantes' },
    h('summary', {}, `Participantes: ${sesion.participantes.join(', ')}`),
    h('label', { for: 'participantes', class: 'etiqueta' }, 'Nombres separados por coma'),
    h('input', {
      id: 'participantes', type: 'text', value: sesion.participantes.join(', '),
      onchange: (e) => {
        const nombres = [...new Set(e.target.value.split(',').map((n) => n.trim()).filter(Boolean))].slice(0, 12);
        if (nombres.length) sesion.participantes = nombres;
        reiniciarRonda();
        app.render();
      },
    }));
}

function ronda(app, historia, pendientes) {
  const votaron = sesion.participantes.filter((n) => n in sesion.votos).length;
  const todos = votaron === sesion.participantes.length;

  const fijar = (puntos) => {
    const siguiente = siguienteSinEstimar(app.proyecto.historias, historia.id);
    app.cambiar((x) => ({ ...x, historias: x.historias.map((y) => (y.id === historia.id ? { ...y, puntos } : y)) }), { redibujar: false });
    sesion.historiaId = siguiente?.id || null;
    reiniciarRonda();
    app.avisar(`"${historia.titulo}": ${puntos} puntos.`);
    app.render();
  };

  return h('section', { class: 'panel', 'aria-labelledby': 'estimar-titulo' },
    h('p', { class: 'eyebrow' }, `${pendientes} ${pendientes === 1 ? 'historia' : 'historias'} por estimar`),
    h('h2', { id: 'estimar-titulo' }, historia.titulo),
    h('p', { class: 'enunciado' }, enunciado(historia)),
    historia.criterios.length ? h('ul', { class: 'criterios' }, historia.criterios.map((c) => h('li', {}, c))) : null,

    sesion.eligiendo ? eleccion(app) : h('ul', { class: 'votantes' }, sesion.participantes.map((nombre) => {
      const voto = sesion.votos[nombre];
      return h('li', {},
        h('span', { class: 'votante-nombre' }, nombre),
        sesion.revelado
          ? h('span', { class: `carta carta--revelada${voto === undefined ? ' carta--vacia' : ''}` }, voto === undefined ? '—' : String(voto))
          : h('button', {
            type: 'button', class: voto === undefined ? 'btn btn--secundario' : 'carta carta--boca-abajo',
            'aria-label': voto === undefined ? `Elegir carta de ${nombre}` : `${nombre} ya votó. Cambiar voto`,
            onclick: () => { sesion.eligiendo = nombre; app.render(); },
          }, voto === undefined ? 'Elegir carta' : '✓'));
    })),

    sesion.eligiendo ? null : sesion.revelado ? resultado(app, fijar) : h('div', { class: 'acciones' },
      h('button', {
        type: 'button', class: 'btn btn--cobre', disabled: !votaron,
        onclick: () => { sesion.revelado = true; app.render(); },
      }, todos ? 'Mostrar las cartas' : `Mostrar las cartas (${votaron} de ${sesion.participantes.length})`),
      h('button', {
        type: 'button', class: 'btn-texto',
        onclick: () => {
          sesion.historiaId = siguienteSinEstimar(app.proyecto.historias, historia.id)?.id || null;
          reiniciarRonda();
          app.render();
        },
      }, 'Saltar esta historia')));
}

/** Pantalla privada para elegir carta: las demás no se ven. */
function eleccion(app) {
  const nombre = sesion.eligiendo;
  return h('div', { class: 'eleccion', role: 'group', 'aria-label': `Cartas de ${nombre}` },
    h('p', {}, h('strong', {}, nombre), ', elige tu carta (los demás no miran):'),
    h('div', { class: 'mazo' }, CARTAS.map((c) => h('button', {
      type: 'button', class: 'carta', 'aria-label': c === '?' ? 'No sé' : `${c} puntos`,
      onclick: () => { sesion.votos[nombre] = c; sesion.eligiendo = null; app.render(); },
    }, String(c)))),
    h('button', { type: 'button', class: 'btn-texto', onclick: () => { sesion.eligiendo = null; app.render(); } }, 'Cancelar'));
}

function resultado(app, fijar) {
  const r = consenso(Object.values(sesion.votos));
  const mensaje = r.sugerencia === null
    ? 'Nadie se atrevió con un número. Conversen qué falta saber.'
    : r.acuerdo ? `Hay acuerdo: ${r.sugerencia} puntos.`
      : `Hay diferencias (de ${r.min} a ${r.max}${r.dudas ? `, y ${r.dudas} "no sé"` : ''}). Que expliquen quienes votaron más alto y más bajo, y voten de nuevo.`;

  return h('div', { class: `resultado${r.conversar ? ' resultado--conversar' : ''}` },
    h('p', { role: 'status' }, mensaje),
    h('div', { class: 'acciones' },
      r.sugerencia !== null ? h('button', { type: 'button', class: 'btn btn--cobre', onclick: () => fijar(r.sugerencia) }, `Usar ${r.sugerencia} puntos`) : null,
      h('button', { type: 'button', class: 'btn btn--secundario', onclick: () => { reiniciarRonda(); app.render(); } }, 'Votar de nuevo')),
    h('p', { class: 'ayuda' }, 'O fija otro valor: ',
      ESCALA_PUNTOS.map((p) => h('button', { type: 'button', class: 'carta carta--mini', 'aria-label': `Fijar ${p} puntos`, onclick: () => fijar(p) }, String(p)))));
}
