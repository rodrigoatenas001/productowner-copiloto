// Pronóstico de entrega: "¿cuándo va a estar?" con rango, a partir de la velocidad real.
// Optimista = el mejor sprint reciente; probable = el promedio; pesimista = el peor.
// Se avanza en el orden del backlog: una épica termina cuando termina su última historia pendiente.
import { fechaISO, puntosDe } from './proyecto.js';

const DIAS_SPRINT_POR_DEFECTO = 14;
const SPRINTS_CONSIDERADOS = 6;

/** Puntos terminados en cada sprint cerrado (los más recientes, hasta 6). */
export function velocidades(proyecto) {
  return proyecto.sprints
    .filter((s) => s.estado === 'cerrado')
    .slice(-SPRINTS_CONSIDERADOS)
    .map((s) => puntosDe(proyecto.historias.filter((h) => h.sprintId === s.id && h.estado === 'done')))
    .filter((v) => v > 0);
}

/** Escenarios de velocidad. null si aún no hay sprints cerrados con trabajo terminado. */
export function escenarios(proyecto) {
  const v = velocidades(proyecto);
  if (!v.length) return null;
  const promedio = v.reduce((a, b) => a + b, 0) / v.length;
  return { optimista: Math.max(...v), probable: Math.round(promedio * 10) / 10, pesimista: Math.min(...v), sprints: v.length };
}

/** Largo de sprint en días según el último sprint (o 14). */
function diasSprint(proyecto) {
  const s = proyecto.sprints[proyecto.sprints.length - 1];
  if (!s) return DIAS_SPRINT_POR_DEFECTO;
  const dias = Math.round((new Date(s.fin) - new Date(s.inicio)) / 86400000) + 1;
  return dias > 0 && dias <= 60 ? dias : DIAS_SPRINT_POR_DEFECTO;
}

/** Cuándo empieza a contar el pronóstico: el día después del sprint activo, o hoy. */
function inicioPronostico(proyecto, hoy) {
  const activo = proyecto.sprints.find((s) => s.estado === 'activo');
  if (activo) return new Date(new Date(activo.fin + 'T00:00:00').getTime() + 86400000);
  return new Date(fechaISO(hoy) + 'T00:00:00');
}

/** Fecha en que termina el sprint número n (1 = el próximo) desde el inicio del pronóstico. */
function finDelSprint(inicio, dias, n) {
  return fechaISO(new Date(inicio.getTime() + (n * dias - 1) * 86400000));
}

/**
 * Pronóstico por épica, en el orden del backlog.
 * @returns {null | {escenarios: object, diasSprint: number, epicas: {epica: string, pendientes: number, sinEstimar: number,
 *   optimista: {sprints: number, fecha: string}, probable: {...}, pesimista: {...}}[], total: {...}}}
 */
export function pronosticar(proyecto, hoy = new Date()) {
  const esc = escenarios(proyecto);
  if (!esc) return null;
  const dias = diasSprint(proyecto);
  const inicio = inicioPronostico(proyecto, hoy);
  const activo = proyecto.sprints.find((s) => s.estado === 'activo');

  // Lo que está en el sprint activo ya tiene fecha (su fin); el resto avanza en el orden del backlog
  const pendientes = proyecto.historias.filter((h) => h.estado !== 'done' && !(activo && h.sprintId === activo.id) && h.prioridad !== 'wont');
  const acumulado = new Map();
  const sinEstimar = new Map();
  let suma = 0;
  for (const h of pendientes) {
    suma += h.puntos || 0;
    const clave = h.epica || '';
    acumulado.set(clave, suma);
    if (!h.puntos) sinEstimar.set(clave, (sinEstimar.get(clave) || 0) + 1);
  }

  const escenario = (puntos, velocidad) => {
    if (!puntos) return { sprints: 0, fecha: activo ? activo.fin : fechaISO(hoy) };
    const n = Math.ceil(puntos / velocidad);
    return { sprints: n, fecha: finDelSprint(inicio, dias, n) };
  };
  const tres = (puntos) => ({
    optimista: escenario(puntos, esc.optimista),
    probable: escenario(puntos, esc.probable),
    pesimista: escenario(puntos, esc.pesimista),
  });

  const epicasConPendiente = new Set(proyecto.historias.filter((h) => h.estado !== 'done' && h.prioridad !== 'wont').map((h) => h.epica || ''));
  const epicas = [...epicasConPendiente].map((epica) => ({
    epica,
    pendientes: puntosDe(pendientes.filter((h) => (h.epica || '') === epica)),
    sinEstimar: sinEstimar.get(epica) || 0,
    ...tres(acumulado.get(epica) || 0),
  }));

  return {
    escenarios: esc,
    diasSprint: dias,
    epicas,
    total: { pendientes: suma, sinEstimar: pendientes.filter((h) => !h.puntos).length, ...tres(suma) },
  };
}

/** Texto corto para mostrar: "probable 12-05 (entre 28-04 y 09-06)". */
export function textoPronostico(p) {
  const f = (iso) => iso.slice(8, 10) + '-' + iso.slice(5, 7) + '-' + iso.slice(0, 4);
  if (!p.probable.sprints) return 'en el sprint actual';
  const rango = p.optimista.fecha === p.pesimista.fecha ? '' : ` (entre ${f(p.optimista.fecha)} y ${f(p.pesimista.fecha)})`;
  return `probable ${f(p.probable.fecha)}${rango}`;
}
