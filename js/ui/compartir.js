// Botones para compartir un reporte en Markdown: copiar al portapapeles o descargar el archivo.
import { h, descargar } from './dom.js';
import { nombreArchivo } from '../nucleo/exportar.js';

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
    }, 'Descargar .md'));
}
