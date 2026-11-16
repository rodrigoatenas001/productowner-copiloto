// «Cómo funciona»: mapa del flujo de trabajo del copiloto, de las notas del cliente a la entrega.
// Cada etapa lleva a la sección donde se hace y muestra en qué va el proyecto abierto.
import { h } from './dom.js';
import { abrirModo } from './backlog.js';
import { abrirPestana as pestanaCliente } from './cliente.js';
import { abrirPestana as pestanaTaller } from './taller.js';
import { alcanceDe } from '../nucleo/comercial.js';

const n = (cantidad, singular, plural) => `${cantidad} ${cantidad === 1 ? singular : plural}`;

/** Etapas del flujo. `estado(p)` dice en qué va el proyecto: hecho, en curso o pendiente. */
export const ETAPAS = [
  {
    nombre: 'Levantar', sub: 'con el cliente',
    texto: 'Dibujas el circuito del cliente por actores (BPMN liviano) y pegas lo que te pidió. Lo conviertes en historias con su valor (Como… quiero… para…), criterios de aceptación y reglas de negocio, enlazadas a cada paso.',
    destinos: [['Proceso', 'proceso'], ['Notas', 'notas'], ['Backlog', 'backlog', 'lista']],
    estado: (p) => (p.historias.length ? ['hecho', n(p.historias.length, 'historia', 'historias')] : p.notas.trim() ? ['curso', 'Notas sin convertir'] : ['pendiente', 'Sin historias']),
  },
  {
    nombre: 'Acordar', sub: 'alcance y precio',
    texto: 'Defines qué incluye y qué no, cotizas en UF o pesos y propones hitos de pago. Descargas la propuesta para el cliente.',
    destinos: [['Alcance', 'cliente', 'alcance'], ['Cotización', 'cliente', 'cotizacion'], ['Hitos', 'cliente', 'hitos']],
    estado: (p) => {
      const a = alcanceDe(p);
      if ((p.hitos || []).length) return ['hecho', n(p.hitos.length, 'hito de pago', 'hitos de pago')];
      return a.incluye.length || a.noIncluye.length ? ['curso', 'Alcance en borrador'] : ['pendiente', 'Sin acuerdo'];
    },
  },
  {
    nombre: 'Ordenar', sub: 'qué va primero',
    texto: 'Estimas en puntos, priorizas con MoSCoW, WSJF o RICE y miras el roadmap y el pronóstico de cuándo estará cada cosa.',
    destinos: [['Priorizar', 'backlog', 'priorizar'], ['Estimar', 'backlog', 'estimar'], ['Roadmap', 'backlog', 'roadmap']],
    estado: (p) => {
      const pendientes = p.historias.filter((x) => x.estado === 'backlog');
      if (!pendientes.length) return ['pendiente', 'Nada que ordenar'];
      const estimadas = pendientes.filter((x) => x.puntos).length;
      return [estimadas === pendientes.length ? 'hecho' : 'curso', `${estimadas} de ${pendientes.length} estimadas`];
    },
  },
  {
    nombre: 'Construir', sub: 'en sprints',
    texto: 'Planificas un sprint según la capacidad, mueves las tarjetas en el tablero, marcas bloqueos y sigues el burndown.',
    destinos: [['Sprint', 'sprint']],
    estado: (p) => {
      if (p.flujo?.modo === 'kanban') {
        const enCurso = p.historias.filter((h) => !h.sprintId && (h.estado === 'doing' || h.estado === 'review')).length;
        return [enCurso ? 'curso' : 'pendiente', `Flujo continuo · ${enCurso} en curso`];
      }
      const activo = p.sprints.find((s) => s.estado === 'activo');
      const cerrados = p.sprints.filter((s) => s.estado === 'cerrado').length;
      if (activo) return ['curso', `${activo.nombre} en curso`];
      return cerrados ? ['hecho', n(cerrados, 'sprint cerrado', 'sprints cerrados')] : ['pendiente', 'Sin sprints'];
    },
  },
  {
    nombre: 'Entregar', sub: 'y cobrar',
    texto: 'El cliente acepta cada hito con su acta; envías el informe de avance y las notas de versión. Exportas a Jira, CSV o Markdown.',
    destinos: [['Hitos y actas', 'cliente', 'hitos'], ['Exportar', 'ajustes']],
    estado: (p) => {
      const hitos = p.hitos || [];
      const aceptados = hitos.filter((x) => x.estado === 'aceptado').length;
      if (!hitos.length) return ['pendiente', 'Sin hitos'];
      return [aceptados === hitos.length ? 'hecho' : aceptados ? 'curso' : 'pendiente', `${aceptados} de ${hitos.length} hitos aceptados`];
    },
  },
  {
    nombre: 'Aprender', sub: 'y mejorar',
    texto: 'Mides si el sistema se usa y mejoró el proceso (KPIs de adopción), revisas si las hipótesis se cumplieron, haces la retrospectiva y practicas con el taller.',
    destinos: [['Resultados', 'resultados'], ['Retro', 'retro'], ['Taller', 'taller', 'trivia']],
    estado: (p) => ((p.retros || []).length ? ['hecho', n(p.retros.length, 'retrospectiva', 'retrospectivas')] : ['pendiente', 'Sin retrospectivas']),
  },
];

const NOMBRE_ESTADO = { hecho: 'Hecho', curso: 'En curso', pendiente: 'Pendiente' };

export function ir(app, vista, sub) {
  if (vista === 'backlog' && sub) abrirModo(sub);
  if (vista === 'cliente' && sub) pestanaCliente(sub);
  if (vista === 'taller' && sub) pestanaTaller(sub);
  app.ir(vista);
}

export function vistaGuia(app) {
  const p = app.proyecto;
  return h('div', { class: 'vista guia' },
    h('header', { class: 'vista-cabecera' },
      h('p', { class: 'eyebrow' }, 'Mapa del flujo de trabajo'),
      h('h1', {}, 'Cómo funciona'),
      h('p', { class: 'bajada' }, `Un proyecto avanza en seis etapas, de las notas del cliente a la entrega aceptada. Cada etapa te lleva a la sección donde se hace; el estado es el de «${p.nombre}».`)),

    h('ol', { class: 'guia-flujo' }, ETAPAS.map((e, i) => {
      const [estado, detalle] = e.estado(p);
      return h('li', { class: `guia-etapa guia-etapa--${estado}` },
        h('div', { class: 'guia-cabeza' },
          h('span', { class: 'guia-numero', 'aria-hidden': 'true' }, String(i + 1)),
          h('h2', {}, e.nombre, ' ', h('span', { class: 'guia-sub' }, e.sub))),
        h('p', { class: `guia-estado guia-estado--${estado}` }, h('span', { class: 'sr-only' }, 'Estado: '), `${NOMBRE_ESTADO[estado]} · ${detalle}`),
        h('p', { class: 'guia-texto' }, e.texto),
        h('p', { class: 'guia-destinos' }, h('span', { class: 'sr-only' }, 'Ir a: '),
          e.destinos.map(([texto, vista, sub]) => h('button', { type: 'button', class: 'btn btn--secundario btn--chico', onclick: () => ir(app, vista, sub) }, texto))));
    })),

    h('aside', { class: 'guia-ciclo', 'aria-label': 'El ciclo se repite' },
      h('span', { class: 'guia-ciclo-flecha', 'aria-hidden': 'true' }, '↺'),
      h('p', {}, h('strong', {}, 'El ciclo se repite. '), 'Los cambios que pide el cliente (Cliente › Cambios), el feedback de la Sprint Review y las acciones de la retrospectiva vuelven al backlog como historias nuevas, y se ordenan otra vez.')),

    h('section', { class: 'panel', 'aria-labelledby': 'guia-siempre' },
      h('h2', { id: 'guia-siempre' }, 'Siempre a mano'),
      h('ul', { class: 'lista-check' },
        h('li', {}, h('strong', {}, 'Buscar (Ctrl + K): '), 'salta a cualquier historia, sección o acción.'),
        h('li', {}, h('strong', {}, 'Botón «?»: '), 'junto a cada término ágil, su definición con un ejemplo.'),
        h('li', {}, h('strong', {}, 'Respaldo: '), 'tus datos viven en este navegador; descarga un respaldo desde Ajustes.'))));
}
