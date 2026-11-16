// Daily: lo que el equipo necesita para sus 15 minutos. Qué se terminó desde la última Daily,
// qué está en curso (y hace cuánto), qué está bloqueado y si el sprint va a tiempo.
import { burndown, fechaISO } from './proyecto.js';
import { diasBloqueada } from './flujo.js';

const DIA = 86400000;
/** Una historia en curso que lleva más de estos días merece la pregunta «¿sigue avanzando?». */
export const DIAS_ESTANCADA = 3;

/**
 * @returns {{corte: string, objetivo: string, ritmo: 'adelantado'|'a tiempo'|'atrasado'|null, pendiente: number|null, ideal: number|null,
 *   terminadas: object[], enCurso: {historia: object, dias: number}[], bloqueadas: {historia: object, dias: number}[], porEmpezar: object[], estancadas: object[]}}
 */
export function resumenDaily(proyecto, sprint, ahora = new Date()) {
  const corte = sprint.ultimaDaily || new Date(ahora.getTime() - DIA).toISOString();
  const del = proyecto.historias.filter((h) => h.sprintId === sprint.id);
  const dias = (desde) => (desde ? Math.max(0, Math.floor((ahora - new Date(desde)) / DIA)) : 0);
  const bloqueadas = del.filter((h) => h.bloqueo && h.estado !== 'done').map((historia) => ({ historia, dias: diasBloqueada(historia, ahora) }));
  const enCurso = del.filter((h) => (h.estado === 'doing' || h.estado === 'review') && !h.bloqueo).map((historia) => ({ historia, dias: dias(historia.iniciada) }));

  // ¿Va a tiempo? Lo que falta hoy contra la línea ideal del burndown, con un margen del 10% del total
  const hoy = burndown(sprint, proyecto.historias, ahora).find((p) => p.dia === fechaISO(ahora));
  const total = del.reduce((t, h) => t + (h.puntos || 0), 0);
  let ritmo = null;
  if (hoy && hoy.pendiente !== null && total) {
    const margen = total * 0.1;
    ritmo = hoy.pendiente > hoy.ideal + margen ? 'atrasado' : hoy.pendiente < hoy.ideal - margen ? 'adelantado' : 'a tiempo';
  }

  return {
    corte,
    objetivo: sprint.objetivo || '',
    ritmo,
    pendiente: hoy?.pendiente ?? null,
    ideal: hoy?.ideal ?? null,
    terminadas: del.filter((h) => h.estado === 'done' && h.terminada && h.terminada > corte),
    enCurso,
    bloqueadas,
    porEmpezar: del.filter((h) => h.estado === 'todo' && !h.bloqueo),
    estancadas: enCurso.filter((x) => x.dias > DIAS_ESTANCADA).map((x) => x.historia),
  };
}

/** El resumen en Markdown, para pegar en el chat del equipo o en el acta de la Daily. */
export function dailyMarkdown(proyecto, sprint, ahora = new Date()) {
  const r = resumenDaily(proyecto, sprint, ahora);
  const lista = (items, vacio) => (items.length ? items : [`- _${vacio}_`]);
  const ritmo = { atrasado: 'atrasado respecto de la línea ideal', adelantado: 'adelantado', 'a tiempo': 'a tiempo' }[r.ritmo];
  return [
    `## Daily · ${sprint.nombre} · ${ahora.toLocaleDateString('es-CL')}`,
    '',
    r.objetivo ? `**Objetivo del sprint:** ${r.objetivo}` : null,
    ritmo ? `**Ritmo:** ${ritmo} (faltan ${r.pendiente} pts; lo ideal hoy serían ${r.ideal}).` : null,
    '',
    '### Terminado desde la última Daily',
    ...lista(r.terminadas.map((h) => `- ${h.titulo}`), 'Nada nuevo'),
    '',
    '### En curso',
    ...lista(r.enCurso.map(({ historia, dias }) => `- ${historia.titulo} (${dias === 0 ? 'desde hoy' : `${dias} ${dias === 1 ? 'día' : 'días'}`}${dias > DIAS_ESTANCADA ? ', ¿sigue avanzando?' : ''})`), 'Nada en curso'),
    '',
    '### Bloqueado',
    ...lista(r.bloqueadas.map(({ historia, dias }) => `- ${historia.titulo}: ${historia.bloqueo.motivo} (${dias} ${dias === 1 ? 'día' : 'días'})`), 'Sin bloqueos'),
    '',
    `_Por empezar: ${r.porEmpezar.length}._`,
  ].filter((l) => l !== null).join('\n');
}
