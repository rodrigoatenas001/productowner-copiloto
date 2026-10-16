// Roadmap: visión, Objetivo del Producto y épicas en Ahora / Siguiente / Después.
import { h, selector } from './dom.js';
import { HORIZONTES, roadmap, visionDe } from '../nucleo/roadmap.js';
import { editarEpica, RESULTADOS_HIPOTESIS } from '../nucleo/okr.js';
import { botonesMarkdown } from './compartir.js';
import { reporteRoadmap, informeCliente } from '../nucleo/reportes.js';

export function vistaRoadmap(app) {
  const v = visionDe(app.proyecto);
  const r = roadmap(app.proyecto);
  const guardarVision = (cambios) => app.cambiar((x) => ({ ...x, vision: { ...visionDe(x), ...cambios } }), { redibujar: false });

  const tarjeta = (e) => h('li', { class: 'roadmap-epica' },
    h('div', { class: 'epica-cabecera' }, h('strong', {}, e.epica), h('span', { class: 'epica-avance' }, `${e.avance}%`)),
    h('div', { class: 'capacidad-barra', 'aria-hidden': 'true' }, h('span', { class: `relleno-${Math.round(e.avance / 5) * 5}` })),
    e.pronostico ? h('p', { class: 'tarjeta-meta' }, `Pronóstico: ${e.pronostico}`) : null,
    e.resultados.length ? h('p', { class: 'tarjeta-meta' }, `Aporta a: ${e.resultados.map((x) => x.texto).join('; ')}`) : null,
    e.hipotesis ? h('p', { class: 'tarjeta-meta' }, `Hipótesis: ${RESULTADOS_HIPOTESIS[e.resultadoHipotesis].toLowerCase()}`) : null,
    selector({ '': `Automático (${HORIZONTES[e.horizonte].nombre.toLowerCase()})`, ...Object.fromEntries(Object.entries(HORIZONTES).map(([k, x]) => [k, x.nombre])) },
      e.automatico ? '' : e.horizonte, {
        'aria-label': `Horizonte de ${e.epica}`, class: 'roadmap-mover',
        onchange: (ev) => app.cambiar((x) => editarEpica(x, e.epica, { horizonte: ev.target.value })),
      }));

  return h('div', { class: 'roadmap' },
    h('section', { class: 'panel', 'aria-labelledby': 'vision-titulo' },
      h('h2', { id: 'vision-titulo' }, 'Visión y Objetivo del Producto'),
      h('label', { class: 'hipotesis-campo' }, h('span', {}, 'Visión: para quién es el producto y qué cambia en su vida'),
        h('textarea', { rows: 2, maxlength: 600, placeholder: 'Que las pymes de barrio vendan en línea sin depender de marketplaces.', onchange: (e) => guardarVision({ vision: e.target.value.trim() }) }, v.vision)),
      h('label', { class: 'hipotesis-campo' }, h('span', {}, 'Objetivo del Producto: el próximo gran resultado, medible'),
        h('input', { type: 'text', maxlength: 300, value: v.objetivoProducto, placeholder: 'Que 20 tiendas vendan con su propia web antes de diciembre.', onchange: (e) => guardarVision({ objetivoProducto: e.target.value.trim() }) })),
      h('p', { class: 'ayuda' }, 'Según la Guía Scrum, el Objetivo del Producto es el compromiso del Product Backlog: todo lo que está en él debería acercarte a ese objetivo.')),
    h('div', { class: 'compartir' },
      botonesMarkdown(app, 'Informe para el cliente', 'informe-cliente', () => informeCliente(app.proyecto)),
      botonesMarkdown(app, 'Roadmap', 'roadmap', () => reporteRoadmap(app.proyecto))),
    h('div', { class: 'tablero roadmap-columnas' }, Object.entries(HORIZONTES).map(([clave, x]) => h('section', { class: `columna roadmap-columna--${clave}`, 'aria-labelledby': `rm-${clave}` },
      h('h2', { id: `rm-${clave}` }, x.nombre, h('span', { class: 'nav-conteo' }, String(r[clave].length))),
      h('p', { class: 'ayuda' }, x.ayuda),
      r[clave].length ? h('ul', {}, r[clave].map(tarjeta)) : h('p', { class: 'ayuda' }, 'Sin épicas.')))),
    r.terminadas.length ? h('p', { class: 'ayuda' }, `Terminadas: ${r.terminadas.map((e) => e.epica).join(', ')}.`) : null,
    !Object.values(r).some((g) => g.length) ? h('p', { class: 'vacio' }, 'Agrupa tus historias en épicas para ver el roadmap.') : null);
}
