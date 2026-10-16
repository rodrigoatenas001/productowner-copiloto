// Taller: herramientas para cursos, bootcamps y reuniones de equipo.
import { h } from './dom.js';
import { vistaTrivia } from './trivia.js';
import { vistaDesafios } from './desafios.js';
import { CASOS, evaluarEjercicio } from '../nucleo/ejercicios.js';
import { insigniaCalidad, listaAvisos } from './historia.js';
import { enunciado } from '../nucleo/historias.js';

let pestana = 'trivia';
const ejercicio = { casoId: CASOS[0].id, textos: {}, resultado: null, verEjemplo: false };

export function vistaTaller(app) {
  return h('div', { class: 'vista' },
    h('header', { class: 'vista-cabecera' },
      h('p', { class: 'eyebrow' }, 'Para cursos y equipos'),
      h('h1', {}, 'Taller'),
      h('p', { class: 'bajada' }, 'Trivia para proyectar en una clase o retrospectiva, y ejercicios prácticos de historias de usuario con retroalimentación inmediata.')),
    h('div', { class: 'pestanas', role: 'tablist', 'aria-label': 'Herramientas del taller' },
      Object.entries({ trivia: 'Trivia', ejercicios: 'Ejercicios de historias', desafios: 'Desafíos' }).map(([clave, texto]) => h('button', {
        type: 'button', role: 'tab', class: 'pestana', 'aria-selected': String(pestana === clave),
        onclick: () => { pestana = clave; app.render(); },
      }, texto))),
    pestana === 'trivia' ? vistaTrivia(app) : pestana === 'desafios' ? vistaDesafios(app) : vistaEjercicios(app));
}

function vistaEjercicios(app) {
  const caso = CASOS.find((c) => c.id === ejercicio.casoId) || CASOS[0];
  const r = ejercicio.resultado;
  const area = h('textarea', {
    id: 'respuesta-ejercicio', rows: 8,
    placeholder: 'Una historia por línea. Ej.: Como clienta, quiero…, para…',
    oninput: (e) => { ejercicio.textos[caso.id] = e.target.value; },
  }, ejercicio.textos[caso.id] || '');

  return h('div', { class: 'ejercicios' },
    h('div', { class: 'casos', role: 'list' }, CASOS.map((c) => h('button', {
      type: 'button', role: 'listitem', class: `caso${c.id === caso.id ? ' is-activo' : ''}`, 'aria-pressed': String(c.id === caso.id),
      onclick: () => { ejercicio.casoId = c.id; ejercicio.resultado = null; ejercicio.verEjemplo = false; app.render(); },
    }, h('span', { class: 'caso-nivel' }, c.nivel), h('span', { class: 'caso-titulo' }, c.titulo)))),

    h('section', { class: 'panel', 'aria-labelledby': 'caso-titulo' },
      h('p', { class: 'eyebrow' }, `Caso · ${caso.nivel}`),
      h('h2', { id: 'caso-titulo' }, caso.titulo),
      h('p', {}, caso.contexto),
      h('p', { class: 'consigna' }, caso.consigna),
      h('label', { for: 'respuesta-ejercicio', class: 'etiqueta' }, 'Tus historias'),
      area,
      h('div', { class: 'acciones' },
        h('button', {
          type: 'button', class: 'btn btn--cobre',
          onclick: () => { ejercicio.resultado = evaluarEjercicio(caso, area.value); app.render(); document.getElementById('evaluacion')?.scrollIntoView({ behavior: 'smooth' }); },
        }, 'Revisar mis historias'),
        h('button', { type: 'button', class: 'btn-texto', onclick: () => { ejercicio.verEjemplo = !ejercicio.verEjemplo; app.render(); } },
          ejercicio.verEjemplo ? 'Ocultar una posible solución' : 'Ver una posible solución')),
      ejercicio.verEjemplo ? h('div', { class: 'nota-tecnica' },
        h('p', {}, h('strong', {}, 'Una posible solución (hay muchas buenas):')),
        h('ul', {}, caso.ejemplo.map((x) => h('li', {}, x)))) : null),

    r ? h('section', { class: 'panel', id: 'evaluacion', 'aria-labelledby': 'eval-titulo' },
      h('div', { class: 'candidatas-cabecera' },
        h('h2', { id: 'eval-titulo' }, 'Retroalimentación'),
        h('span', { class: `puntaje puntaje--${r.puntaje >= 75 ? 'alto' : r.puntaje >= 50 ? 'medio' : 'bajo'}` }, `${r.puntaje} / 100`)),
      h('ul', { class: 'comentarios' }, r.comentarios.map((c) => h('li', {}, c))),
      h('h3', {}, 'Necesidades del caso'),
      h('ul', { class: 'cobertura' }, r.cobertura.map((c) => h('li', { class: c.cubierta ? 'is-cubierta' : '' },
        h('span', { 'aria-hidden': 'true' }, c.cubierta ? '✓' : '○'), ' ', c.nombre, h('span', { class: 'sr-only' }, c.cubierta ? ' (cubierta)' : ' (sin cubrir)')))),
      r.historias.length ? h('h3', {}, 'Tus historias, una por una') : null,
      h('ol', { class: 'lista-candidatas' }, r.historias.map((x) => h('li', { class: 'panel historia-evaluada' },
        h('div', { class: 'candidatas-cabecera' }, h('p', { class: 'enunciado' }, enunciado(x)), insigniaCalidad(x)),
        listaAvisos(x)))),
      r.historias.length ? h('div', { class: 'acciones' },
        h('button', {
          type: 'button', class: 'btn btn--secundario',
          onclick: () => {
            const nuevas = r.historias.map((x) => ({ ...x, epica: x.epica || caso.titulo }));
            app.ir('backlog');
            app.cambiarConDeshacer(`${nuevas.length} historias del ejercicio agregadas al backlog.`, (p) => ({ ...p, historias: [...p.historias, ...nuevas] }));
          },
        }, 'Llevarlas al backlog')) : null) : null);
}
