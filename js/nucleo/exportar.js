// Exportaciones: Markdown para compartir, CSV genérico y CSV listo para importar en Jira.
import { enunciado, PRIORIDADES } from './historias.js';
import { ESTADOS } from './proyecto.js';

/** Escapa una celda CSV y neutraliza fórmulas (=, +, -, @) para evitar inyección en planillas. */
export function celdaCsv(valor) {
  let t = valor === null || valor === undefined ? '' : String(valor);
  if (/^[=+\-@\t\r]/.test(t)) t = "'" + t;
  return /[",\n\r;]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

const fila = (celdas) => celdas.map(celdaCsv).join(',');

export function aCsv(proyecto) {
  const sprints = Object.fromEntries(proyecto.sprints.map((s) => [s.id, s.nombre]));
  const lineas = [fila(['Título', 'Historia', 'Criterios de aceptación', 'Épica', 'Puntos', 'Prioridad', 'Estado', 'Sprint'])];
  for (const h of proyecto.historias) {
    lineas.push(fila([
      h.titulo, enunciado(h), h.criterios.join('\n'), h.epica, h.puntos ?? '',
      PRIORIDADES[h.prioridad] || h.prioridad, ESTADOS[h.estado] || h.estado, sprints[h.sprintId] || '',
    ]));
  }
  return '\uFEFF' + lineas.join('\r\n'); // BOM para que Excel lea bien los acentos
}

/** CSV con las columnas que el importador de Jira reconoce sin configurar nada. */
export function aJiraCsv(proyecto) {
  const prioridadJira = { must: 'Highest', should: 'High', could: 'Medium', wont: 'Low' };
  const lineas = [fila(['Summary', 'Description', 'Issue Type', 'Story Points', 'Priority', 'Labels'])];
  for (const h of proyecto.historias) {
    const descripcion = `${enunciado(h)}\n\nCriterios de aceptación:\n${h.criterios.map((c) => `* ${c}`).join('\n')}`;
    const etiqueta = h.epica ? h.epica.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w]+/g, '-').toLowerCase() : '';
    lineas.push(fila([h.titulo, descripcion, 'Story', h.puntos ?? '', prioridadJira[h.prioridad] || 'Medium', etiqueta]));
  }
  return lineas.join('\r\n');
}

export function aMarkdown(proyecto) {
  const partes = [`# ${proyecto.nombre}`, ''];
  const porEpica = new Map();
  for (const h of proyecto.historias) {
    const clave = h.epica || 'Sin épica';
    if (!porEpica.has(clave)) porEpica.set(clave, []);
    porEpica.get(clave).push(h);
  }
  for (const [epica, hs] of porEpica) {
    partes.push(`## ${epica}`, '');
    for (const h of hs) {
      const meta = [h.puntos ? `${h.puntos} pts` : 'sin estimar', PRIORIDADES[h.prioridad], ESTADOS[h.estado]].join(' · ');
      partes.push(`### ${h.titulo}`, '', `> ${enunciado(h)}`, '', `_${meta}_`, '');
      if (h.criterios.length) {
        partes.push('**Criterios de aceptación**', '', ...h.criterios.map((c) => `- [ ] ${c}`), '');
      }
    }
  }
  return partes.join('\n');
}

/** Nombre de archivo seguro a partir del nombre del proyecto. */
export function nombreArchivo(proyecto, extension) {
  const base = proyecto.nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'proyecto';
  return `${base}-${new Date().toISOString().slice(0, 10)}.${extension}`;
}
