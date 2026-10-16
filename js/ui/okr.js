// Objetivos (OKR) del proyecto e hipótesis de valor por épica.
import { h, selector } from './dom.js';
import {
  agregarObjetivo, agregarResultado, quitarObjetivo, quitarResultado, editarEpica, infoEpica, hipotesis, cobertura, RESULTADOS_HIPOTESIS,
} from '../nucleo/okr.js';

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
          h('span', {}, r.texto),
          epicasPorResultado[r.id] ? h('span', { class: 'tarjeta-meta' }, ` · ${epicasPorResultado[r.id].join(', ')}`) : h('span', { class: 'chip chip--aviso' }, 'sin épicas'),
          h('button', { type: 'button', class: 'icono', 'aria-label': `Quitar resultado: ${r.texto}`, onclick: () => app.cambiarConDeshacer('Resultado clave quitado.', (x) => quitarResultado(x, r.id)) }, '×')))),
        h('div', { class: 'fila-accion fila-accion--dos' }, kr, h('button', { type: 'button', class: 'btn btn--secundario', onclick: agregarKr }, 'Agregar resultado')));
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
