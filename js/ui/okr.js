// Objetivos (OKR) del proyecto e hipótesis de valor por épica.
import { h, selector, termino } from './dom.js';
import {
  agregarObjetivo, agregarResultado, quitarObjetivo, quitarResultado, editarEpica, infoEpica, hipotesis, cobertura, RESULTADOS_HIPOTESIS,
  editarResultado, agregarMedicion, quitarMedicion, avanceResultado, agregarKpisAdopcion,
} from '../nucleo/okr.js';

const NS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs = {}) => { const el = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v); return el; };
const hoy = () => new Date().toISOString().slice(0, 10);
const cifra = (v, unidad) => (v === null || v === undefined ? '—' : `${v.toLocaleString('es-CL', { maximumFractionDigits: 2 })}${unidad ? ` ${unidad}` : ''}`);

/** Línea de tendencia pequeña: las mediciones y, punteada, la meta. */
function tendencia(r) {
  const meds = r.mediciones || [];
  if (meds.length < 2) return null;
  const valores = [...meds.map((m) => m.valor), ...(r.meta !== null ? [r.meta] : []), ...(r.base !== null ? [r.base] : [])];
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const [ancho, alto] = [120, 32];
  const y = (v) => (max === min ? alto / 2 : alto - 3 - ((v - min) / (max - min)) * (alto - 6));
  const x = (i) => 3 + (i / (meds.length - 1)) * (ancho - 6);
  const lienzo = svg('svg', { viewBox: `0 0 ${ancho} ${alto}`, width: ancho, height: alto, class: 'kr-tendencia', role: 'img', 'aria-label': `Mediciones: ${meds.map((m) => cifra(m.valor, r.unidad)).join(', ')}` });
  if (r.meta !== null) lienzo.append(svg('line', { x1: 0, x2: ancho, y1: y(r.meta), y2: y(r.meta), class: 'kr-meta' }));
  lienzo.append(svg('polyline', { points: meds.map((m, i) => `${x(i)},${y(m.valor)}`).join(' '), class: 'kr-linea' }));
  lienzo.append(svg('circle', { cx: x(meds.length - 1), cy: y(meds[meds.length - 1].valor), r: 3, class: 'kr-punto' }));
  return lienzo;
}

/** Medición del resultado clave: línea base, meta, unidad y mediciones fechadas. */
function medicion(app, r) {
  const a = avanceResultado(r);
  const numeroDe = (v) => (v.trim() === '' ? null : Number(v.replace(',', '.')));
  const entrada = (valor, etiqueta, guardar) => h('input', {
    type: 'text', inputmode: 'decimal', value: valor ?? '', 'aria-label': etiqueta, class: 'kr-numero',
    onchange: (e) => { const n = numeroDe(e.target.value); if (n === null || Number.isFinite(n)) guardar(n); },
  });
  const fechaNueva = h('input', { type: 'date', value: hoy(), 'aria-label': `Fecha de la medición de ${r.texto}` });
  const valorNuevo = h('input', { type: 'text', inputmode: 'decimal', placeholder: 'Valor', 'aria-label': `Valor medido de ${r.texto}`, class: 'kr-numero' });
  const registrar = () => {
    const n = numeroDe(valorNuevo.value);
    if (n === null || !Number.isFinite(n)) { valorNuevo.focus(); return; }
    app.cambiar((x) => agregarMedicion(x, r.id, { fecha: fechaNueva.value, valor: n }));
  };
  return h('details', { class: 'kr-medicion' },
    h('summary', {},
      a.ultimo === null ? h('span', { class: 'ayuda' }, 'Medir') : h('span', { class: 'kr-resumen' },
        h('strong', {}, cifra(a.ultimo, r.unidad)),
        a.avance !== null ? h('span', { class: `chip${a.avance >= 100 ? ' chip--ok' : ''}` }, `${a.avance}% hacia la meta`) : null,
        a.tendencia ? h('span', { class: `kr-flecha kr-flecha--${a.tendencia}`, title: { mejora: 'Mejora', empeora: 'Empeora', igual: 'Sin cambio' }[a.tendencia] }, { mejora: '▲', empeora: '▼', igual: '■' }[a.tendencia]) : null),
      tendencia(r)),
    h('div', { class: 'kr-campos' },
      h('label', {}, 'Unidad ', h('input', { type: 'text', value: r.unidad || '', maxlength: 20, placeholder: '%, h, n°', class: 'kr-numero', onchange: (e) => app.cambiar((x) => editarResultado(x, r.id, { unidad: e.target.value.trim() })) })),
      h('label', {}, 'Línea base ', entrada(r.base, `Línea base de ${r.texto}`, (n) => app.cambiar((x) => editarResultado(x, r.id, { base: n })))),
      h('label', {}, 'Meta ', entrada(r.meta, `Meta de ${r.texto}`, (n) => app.cambiar((x) => editarResultado(x, r.id, { meta: n }))))),
    h('div', { class: 'kr-campos' }, fechaNueva, valorNuevo, h('button', { type: 'button', class: 'btn btn--secundario btn--chico', onclick: registrar }, 'Registrar medición')),
    (r.mediciones || []).length ? h('ul', { class: 'kr-mediciones' }, [...r.mediciones].reverse().map((m) => h('li', {},
      `${new Date(`${m.fecha}T12:00:00`).toLocaleDateString('es-CL')}: ${cifra(m.valor, r.unidad)}`,
      h('button', { type: 'button', class: 'icono', 'aria-label': `Quitar la medición del ${m.fecha}`, onclick: () => app.cambiar((x) => quitarMedicion(x, r.id, m.fecha)) }, '×')))) : null);
}

export function panelObjetivos(app) {
  const p = app.proyecto;
  const objetivos = p.objetivos || [];
  const { resultadosSinEpica, epicasSinResultado, epicasPorResultado } = cobertura(p);
  const nuevo = h('input', { type: 'text', placeholder: 'Objetivo: qué queremos lograr (cualitativo)', maxlength: 200, 'aria-label': 'Nuevo objetivo' });

  return h('details', { class: 'panel okr', open: !objetivos.length ? null : true },
    h('summary', {}, h('span', { class: 'okr-titulo' }, 'Objetivos y resultados clave (OKR)'),
      objetivos.length ? h('span', { class: 'chip' }, `${objetivos.length}`) : h('span', { class: 'ayuda' }, ' opcional')),
    h('p', { class: 'ayuda' }, 'Un objetivo dice qué quieres lograr; sus resultados clave dicen cómo sabrás que lo lograste, con números. Luego vincula cada épica al resultado al que aporta.'),
    h('ul', { class: 'okr-lista' }, objetivos.map((o) => {
      const kr = h('input', { type: 'text', placeholder: 'Resultado clave medible: de X a Y', maxlength: 200, 'aria-label': `Nuevo resultado clave de ${o.objetivo}` });
      const agregarKr = () => { if (kr.value.trim()) app.cambiar((x) => agregarResultado(x, o.id, kr.value)); };
      return h('li', { class: 'okr-objetivo' },
        h('div', { class: 'okr-cabecera' },
          h('strong', {}, o.objetivo),
          h('button', { type: 'button', class: 'icono', 'aria-label': `Quitar objetivo: ${o.objetivo}`, onclick: () => app.cambiarConDeshacer('Objetivo quitado.', (x) => quitarObjetivo(x, o.id)) }, '×')),
        h('ul', {}, o.resultados.map((r) => h('li', { class: 'okr-kr' },
          h('div', { class: 'okr-kr-fila' },
            h('span', {}, r.texto),
            epicasPorResultado[r.id] ? h('span', { class: 'tarjeta-meta' }, ` · ${epicasPorResultado[r.id].join(', ')}`) : h('span', { class: 'chip chip--aviso' }, 'sin épicas'),
            h('button', { type: 'button', class: 'icono', 'aria-label': `Quitar resultado: ${r.texto}`, onclick: () => app.cambiarConDeshacer('Resultado clave quitado.', (x) => quitarResultado(x, r.id)) }, '×')),
          medicion(app, r)))),
        h('div', { class: 'fila-accion fila-accion--dos' }, kr, h('button', { type: 'button', class: 'btn btn--secundario', onclick: agregarKr }, 'Agregar resultado')),
        h('p', { class: 'ayuda' }, h('button', { type: 'button', class: 'btn-texto', onclick: () => app.cambiar((x) => agregarKpisAdopcion(x, o.id)) }, 'Agregar KPIs de adopción'),
          ' (uso real, tiempo de ciclo y errores): entregar a tiempo no basta si nadie lo usa. ', termino('adopcion')));
    })),
    h('div', { class: 'fila-accion fila-accion--dos' }, nuevo,
      h('button', { type: 'button', class: 'btn', onclick: () => { if (nuevo.value.trim()) app.cambiar((x) => agregarObjetivo(x, nuevo.value)); } }, 'Agregar objetivo')),
    resultadosSinEpica.length || epicasSinResultado.length ? h('ul', { class: 'invest' },
      resultadosSinEpica.length ? h('li', { class: 'invest--aviso' }, `${resultadosSinEpica.length} ${resultadosSinEpica.length === 1 ? 'resultado clave no tiene' : 'resultados clave no tienen'} épicas trabajando en ${resultadosSinEpica.length === 1 ? 'él' : 'ellos'}.`) : null,
      epicasSinResultado.length ? h('li', { class: 'invest--sugerencia' }, `Épicas que no aportan a ningún objetivo: ${epicasSinResultado.join(', ')}. ¿Son necesarias ahora?`) : null) : null);
}

/** Hipótesis y resultados clave de una épica, dentro de su tarjeta. */
export function detalleEpica(app, epica) {
  const info = infoEpica(app.proyecto, epica);
  const frase = hipotesis(info);
  const resumen = h('span', { class: 'tarjeta-meta' }, frase ? '' : 'Sin hipótesis');
  const guardar = (cambios) => app.cambiar((x) => editarEpica(x, epica, cambios), { redibujar: false });
  const campoHipotesis = (clave, etiqueta, ejemplo) => h('label', { class: 'hipotesis-campo' }, h('span', {}, etiqueta),
    h('input', { type: 'text', value: info[clave], placeholder: ejemplo, maxlength: 300, onchange: (e) => guardar({ [clave]: e.target.value }) }));
  const resultados = (app.proyecto.objetivos || []).flatMap((o) => o.resultados.map((r) => ({ ...r, objetivo: o.objetivo })));

  return h('details', { class: 'verificacion hipotesis' },
    h('summary', {}, 'Hipótesis y resultados clave ', resumen),
    frase ? h('p', { class: 'hipotesis-frase' }, frase) : null,
    campoHipotesis('creemos', 'Creemos que al…', 'implementar el pago con tarjeta'),
    campoHipotesis('lograremos', 'lograremos…', 'que más visitas terminen comprando'),
    campoHipotesis('veremos', 'lo sabremos cuando…', 'la conversión suba del 2% al 4% en 2 meses'),
    frase ? h('div', { class: 'resultado-hipotesis' },
      h('label', { class: 'hipotesis-campo' }, h('span', {}, '¿Cómo resultó?'),
        selector(RESULTADOS_HIPOTESIS, info.resultadoHipotesis, { onchange: (e) => app.cambiar((x) => editarEpica(x, epica, { resultadoHipotesis: e.target.value }), { redibujar: false }) })),
      h('label', { class: 'hipotesis-campo' }, h('span', {}, 'Dato real medido'),
        h('input', { type: 'text', value: info.datoReal, placeholder: 'La conversión llegó a 3,1% en 8 semanas', maxlength: 300, onchange: (e) => guardar({ datoReal: e.target.value }) })),
      h('p', { class: 'ayuda' }, 'Mide después de entregar. Si no se cumplió, también es aprendizaje: ajusta la próxima épica.')) : null,
    resultados.length ? h('fieldset', { class: 'temas' }, h('legend', {}, 'Aporta a'),
      resultados.map((r) => h('label', { class: 'opcion' },
        h('input', {
          type: 'checkbox', checked: info.resultados.includes(r.id),
          onchange: (e) => {
            const actual = new Set(infoEpica(app.proyecto, epica).resultados);
            if (e.target.checked) actual.add(r.id); else actual.delete(r.id);
            app.cambiar((x) => editarEpica(x, epica, { resultados: [...actual] }));
          },
        }), `${r.texto} `, h('span', { class: 'tarjeta-meta' }, `(${r.objetivo})`))))
      : h('p', { class: 'ayuda' }, 'Agrega objetivos y resultados clave arriba para vincularlos.'));
}
