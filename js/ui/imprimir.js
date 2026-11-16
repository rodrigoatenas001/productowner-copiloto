// PDF con formato: el mismo contenido del documento de Word, impreso por el navegador
// («Guardar como PDF»). Sin librerías: el texto queda seleccionable y se puede buscar.
import { h } from './dom.js';

function bloque(b) {
  switch (b.t) {
    case 'titulo': return h('h1', { class: 'doc-titulo' }, b.texto);
    case 'subtitulo': return h('p', { class: 'doc-subtitulo' }, b.texto);
    case 'h1': return h('h2', { class: 'doc-h1' }, b.texto);
    case 'h2': return h('h3', { class: 'doc-h2' }, b.texto);
    case 'h3': return h('h4', { class: 'doc-h3' }, b.texto);
    case 'cita': return h('blockquote', { class: 'doc-cita' }, b.texto);
    case 'p': return h('p', { class: [b.nota ? 'doc-nota' : '', b.fuerte ? 'doc-fuerte' : ''].join(' ').trim() || null }, b.texto);
    case 'lista': return h('ul', { class: 'doc-lista' }, b.items.map((x) => h('li', {}, x)));
    case 'check': return h('ul', { class: 'doc-check' }, b.items.map((x) => h('li', {}, x)));
    case 'datos': return h('table', { class: 'doc-tabla doc-datos' }, h('tbody', {}, b.pares.map(([k, v]) => h('tr', {}, h('th', { scope: 'row' }, k), h('td', {}, v)))));
    case 'tabla': return h('table', { class: 'doc-tabla' },
      // Ancho por CSSOM: la política de seguridad no admite atributos style en el HTML
      h('colgroup', {}, (b.anchos || []).map((a) => { const col = h('col'); col.style.width = `${a}%`; return col; })),
      h('thead', {}, h('tr', {}, b.columnas.map((c) => h('th', { scope: 'col' }, c)))),
      h('tbody', {}, b.filas.map((f) => h('tr', {}, f.map((v) => h('td', {}, v))))));
    case 'salto': return h('div', { class: 'doc-salto' });
    default: return null;
  }
}

/**
 * Abre el diálogo de impresión con el documento. El nombre del archivo PDF sale del título de la página,
 * así que se cambia mientras dura la impresión.
 */
export function imprimirDocumento(bloques, titulo) {
  document.getElementById('documento-impresion')?.remove();
  const doc = h('article', { id: 'documento-impresion', class: 'documento', 'aria-hidden': 'true' }, bloques.map(bloque));
  document.body.append(doc);
  document.documentElement.classList.add('imprimiendo');
  const tituloAntes = document.title;
  document.title = titulo;
  const limpiar = () => {
    document.documentElement.classList.remove('imprimiendo');
    document.title = tituloAntes;
    doc.remove();
  };
  window.addEventListener('afterprint', limpiar, { once: true });
  window.print();
}
