// Editor y tarjeta de una historia, compartidos por Notas (candidatas) y Backlog.
import { h, campo, selector } from './dom.js';
import { revisarInvest, calidad, enunciado, resumirTitulo, ESCALA_PUNTOS, PRIORIDADES } from '../nucleo/historias.js';

/** Insignia de calidad INVEST: color y texto según los avisos. */
export function insigniaCalidad(historia) {
  const nota = calidad(historia);
  const nivel = nota >= 90 ? 'buena' : nota >= 60 ? 'media' : 'baja';
  const texto = { buena: 'Lista', media: 'Revisar', baja: 'Mejorar' }[nivel];
  return h('span', { class: `calidad calidad--${nivel}`, title: `Calidad INVEST: ${nota}/100` }, texto);
}

export function listaAvisos(historia) {
  const avisos = revisarInvest(historia);
  if (!avisos.length) return h('p', { class: 'invest-ok' }, '✓ Cumple las reglas INVEST que revisamos.');
  return h('ul', { class: 'invest', 'aria-label': 'Sugerencias INVEST' },
    avisos.map((a) => h('li', { class: `invest--${a.nivel}` }, a.texto)));
}

/**
 * Formulario de edición. `alCambiar(campos)` recibe los campos modificados.
 * Se actualiza sin redibujar todo para no perder el foco mientras se escribe.
 */
export function editorHistoria(historia, alCambiar, { epicas = [] } = {}) {
  const avisos = h('div', { class: 'editor-avisos', 'aria-live': 'polite' }, listaAvisos(historia));
  const vistaPrevia = h('p', { class: 'enunciado' }, enunciado(historia));
  const actual = { ...historia };

  const actualizar = (cambios) => {
    Object.assign(actual, cambios);
    if ('quiero' in cambios && (!historia.tituloManual)) {
      actual.titulo = resumirTitulo(actual.quiero).replace(/^./, (c) => c.toUpperCase());
      cambios.titulo = actual.titulo;
    }
    avisos.replaceChildren(listaAvisos(actual));
    vistaPrevia.textContent = enunciado(actual);
    alCambiar(cambios);
  };

  const texto = (clave, atributos = {}) => h('input', {
    type: 'text', value: historia[clave] || '', ...atributos,
    oninput: (e) => actualizar({ [clave]: e.target.value }),
  });

  const idLista = `epicas-${historia.id}`;
  return h('div', { class: 'editor' },
    vistaPrevia,
    h('div', { class: 'editor-grilla' },
      campo('Como', texto('rol', { placeholder: 'rol concreto: contadora, vendedor…' })),
      campo('Quiero', texto('quiero', { placeholder: 'lo que necesita poder hacer' })),
      campo('Para', texto('para', { placeholder: 'el beneficio que obtiene' })),
    ),
    campo('Criterios de aceptación', h('textarea', {
      rows: 3,
      oninput: (e) => actualizar({ criterios: e.target.value.split('\n').map((c) => c.trim()).filter(Boolean) }),
    }, (historia.criterios || []).join('\n')), 'Uno por línea. Formato sugerido: Dado… cuando… entonces…'),
    h('div', { class: 'editor-fila' },
      campo('Épica', h('input', { type: 'text', value: historia.epica || '', list: idLista, oninput: (e) => actualizar({ epica: e.target.value.trim() }) })),
      h('datalist', { id: idLista }, epicas.map((e) => h('option', { value: e }))),
      campo('Puntos', selector({ '': 'Sin estimar', ...Object.fromEntries(ESCALA_PUNTOS.map((p) => [p, String(p)])) }, historia.puntos ?? '', {
        onchange: (e) => actualizar({ puntos: e.target.value ? Number(e.target.value) : null }),
      })),
      campo('Prioridad', selector(PRIORIDADES, historia.prioridad, { onchange: (e) => actualizar({ prioridad: e.target.value }) })),
    ),
    avisos,
    historia.notaOriginal && historia.notaOriginal !== enunciado(historia)
      ? h('p', { class: 'nota-original' }, h('span', {}, 'Nota original: '), historia.notaOriginal)
      : null,
  );
}
