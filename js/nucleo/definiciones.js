// Definition of Ready (lista para entrar al sprint) y Definition of Done (terminada de verdad).

export const DEFINICIONES_INICIALES = {
  ready: [
    'Tiene rol, acción y beneficio claros',
    'Tiene criterios de aceptación verificables',
    'Está estimada por el equipo',
    'Cabe en un sprint',
    'No depende de algo que no está listo',
  ],
  done: [
    'Cumple todos los criterios de aceptación',
    'Revisada por otra persona del equipo',
    'Probada (incluidos casos de error)',
    'Documentada si cambia cómo se usa',
    'Aceptada por el Product Owner',
  ],
};

export const NOMBRES = { ready: 'Definition of Ready', done: 'Definition of Done' };

/** Las listas del proyecto, o las iniciales si el proyecto es anterior a esta función. */
export function definicionesDe(proyecto) {
  const d = proyecto.definiciones || {};
  return {
    ready: Array.isArray(d.ready) ? d.ready : DEFINICIONES_INICIALES.ready,
    done: Array.isArray(d.done) ? d.done : DEFINICIONES_INICIALES.done,
  };
}

/** Avance de una historia en una lista. Los puntos marcados se guardan por texto. */
export function avance(historia, lista, tipo) {
  const marcados = new Set(historia.checks?.[tipo] || []);
  const hechos = lista.filter((item) => marcados.has(item));
  return { hechos: hechos.length, total: lista.length, faltan: lista.filter((item) => !marcados.has(item)), completa: hechos.length === lista.length };
}

export function marcar(historia, tipo, item, valor) {
  const actuales = new Set(historia.checks?.[tipo] || []);
  if (valor) actuales.add(item); else actuales.delete(item);
  return { ...historia, checks: { ...(historia.checks || {}), [tipo]: [...actuales] } };
}

/** Texto (uno por línea) → lista limpia, sin repetidos, máximo 15 puntos. */
export function listaDesdeTexto(texto) {
  return [...new Set(String(texto || '').split(/\r?\n/).map((l) => l.replace(/^\s*[-*•]\s*/, '').trim()).filter(Boolean))]
    .map((l) => l.slice(0, 160)).slice(0, 15);
}

export function normalizarDefiniciones(d) {
  const limpiar = (lista, inicial) => (Array.isArray(lista) ? listaDesdeTexto(lista.filter((x) => typeof x === 'string').join('\n')) : inicial);
  return { ready: limpiar(d?.ready, DEFINICIONES_INICIALES.ready), done: limpiar(d?.done, DEFINICIONES_INICIALES.done) };
}

export function normalizarChecks(c) {
  const lista = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string').map((x) => x.slice(0, 160)).slice(0, 15) : []);
  return { ready: lista(c?.ready), done: lista(c?.done) };
}
