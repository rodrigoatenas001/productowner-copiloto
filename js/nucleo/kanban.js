// Kanban continuo: sin sprints. Se trae trabajo del backlog cuando hay capacidad (pull), se limita el
// trabajo en curso y se mide el flujo: rendimiento por semana, tiempo de entrega, tiempo de ciclo y el
// diagrama de flujo acumulado. Para soporte, incidencias y mejoras que llegan todos los días.
import { flujoDe } from './flujo.js';
import { fechaISO, cambiarEstado } from './proyecto.js';

const DIA = 86400000;
/** Lo terminado hace más de estos días sale del tablero (sigue en las métricas). */
export const DIAS_VISIBLE_HECHO = 14;

export const esKanban = (proyecto) => flujoDe(proyecto).modo === 'kanban';

/** En el tablero continuo: lo que salió del backlog y no pertenece a un sprint. */
const enTablero = (h) => !h.sprintId && h.estado !== 'backlog';

/** Historias del tablero; lo terminado hace tiempo queda archivado (solo cuenta). */
export function itemsTablero(proyecto, ahora = new Date()) {
  const limite = ahora.getTime() - DIAS_VISIBLE_HECHO * DIA;
  const todos = proyecto.historias.filter(enTablero);
  const visibles = todos.filter((h) => h.estado !== 'done' || !h.terminada || new Date(h.terminada).getTime() >= limite);
  return { visibles, archivadas: todos.length - visibles.length };
}

/** Pull: trae historias del backlog a «Por hacer», anotando cuándo entraron (para el tiempo de entrega). */
export function traerAlTablero(proyecto, ids, ahora = new Date()) {
  const elegidas = new Set(ids);
  return {
    ...proyecto,
    historias: proyecto.historias.map((h) => (elegidas.has(h.id) && h.estado === 'backlog'
      ? { ...h, estado: 'todo', sprintId: null, entrada: ahora.toISOString() } : h)),
  };
}

/** Uso de una columna del tablero continuo frente a su límite. */
export function usoWipKanban(proyecto, estado) {
  const limite = flujoDe(proyecto).wip[estado] ?? null;
  const cuenta = proyecto.historias.filter((h) => enTablero(h) && h.estado === estado).length;
  return { cuenta, limite, excede: limite !== null && cuenta > limite };
}

// Un intervalo al revés (fechas importadas o editadas a mano) no es un tiempo real: se ignora en vez de contar 0
const dias = (desde, hasta) => {
  if (!desde || !hasta) return null;
  const d = (new Date(hasta) - new Date(desde)) / DIA;
  return d >= 0 ? d : null;
};
const redondear = (n) => (n === null ? null : Math.round(n * 10) / 10);

/** Percentil (por ejemplo 85): «el 85% de las historias se terminó en este tiempo o menos». */
export function percentil(valores, p) {
  if (!valores.length) return null;
  const orden = [...valores].sort((a, b) => a - b);
  return orden[Math.min(orden.length - 1, Math.ceil((p / 100) * orden.length) - 1)];
}

/**
 * Métricas de flujo, sobre todo lo terminado (venga o no de un sprint).
 * @returns {{enCurso: number, edadPromedio: number|null, porSemana: {semana: string, terminadas: number}[], rendimiento: number,
 *   entrega: {promedio: number|null, p85: number|null}, ciclo: {promedio: number|null, p85: number|null}, terminadas: number}}
 */
export function metricasKanban(proyecto, ahora = new Date(), semanas = 8) {
  const terminadas = proyecto.historias.filter((h) => h.estado === 'done' && h.terminada);
  const entregas = terminadas.map((h) => dias(h.entrada || h.creada, h.terminada)).filter((d) => d !== null);
  const ciclos = terminadas.map((h) => dias(h.iniciada, h.terminada)).filter((d) => d !== null);
  const promedio = (l) => (l.length ? l.reduce((a, b) => a + b, 0) / l.length : null);
  const enCurso = proyecto.historias.filter((h) => enTablero(h) && (h.estado === 'doing' || h.estado === 'review'));

  // Semanas de lunes a domingo, de la más antigua a la actual
  const lunes = new Date(ahora);
  lunes.setHours(0, 0, 0, 0);
  lunes.setDate(lunes.getDate() - ((lunes.getDay() + 6) % 7));
  const porSemana = Array.from({ length: semanas }, (_, i) => {
    const inicio = new Date(lunes.getTime() - (semanas - 1 - i) * 7 * DIA);
    const fin = new Date(inicio.getTime() + 7 * DIA);
    return { semana: fechaISO(inicio), terminadas: terminadas.filter((h) => new Date(h.terminada) >= inicio && new Date(h.terminada) < fin).length };
  });
  const completas = porSemana.slice(-5, -1); // las 4 semanas anteriores a la actual

  return {
    enCurso: enCurso.length,
    edadPromedio: redondear(promedio(enCurso.map((h) => dias(h.iniciada, ahora)).filter((d) => d !== null))),
    porSemana,
    rendimiento: redondear(promedio(completas.map((s) => s.terminadas)) ?? 0),
    entrega: { promedio: redondear(promedio(entregas)), p85: redondear(percentil(entregas, 85)) },
    ciclo: { promedio: redondear(promedio(ciclos)), p85: redondear(percentil(ciclos, 85)) },
    terminadas: terminadas.length,
  };
}

/**
 * Diagrama de flujo acumulado: cuántas historias había cada día en por hacer, en curso y hechas.
 * Si la banda «en curso» se ensancha, entra más trabajo del que sale: hay un cuello de botella.
 */
export function flujoAcumulado(proyecto, ahora = new Date(), cantidad = 30) {
  const items = proyecto.historias.filter((h) => h.entrada || h.iniciada || h.terminada);
  return Array.from({ length: cantidad }, (_, i) => {
    const dia = new Date(ahora.getTime() - (cantidad - 1 - i) * DIA);
    const corte = `${fechaISO(dia)}T23:59:59`;
    let porHacer = 0;
    let enCurso = 0;
    let hecho = 0;
    for (const h of items) {
      const entra = h.entrada || h.iniciada || h.terminada;
      if (entra > corte) continue;
      if (h.terminada && h.terminada <= corte) hecho += 1;
      else if (h.iniciada && h.iniciada <= corte) enCurso += 1;
      else porHacer += 1;
    }
    return { dia: fechaISO(dia), porHacer, enCurso, hecho };
  });
}

/**
 * Cambio de modo. A Kanban: el sprint en curso se cierra y lo no terminado pasa al tablero.
 * A Scrum: lo que no se terminó en el tablero vuelve al backlog, para planificarlo en un sprint.
 */
export function cambiarModo(proyecto, modo, ahora = new Date()) {
  const flujo = { ...flujoDe(proyecto), modo };
  if (modo === 'kanban') {
    const activo = proyecto.sprints.find((s) => s.estado === 'activo');
    return {
      ...proyecto,
      flujo,
      sprints: proyecto.sprints.map((s) => (s === activo ? { ...s, estado: 'cerrado' } : s)),
      historias: proyecto.historias.map((h) => (activo && h.sprintId === activo.id && h.estado !== 'done'
        ? { ...h, sprintId: null, entrada: h.entrada || ahora.toISOString() } : h)),
    };
  }
  return {
    ...proyecto,
    flujo,
    historias: proyecto.historias.map((h) => (enTablero(h) && h.estado !== 'done' ? cambiarEstado({ ...h, bloqueo: null }, 'backlog', ahora) : h)),
  };
}
