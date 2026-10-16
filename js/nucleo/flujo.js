// "Kanban liviano" dentro de Scrum: columna de revisión opcional, límites de trabajo en curso (WIP),
// bloqueos con motivo y tiempo de ciclo (desde que se empieza hasta que se termina).

export const FLUJO_INICIAL = { revision: false, wip: { doing: null, review: null } };

export function flujoDe(proyecto) {
  const f = proyecto.flujo || {};
  return { revision: f.revision === true, wip: { doing: f.wip?.doing ?? null, review: f.wip?.review ?? null } };
}

/** Columnas del tablero del sprint, según la configuración del proyecto. */
export function columnasDe(proyecto) {
  return ['todo', 'doing', ...(flujoDe(proyecto).revision ? ['review'] : []), 'done'];
}

/** Uso de una columna frente a su límite WIP. */
export function usoWip(proyecto, sprintId, estado) {
  const limite = flujoDe(proyecto).wip[estado] ?? null;
  const cuenta = proyecto.historias.filter((h) => h.sprintId === sprintId && h.estado === estado).length;
  return { cuenta, limite, excede: limite !== null && cuenta > limite };
}

const DIA = 86400000;

/** Días (con un decimal) entre que se empezó y se terminó. null si no aplica. */
export function tiempoCiclo(h) {
  if (!h.iniciada || !h.terminada) return null;
  return Math.max(0, Math.round(((new Date(h.terminada) - new Date(h.iniciada)) / DIA) * 10) / 10);
}

/** Tiempo de ciclo promedio de un conjunto de historias terminadas. */
export function cicloPromedio(historias) {
  const ciclos = historias.map(tiempoCiclo).filter((c) => c !== null);
  return ciclos.length ? Math.round((ciclos.reduce((a, b) => a + b, 0) / ciclos.length) * 10) / 10 : null;
}

export function bloquear(historia, motivo, cuando = new Date()) {
  const texto = String(motivo || '').trim().slice(0, 300);
  if (!texto) throw new Error('Indica qué la bloquea: así se puede pedir ayuda a quien corresponde.');
  return { ...historia, bloqueo: { motivo: texto, desde: new Date(cuando).toISOString() } };
}

export function desbloquear(historia) {
  return { ...historia, bloqueo: null };
}

/** Días que lleva bloqueada (redondeado hacia abajo). */
export function diasBloqueada(historia, hoy = new Date()) {
  return historia.bloqueo ? Math.max(0, Math.floor((new Date(hoy) - new Date(historia.bloqueo.desde)) / DIA)) : 0;
}

export function normalizarFlujo(f) {
  const limite = (v) => (Number.isInteger(v) && v > 0 && v <= 50 ? v : null);
  return { revision: f?.revision === true, wip: { doing: limite(f?.wip?.doing), review: limite(f?.wip?.review) } };
}

export function normalizarBloqueo(b) {
  if (!b || typeof b !== 'object' || typeof b.motivo !== 'string' || !b.motivo.trim()) return null;
  const desde = new Date(b.desde);
  return { motivo: b.motivo.trim().slice(0, 300), desde: Number.isNaN(desde.getTime()) ? new Date().toISOString() : desde.toISOString() };
}
