// Botones para compartir un documento: copiarlo en Markdown, descargarlo en Markdown o Word, o guardarlo en PDF.
import { h, descargar } from './dom.js';
import { nombreArchivo } from '../nucleo/exportar.js';
import { markdownABloques } from '../nucleo/markdownBloques.js';
import { documentoWord } from '../nucleo/docx.js';
import { imprimirDocumento } from './imprimir.js';

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * @param {object} app
 * @param {string} etiqueta  qué se comparte ("Reporte del sprint")
 * @param {string} sufijo    para el nombre del archivo ("sprint-1")
 * @param {() => string} generar  arma el Markdown en el momento del clic
 */
export function botonesMarkdown(app, etiqueta, sufijo, generar) {
  const obtener = () => {
    try {
      return generar();
    } catch (e) {
      app.avisar(e.message, 'error');
      return null;
    }
  };
  return h('span', { class: 'compartir-md', role: 'group', 'aria-label': etiqueta },
    h('span', { class: 'compartir-etiqueta' }, etiqueta),
    h('button', {
      type: 'button', class: 'btn-texto',
      onclick: async () => {
        const md = obtener();
        if (md === null) return;
        try {
          await navigator.clipboard.writeText(md);
          app.avisar(`${etiqueta}: copiado en Markdown.`);
        } catch {
          app.avisar('El navegador no permitió copiar. Usa "Descargar".', 'error');
        }
      },
    }, 'Copiar'),
    h('button', {
      type: 'button', class: 'btn-texto',
      onclick: () => {
        const md = obtener();
        if (md !== null) descargar(nombreArchivo(app.proyecto, `${sufijo}.md`), md, 'text/markdown');
      },
    }, 'Descargar .md'),
    // Para el cliente: Word para editarlo, PDF para enviarlo o firmarlo
    h('button', {
      type: 'button', class: 'btn-texto',
      onclick: () => {
        const md = obtener();
        if (md === null) return;
        const bloques = markdownABloques(md);
        const titulo = bloques.find((b) => b.t === 'titulo')?.texto || etiqueta;
        descargar(nombreArchivo(app.proyecto, `${sufijo}.docx`), documentoWord(bloques, { titulo, pie: app.proyecto.nombre }), DOCX);
      },
    }, 'Word'),
    h('button', {
      type: 'button', class: 'btn-texto',
      onclick: () => {
        const md = obtener();
        if (md !== null) imprimirDocumento(markdownABloques(md), nombreArchivo(app.proyecto, sufijo).replace(/\.$/, ''));
      },
    }, 'PDF'));
}
