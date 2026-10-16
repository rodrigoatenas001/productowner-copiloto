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

const etiquetaDe = (texto) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase();

/**
 * CSV para el importador de Jira (Cloud y Data Center).
 * Las épicas van como incidencias "Epic" y cada historia apunta a la suya con "Parent ID"
 * (identificadores internos del archivo, columna "Issue ID"). También lleva etiqueta por épica
 * y el nombre del sprint; al importar, Jira pide confirmar a qué campo va cada columna.
 */
export function aJiraCsv(proyecto) {
  const prioridadJira = { must: 'Highest', should: 'High', could: 'Medium', wont: 'Low' };
  const sprints = Object.fromEntries(proyecto.sprints.map((s) => [s.id, s.nombre]));
  const epicas = [...new Set(proyecto.historias.map((h) => h.epica).filter(Boolean))];
  const idEpica = Object.fromEntries(epicas.map((e, i) => [e, String(i + 1)]));
  const lineas = [fila(['Issue ID', 'Parent ID', 'Summary', 'Description', 'Issue Type', 'Story Points', 'Priority', 'Labels', 'Sprint'])];

  for (const e of epicas) {
    lineas.push(fila([idEpica[e], '', e, `Épica de ${proyecto.nombre}`, 'Epic', '', 'Medium', etiquetaDe(e), '']));
  }
  proyecto.historias.forEach((h, i) => {
    const descripcion = `${enunciado(h)}\n\nCriterios de aceptación:\n${h.criterios.map((c) => `* ${c}`).join('\n')}`;
    lineas.push(fila([
      String(epicas.length + i + 1), h.epica ? idEpica[h.epica] : '', h.titulo, descripcion, 'Story',
      h.puntos ?? '', prioridadJira[h.prioridad] || 'Medium', h.epica ? etiquetaDe(h.epica) : '', sprints[h.sprintId] || '',
    ]));
  });
  return lineas.join('\r\n');
}

/** Consultas JQL útiles para un Product Owner. */
export const GUIA_JQL = [
  { para: 'Mis incidencias sin resolver', jql: 'assignee = currentUser() AND resolution = Unresolved ORDER BY priority DESC' },
  { para: 'El sprint en curso', jql: 'sprint in openSprints() ORDER BY Rank ASC' },
  { para: 'El backlog en su orden (sin sprint)', jql: 'sprint is EMPTY AND issuetype = Story AND resolution = Unresolved ORDER BY Rank ASC' },
  { para: 'Historias sin estimar', jql: 'issuetype = Story AND "Story Points" is EMPTY AND resolution = Unresolved' },
  { para: 'Historias de una épica', jql: 'parent = PROJ-123 ORDER BY Rank ASC' },
  { para: 'Bugs abiertos de alta prioridad', jql: 'issuetype = Bug AND priority in (Highest, High) AND resolution = Unresolved' },
  { para: 'Lo que se terminó en la última semana', jql: 'resolved >= -7d ORDER BY resolved DESC' },
  { para: 'Trabajo sin movimiento hace 2 semanas', jql: 'status = "In Progress" AND updated <= -14d' },
  { para: 'Lo que quedó de sprints anteriores', jql: 'sprint in closedSprints() AND sprint in openSprints()' },
  { para: 'Creado por stakeholders este mes', jql: 'reporter in (usuario1, usuario2) AND created >= startOfMonth()' },
];

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
