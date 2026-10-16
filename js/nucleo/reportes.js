// Reportes en Markdown: se leen en GitHub, se pegan en Notion, Confluence o un correo,
// y los agentes de IA (Claude Code, Antigravity, Cursor) los entienden bien.
import { enunciado, revisarInvest, PRIORIDADES } from './historias.js';
import { ESTADOS, resumenSprint, burndown, puntosDe, resumenEpicas, velocidad } from './proyecto.js';
import { definicionesDe, avance } from './definiciones.js';
import { COLUMNAS_RETRO, notasDe } from './retro.js';
import { infoEpica, hipotesis, resultadosDeEpica, cobertura } from './okr.js';

const fecha = (iso) => String(iso || '').slice(0, 10).split('-').reverse().join('-');
const lista = (items, vacio = '_Nada._') => (items.length ? items : [vacio]);
const pts = (n) => `${n} ${n === 1 ? 'punto' : 'puntos'}`;

/** Reporte de cierre o avance de un sprint, para el equipo y stakeholders. */
export function reporteSprint(proyecto, sprintId, hoy = new Date()) {
  const s = proyecto.sprints.find((x) => x.id === sprintId);
  if (!s) throw new Error('No existe ese sprint.');
  const hs = proyecto.historias.filter((h) => h.sprintId === s.id);
  const hechas = hs.filter((h) => h.estado === 'done');
  const pendientes = hs.filter((h) => h.estado !== 'done');
  const r = resumenSprint(s, proyecto.historias);
  const retro = (proyecto.retros || []).find((x) => x.sprintId === s.id);
  const estado = { planificado: 'Planificado', activo: 'En curso', cerrado: 'Cerrado' }[s.estado];

  return [
    `# ${proyecto.nombre} · ${s.nombre}`,
    '',
    `**${estado}** · del ${fecha(s.inicio)} al ${fecha(s.fin)}`,
    '',
    s.objetivo ? `> **Objetivo:** ${s.objetivo}` : '> _Sin objetivo definido._',
    '',
    '## Resumen',
    '',
    '| | |',
    '|---|---|',
    `| Terminado | ${r.hechos} de ${r.puntos} puntos (${r.puntos ? Math.round((r.hechos / r.puntos) * 100) : 0}%) |`,
    `| Historias | ${hechas.length} de ${hs.length} terminadas |`,
    `| Capacidad | ${s.capacidad ? pts(s.capacidad) : 'no definida'} |`,
    `| Velocidad promedio | ${pts(velocidad(proyecto))} (últimos 3 sprints cerrados) |`,
    '',
    '## Terminado',
    '',
    ...lista(hechas.map((h) => `- [x] **${h.titulo}** (${h.puntos ?? '?'} pts)${h.epica ? ` · ${h.epica}` : ''}`)),
    '',
    '## No terminado',
    '',
    ...lista(pendientes.map((h) => `- [ ] **${h.titulo}** (${h.puntos ?? '?'} pts) · ${ESTADOS[h.estado]}`), '_Todo se terminó._'),
    '',
    '## Burndown',
    '',
    '| Día | Pendiente | Ideal |',
    '|---|---:|---:|',
    ...burndown(s, proyecto.historias, hoy).map((d) => `| ${fecha(d.dia)} | ${d.pendiente ?? '—'} | ${d.ideal} |`),
    '',
    ...(retro ? [
      '## Acciones de la retrospectiva',
      '',
      ...lista(retro.acciones.map((a) => `- [${a.hecha ? 'x' : ' '}] ${a.texto}${a.responsable ? ` · ${a.responsable}` : ''}`)),
      '',
    ] : []),
    `_Generado con Copiloto PO el ${fecha(new Date(hoy).toISOString())}._`,
  ].join('\n');
}

/** Avance por épica, para stakeholders. */
export function reporteEpicas(proyecto, hoy = new Date()) {
  const epicas = resumenEpicas(proyecto);
  const barra = (p) => '█'.repeat(Math.round(p / 10)) + '░'.repeat(10 - Math.round(p / 10));
  const objetivos = proyecto.objetivos || [];
  const { epicasPorResultado } = cobertura(proyecto);
  const seccionOkr = objetivos.length ? [
    '## Objetivos y resultados clave',
    '',
    ...objetivos.flatMap((o) => [
      `**${o.objetivo}**`,
      '',
      ...lista(o.resultados.map((r) => `- ${r.texto} · ${epicasPorResultado[r.id] ? `épicas: ${epicasPorResultado[r.id].join(', ')}` : '**sin épicas trabajando en esto**'}`), '_Sin resultados clave._'),
      '',
    ]),
  ] : [];
  return [
    `# ${proyecto.nombre} · Avance por épica`,
    '',
    ...seccionOkr,
    '## Avance',
    '',
    '| Épica | Avance | Historias | Puntos | Sin estimar |',
    '|---|---|---:|---:|---:|',
    ...epicas.map((e) => `| ${e.epica || 'Sin épica'} | ${barra(e.avance)} ${e.avance}% | ${e.hechas}/${e.historias} | ${e.puntosHechos}/${e.puntos} | ${e.sinEstimar} |`),
    '',
    ...epicas.flatMap((e) => {
      const pendientes = proyecto.historias.filter((h) => (h.epica || '') === e.epica && h.estado !== 'done');
      if (!pendientes.length) return [];
      return [`## ${e.epica || 'Sin épica'}: lo que falta`, '', ...pendientes.map((h) => `- ${h.titulo} · ${PRIORIDADES[h.prioridad]}${h.puntos ? ` · ${h.puntos} pts` : ' · sin estimar'}`), ''];
    }),
    `_Generado con Copiloto PO el ${fecha(new Date(hoy).toISOString())}._`,
  ].join('\n');
}

/** Retrospectiva: notas ordenadas por votos y acciones. */
export function reporteRetro(proyecto, retroId) {
  const r = (proyecto.retros || []).find((x) => x.id === retroId);
  if (!r) throw new Error('No existe esa retrospectiva.');
  return [
    `# ${proyecto.nombre} · ${r.titulo}`,
    '',
    `_${fecha(r.fecha)}_`,
    '',
    ...Object.entries(COLUMNAS_RETRO).flatMap(([clave, nombre]) => [
      `## ${nombre}`,
      '',
      ...lista(notasDe(r, clave).map((n) => `- ${n.texto}${n.votos ? ` **(${n.votos} ${n.votos === 1 ? 'voto' : 'votos'})**` : ''}`)),
      '',
    ]),
    '## Acciones acordadas',
    '',
    ...lista(r.acciones.map((a) => `- [${a.hecha ? 'x' : ' '}] ${a.texto}${a.responsable ? ` · **${a.responsable}**` : ''}`)),
  ].join('\n');
}

/**
 * Notas de versión para usuarios: lo terminado, dicho desde quien lo usa.
 * @param {{sprintId?: string}} opciones  sin sprint, todo lo terminado
 */
export function notasDeVersion(proyecto, { sprintId = null, titulo = null } = {}) {
  const hechas = proyecto.historias.filter((h) => h.estado === 'done' && (!sprintId || h.sprintId === sprintId));
  const sprint = proyecto.sprints.find((s) => s.id === sprintId);
  const porEpica = new Map();
  for (const h of hechas) {
    const clave = h.epica || 'Mejoras generales';
    if (!porEpica.has(clave)) porEpica.set(clave, []);
    porEpica.get(clave).push(h);
  }
  return [
    `# ${titulo || `Novedades de ${proyecto.nombre}${sprint ? ` · ${sprint.nombre}` : ''}`}`,
    '',
    hechas.length ? `Esta versión trae ${hechas.length} ${hechas.length === 1 ? 'novedad' : 'novedades'}.` : '_Aún no hay historias terminadas._',
    '',
    ...[...porEpica].flatMap(([epica, hs]) => [
      `## ${epica}`,
      '',
      ...hs.map((h) => `- **${h.titulo}.** Ahora, como ${h.rol}, puedes ${h.quiero}${h.para ? `, para ${h.para}` : ''}.`),
      '',
    ]),
  ].join('\n').trimEnd() + '\n';
}

const INSTRUCCIONES_AGENTE = [
  'Implementa **solo** lo que pide esta especificación. Lo listado en "Fuera de alcance" no se toca.',
  'Si un criterio es ambiguo o contradice el código existente, **pregunta antes de suponer**.',
  'Escribe una prueba automática por cada criterio de aceptación, incluidos los casos de error.',
  'Sigue las convenciones del proyecto (nombres, estructura y estilo) en vez de introducir otras.',
  'Al terminar, resume qué cambiaste y cómo verificar cada criterio.',
];

/** Especificación de una historia lista para entregar a un agente de IA o a un desarrollador. */
export function especificacionHistoria(proyecto, historiaId) {
  const h = proyecto.historias.find((x) => x.id === historiaId);
  if (!h) throw new Error('No existe esa historia.');
  const { done } = definicionesDe(proyecto);
  const hermanas = proyecto.historias.filter((x) => x.id !== h.id && x.epica && x.epica === h.epica && x.estado !== 'done');
  const avisos = revisarInvest(h);

  return [
    `# Especificación: ${h.titulo}`,
    '',
    '## Contexto',
    '',
    `- **Proyecto:** ${proyecto.nombre}`,
    h.epica ? `- **Épica:** ${h.epica}` : null,
    ...(h.epica ? contextoNegocio(proyecto, h.epica).map((l) => `- ${l}`) : []),
    `- **Prioridad:** ${PRIORIDADES[h.prioridad]}${h.puntos ? ` · ${h.puntos} puntos` : ''}`,
    '',
    '## Historia de usuario',
    '',
    `> ${enunciado(h)}`,
    '',
    '## Criterios de aceptación',
    '',
    ...lista(h.criterios.map((c) => `- [ ] ${c}`), '- [ ] _Sin criterios: definirlos antes de implementar._'),
    '',
    '## Definition of Done',
    '',
    ...done.map((d) => `- [ ] ${d}`),
    '',
    ...(hermanas.length ? [
      '## Fuera de alcance',
      '',
      'Estas historias de la misma épica se harán aparte; no las implementes aquí:',
      '',
      ...hermanas.map((x) => `- ${x.titulo}`),
      '',
    ] : []),
    ...(avisos.length ? [
      '## Puntos abiertos',
      '',
      'La revisión INVEST marcó lo siguiente; aclarar antes de cerrar la historia:',
      '',
      ...avisos.map((a) => `- ${a.texto}`),
      '',
    ] : []),
    '## Instrucciones para quien implementa',
    '',
    ...INSTRUCCIONES_AGENTE.map((i) => `- ${i}`),
  ].filter((l) => l !== null).join('\n');
}

/** Especificación de una épica completa: todas sus historias pendientes en orden de prioridad. */
export function especificacionEpica(proyecto, epica) {
  const hs = proyecto.historias.filter((x) => (x.epica || '') === epica && x.estado !== 'done');
  if (!hs.length) throw new Error('La épica no tiene historias pendientes.');
  const { done } = definicionesDe(proyecto);
  return [
    `# Especificación de la épica: ${epica || 'Sin épica'}`,
    '',
    `Proyecto **${proyecto.nombre}**. ${hs.length} ${hs.length === 1 ? 'historia' : 'historias'}, en orden de prioridad (${pts(puntosDe(hs))} estimados).`,
    ...contextoNegocio(proyecto, epica),
    'Implementa una historia a la vez, en este orden, y confirma cada una antes de pasar a la siguiente.',
    '',
    ...hs.flatMap((h, i) => [
      `## ${i + 1}. ${h.titulo}`,
      '',
      `> ${enunciado(h)}`,
      '',
      `_${PRIORIDADES[h.prioridad]}${h.puntos ? ` · ${h.puntos} pts` : ' · sin estimar'}${avance(h, definicionesDe(proyecto).ready, 'ready').completa ? '' : ' · **no cumple la Definition of Ready**'}_`,
      '',
      '**Criterios de aceptación**',
      '',
      ...lista(h.criterios.map((c) => `- [ ] ${c}`), '- [ ] _Sin criterios: definirlos antes de implementar._'),
      '',
    ]),
    '## Definition of Done (para cada historia)',
    '',
    ...done.map((d) => `- [ ] ${d}`),
    '',
    '## Instrucciones para quien implementa',
    '',
    ...INSTRUCCIONES_AGENTE.map((i) => `- ${i}`),
  ].join('\n');
}

/** Hipótesis y resultados clave de una épica, como líneas de Markdown (vacío si no hay). */
function contextoNegocio(proyecto, epica) {
  const h = hipotesis(infoEpica(proyecto, epica));
  const krs = resultadosDeEpica(proyecto, epica);
  return [
    h ? `**Hipótesis:** ${h}` : null,
    krs.length ? `**Aporta a:** ${krs.map((r) => `${r.texto} (${r.objetivo})`).join('; ')}` : null,
  ].filter(Boolean);
}
