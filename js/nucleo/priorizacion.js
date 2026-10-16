// Priorización con números: WSJF (SAFe) y RICE (Intercom), y la matriz valor/esfuerzo.
// El tamaño o esfuerzo es siempre la estimación en puntos de la historia, para no pedir dos veces lo mismo.

/** Escala relativa de WSJF (se compara contra las demás historias, no es absoluta). */
export const ESCALA_WSJF = [1, 2, 3, 5, 8, 13, 20];

export const IMPACTO_RICE = { 3: 'Masivo', 2: 'Alto', 1: 'Medio', 0.5: 'Bajo', 0.25: 'Mínimo' };
export const CONFIANZA_RICE = { 100: 'Alta (datos)', 80: 'Media (señales)', 50: 'Baja (intuición)' };

const enEscala = (v, escala) => (escala.includes(Number(v)) ? Number(v) : null);

/** Normaliza los datos de priorización de una historia (por ejemplo, desde un respaldo). */
export function normalizarPriorizacion(p) {
  if (!p || typeof p !== 'object') return {};
  const alcance = Number(p.alcance);
  return {
    valor: enEscala(p.valor, ESCALA_WSJF),
    urgencia: enEscala(p.urgencia, ESCALA_WSJF),
    riesgo: enEscala(p.riesgo, ESCALA_WSJF),
    alcance: Number.isFinite(alcance) && alcance >= 0 ? Math.min(Math.round(alcance), 10_000_000) : null,
    impacto: Number(p.impacto) in IMPACTO_RICE ? Number(p.impacto) : null,
    confianza: Number(p.confianza) in CONFIANZA_RICE ? Number(p.confianza) : null,
  };
}

/** Costo del retraso = valor para el negocio + criticidad temporal + reducción de riesgo u oportunidad. */
export function costoDelRetraso(h) {
  const p = h.priorizacion || {};
  return p.valor && p.urgencia && p.riesgo ? p.valor + p.urgencia + p.riesgo : null;
}

/** WSJF = costo del retraso / tamaño. Más alto = hacer antes. */
export function wsjf(h) {
  const cod = costoDelRetraso(h);
  return cod && h.puntos ? Math.round((cod / h.puntos) * 100) / 100 : null;
}

/** RICE = alcance × impacto × confianza / esfuerzo. */
export function rice(h) {
  const p = h.priorizacion || {};
  if (p.alcance == null || !p.impacto || !p.confianza || !h.puntos) return null;
  return Math.round(((p.alcance * p.impacto * (p.confianza / 100)) / h.puntos) * 10) / 10;
}

export const METODOS = {
  wsjf: { nombre: 'WSJF', puntaje: wsjf, explicacion: 'Costo del retraso (valor + urgencia + reducción de riesgo) dividido por el tamaño. Útil cuando el tiempo importa.' },
  rice: { nombre: 'RICE', puntaje: rice, explicacion: 'Alcance × impacto × confianza dividido por el esfuerzo. Útil para comparar mejoras de producto.' },
};

/**
 * Backlog ordenado por puntaje (mayor primero). Las historias sin datos suficientes
 * quedan al final, en su orden actual, para que nadie las pierda de vista.
 */
export function ordenarPorPuntaje(historias, metodo) {
  const calcular = METODOS[metodo].puntaje;
  const conPuntaje = [];
  const sinPuntaje = [];
  historias.forEach((h, i) => {
    const p = calcular(h);
    (p === null ? sinPuntaje : conPuntaje).push({ h, p, i });
  });
  conPuntaje.sort((a, b) => b.p - a.p || a.i - b.i);
  return [...conPuntaje, ...sinPuntaje].map((x) => x.h);
}

/** Aplica el orden por puntaje solo a la parte "backlog" de la lista, sin mover lo que está en sprints. */
export function reordenarBacklog(historias, metodo) {
  const backlog = historias.filter((h) => h.estado === 'backlog');
  const ordenado = ordenarPorPuntaje(backlog, metodo);
  let k = 0;
  return historias.map((h) => (h.estado === 'backlog' ? ordenado[k++] : h));
}

export const CUADRANTES = {
  rapida: { nombre: 'Victorias rápidas', ayuda: 'Mucho valor, poco esfuerzo: hazlas primero.' },
  grande: { nombre: 'Apuestas grandes', ayuda: 'Mucho valor, mucho esfuerzo: planifícalas y divídelas.' },
  relleno: { nombre: 'Relleno', ayuda: 'Poco valor, poco esfuerzo: cuando sobre tiempo.' },
  trampa: { nombre: 'Trampas de tiempo', ayuda: 'Poco valor, mucho esfuerzo: cuestiónalas.' },
};

const mediana = (xs) => {
  const v = [...xs].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};

/**
 * Matriz valor/esfuerzo. Valor = costo del retraso (WSJF); esfuerzo = puntos.
 * Los cortes son las medianas del propio backlog: compara las historias entre sí.
 * @returns {{cuadrantes: Object<string, object[]>, sinDatos: object[], cortes: {valor: number, esfuerzo: number}|null}}
 */
export function matrizValorEsfuerzo(historias) {
  const cuadrantes = { rapida: [], grande: [], relleno: [], trampa: [] };
  const conDatos = historias.filter((h) => costoDelRetraso(h) && h.puntos);
  const sinDatos = historias.filter((h) => !(costoDelRetraso(h) && h.puntos));
  if (!conDatos.length) return { cuadrantes, sinDatos, cortes: null };

  const cortes = { valor: mediana(conDatos.map(costoDelRetraso)), esfuerzo: mediana(conDatos.map((h) => h.puntos)) };
  for (const h of conDatos) {
    const alto = costoDelRetraso(h) >= cortes.valor;
    const caro = h.puntos > cortes.esfuerzo;
    cuadrantes[alto ? (caro ? 'grande' : 'rapida') : (caro ? 'trampa' : 'relleno')].push(h);
  }
  return { cuadrantes, sinDatos, cortes };
}
