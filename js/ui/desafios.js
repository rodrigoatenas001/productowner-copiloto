// Desafíos del taller: pronosticar, clasificar ítems y validar hipótesis, con respuesta inmediata.
import { h, selector } from './dom.js';
import { TIPOS } from '../nucleo/historias.js';
import {
  desafioPronostico, evaluarPronostico, desafioClasificar, evaluarClasificacion, desafioHipotesis, OPCIONES_HIPOTESIS,
} from '../nucleo/desafios.js';

const estado = {
  pronostico: desafioPronostico(),
  resPronostico: null,
  clasificar: desafioClasificar(),
  elegidos: [],
  resClasificar: null,
  hipotesis: desafioHipotesis(),
  resHipotesis: null,
};

export function vistaDesafios(app) {
  return h('div', { class: 'desafios' },
    pronostico(app),
    clasificar(app),
    hipotesis(app));
}

function pronostico(app) {
  const d = estado.pronostico;
  const entrada = h('input', { type: 'number', min: 1, max: 50, class: 'input-corto', 'aria-label': 'Sprints que faltan (probable)' });
  return h('section', { class: 'panel', 'aria-labelledby': 'des-pron' },
    h('p', { class: 'eyebrow' }, 'Desafío 1 · Pronóstico'),
    h('h2', { id: 'des-pron' }, '¿Cuántos sprints faltan?'),
    h('p', {}, `Los últimos tres sprints terminaron ${d.velocidades.join(', ')} puntos. Quedan ${d.restante} puntos en el backlog. ¿Cuántos sprints faltan, en el escenario probable?`),
    h('div', { class: 'fila-accion fila-accion--dos' }, entrada,
      h('button', { type: 'button', class: 'btn', onclick: () => { if (entrada.value) { estado.resPronostico = evaluarPronostico(d, entrada.value); app.render(); } } }, 'Responder')),
    estado.resPronostico ? h('div', { class: `resultado${estado.resPronostico.nivel === 'exacto' ? '' : ' resultado--conversar'}`, role: 'status' },
      h('p', {}, estado.resPronostico.texto),
      h('p', { class: 'ayuda' }, d.explicacion)) : null,
    h('button', { type: 'button', class: 'btn-texto', onclick: () => { estado.pronostico = desafioPronostico(); estado.resPronostico = null; app.render(); } }, 'Otro caso'));
}

function clasificar(app) {
  const items = estado.clasificar;
  const r = estado.resClasificar;
  return h('section', { class: 'panel', 'aria-labelledby': 'des-clas' },
    h('p', { class: 'eyebrow' }, 'Desafío 2 · Tipos de ítem'),
    h('h2', { id: 'des-clas' }, '¿Historia, bug, spike o deuda técnica?'),
    h('ol', { class: 'clasificar' }, items.map((it, i) => h('li', {},
      h('span', {}, it.texto),
      selector({ '': 'Elige…', ...TIPOS }, estado.elegidos[i] || '', {
        'aria-label': `Tipo de: ${it.texto}`, disabled: Boolean(r),
        onchange: (e) => { estado.elegidos[i] = e.target.value; },
      }),
      r ? h('p', { class: r.detalle[i].correcto ? 'invest-ok' : 'error' }, r.detalle[i].correcto ? `✓ ${it.porque}` : `Es ${TIPOS[it.tipo].toLowerCase()}: ${it.porque}`) : null))),
    r ? h('p', { role: 'status' }, h('strong', {}, `${r.aciertos} de ${r.total} correctas.`)) : null,
    h('div', { class: 'acciones' },
      !r ? h('button', { type: 'button', class: 'btn', onclick: () => { estado.resClasificar = evaluarClasificacion(items, estado.elegidos); app.render(); } }, 'Revisar') : null,
      h('button', { type: 'button', class: 'btn-texto', onclick: () => { estado.clasificar = desafioClasificar(); estado.elegidos = []; estado.resClasificar = null; app.render(); } }, 'Otros ítems')));
}

function hipotesis(app) {
  const d = estado.hipotesis;
  return h('section', { class: 'panel', 'aria-labelledby': 'des-hip' },
    h('p', { class: 'eyebrow' }, 'Desafío 3 · Validar una hipótesis'),
    h('h2', { id: 'des-hip' }, '¿Se cumplió?'),
    h('p', { class: 'hipotesis-frase' }, d.hipotesis),
    h('p', {}, h('strong', {}, 'Dato medido: '), d.dato),
    h('div', { class: 'acciones' }, Object.entries(OPCIONES_HIPOTESIS).map(([clave, texto]) => h('button', {
      type: 'button', class: estado.resHipotesis === clave ? 'btn' : 'btn btn--secundario',
      onclick: () => { estado.resHipotesis = clave; app.render(); },
    }, texto))),
    estado.resHipotesis ? h('div', { class: `resultado${estado.resHipotesis === d.respuesta ? '' : ' resultado--conversar'}`, role: 'status' },
      h('p', {}, estado.resHipotesis === d.respuesta ? '¡Correcto!' : `La respuesta es: ${OPCIONES_HIPOTESIS[d.respuesta].toLowerCase()}.`),
      h('p', { class: 'ayuda' }, d.porque)) : null,
    h('button', { type: 'button', class: 'btn-texto', onclick: () => { estado.hipotesis = desafioHipotesis(); estado.resHipotesis = null; app.render(); } }, 'Otra hipótesis'));
}
