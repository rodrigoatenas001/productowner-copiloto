// Estimación en equipo (planning poker): resumen de votos y sugerencia de consenso.
import { ESCALA_PUNTOS } from './historias.js';

/**
 * @param {(number|'?')[]} votos  "?" = no sé
 * @returns {{numericos: number[], dudas: number, min: number|null, max: number|null, sugerencia: number|null, acuerdo: boolean, conversar: boolean}}
 */
export function consenso(votos) {
  const numericos = votos.filter((v) => typeof v === 'number' && ESCALA_PUNTOS.includes(v)).sort((a, b) => a - b);
  const dudas = votos.filter((v) => v === '?').length;
  if (!numericos.length) {
    return { numericos, dudas, min: null, max: null, sugerencia: null, acuerdo: false, conversar: dudas > 0 };
  }

  const min = numericos[0];
  const max = numericos[numericos.length - 1];
  const medio = numericos.length / 2;
  const mediana = numericos.length % 2 ? numericos[Math.floor(medio)] : (numericos[medio - 1] + numericos[medio]) / 2;
  // La mediana redondeada hacia arriba a la escala: estimar de menos sale más caro que de más
  const sugerencia = ESCALA_PUNTOS.find((p) => p >= mediana) ?? ESCALA_PUNTOS[ESCALA_PUNTOS.length - 1];

  // Hay acuerdo si todos están en el mismo valor o en valores vecinos de la escala
  const distancia = ESCALA_PUNTOS.indexOf(max) - ESCALA_PUNTOS.indexOf(min);
  return {
    numericos,
    dudas,
    min,
    max,
    sugerencia,
    acuerdo: distancia <= 1 && dudas === 0,
    conversar: distancia >= 2 || dudas > 0,
  };
}

/** Siguiente historia sin estimar del backlog, en orden de prioridad. */
export function siguienteSinEstimar(historias, despuesDeId = null) {
  const pendientes = historias.filter((h) => h.estado === 'backlog' && !h.puntos && h.prioridad !== 'wont');
  if (!despuesDeId) return pendientes[0] || null;
  const i = pendientes.findIndex((h) => h.id === despuesDeId);
  return pendientes[i + 1] || null;
}
