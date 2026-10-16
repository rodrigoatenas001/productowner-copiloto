// Trivia en pantalla compartida: lógica pura de la partida (preguntas, puntaje y ranking).
import { PREGUNTAS, TEMAS } from './preguntas.js';

export const PUNTOS_MAXIMOS = 1000;

/** Mezcla con semilla, para poder repetir una partida o probarla. */
export function barajar(lista, semilla = Date.now()) {
  const copia = [...lista];
  let s = semilla % 2147483647;
  if (s <= 0) s += 2147483646;
  const azar = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/**
 * Crea una partida. `banco` = preguntas incluidas + propias.
 * @param {{equipos: string[], temas?: string[], cantidad?: number, segundos?: number, semilla?: number}} opciones
 */
export function crearPartida(banco, { equipos, temas = Object.keys(TEMAS), cantidad = 10, segundos = 20, semilla } = {}) {
  const nombres = [...new Set((equipos || []).map((e) => String(e).trim()).filter(Boolean))].slice(0, 12);
  if (nombres.length < 1) throw new Error('Agrega al menos un equipo o participante.');
  const elegibles = banco.filter((p) => temas.includes(p.tema));
  if (!elegibles.length) throw new Error('No hay preguntas para los temas elegidos.');

  return {
    preguntas: barajar(elegibles, semilla).slice(0, Math.max(1, Math.min(cantidad, 50))),
    equipos: nombres.map((nombre) => ({ nombre, puntos: 0, aciertos: 0, racha: 0 })),
    segundos: Math.max(5, Math.min(120, segundos)),
    indice: 0,
    fase: 'pregunta', // 'pregunta' → 'respuesta' → (siguiente) … → 'final'
  };
}

/**
 * Puntaje de un acierto, como en Kahoot: más rápido, más puntos (entre 500 y 1000),
 * más un bono de racha de 100 por acierto seguido (máximo 500).
 */
export function puntajeAcierto(segundosRestantes, segundosTotales, racha = 0) {
  const fraccion = Math.max(0, Math.min(1, segundosRestantes / segundosTotales));
  return Math.round(PUNTOS_MAXIMOS * (0.5 + 0.5 * fraccion)) + Math.min(500, racha * 100);
}

/**
 * Registra quiénes acertaron la pregunta actual y pasa a mostrar la respuesta.
 * @param {string[]} acertaron  nombres de equipos que acertaron
 */
export function registrarRespuestas(partida, acertaron, segundosRestantes) {
  if (partida.fase !== 'pregunta') return partida;
  const ok = new Set(acertaron);
  return {
    ...partida,
    fase: 'respuesta',
    equipos: partida.equipos.map((e) => (ok.has(e.nombre)
      ? { ...e, puntos: e.puntos + puntajeAcierto(segundosRestantes, partida.segundos, e.racha), aciertos: e.aciertos + 1, racha: e.racha + 1 }
      : { ...e, racha: 0 })),
  };
}

export function siguientePregunta(partida) {
  const ultima = partida.indice >= partida.preguntas.length - 1;
  return { ...partida, indice: ultima ? partida.indice : partida.indice + 1, fase: ultima ? 'final' : 'pregunta' };
}

export function ranking(partida) {
  return [...partida.equipos].sort((a, b) => b.puntos - a.puntos || b.aciertos - a.aciertos || a.nombre.localeCompare(b.nombre));
}

/**
 * Valida preguntas importadas (JSON). Descarta las mal formadas en vez de fallar todo.
 * @returns {{preguntas: object[], descartadas: number}}
 */
export function validarPreguntas(datos) {
  const lista = Array.isArray(datos) ? datos : Array.isArray(datos?.preguntas) ? datos.preguntas : null;
  if (!lista) throw new Error('El archivo debe tener una lista de preguntas.');
  const txt = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const preguntas = [];
  let descartadas = 0;
  for (const p of lista.slice(0, 500)) {
    const opciones = Array.isArray(p?.opciones) ? p.opciones.map((o) => txt(o, 200)).filter(Boolean).slice(0, 4) : [];
    const correcta = Number(p?.correcta);
    const texto = txt(p?.texto, 300);
    if (!texto || opciones.length < 2 || !Number.isInteger(correcta) || correcta < 0 || correcta >= opciones.length) {
      descartadas++;
      continue;
    }
    preguntas.push({ tema: txt(p.tema, 40) || 'propias', texto, opciones, correcta, explicacion: txt(p.explicacion, 500), propia: true });
  }
  return { preguntas, descartadas };
}

export const BANCO_INCLUIDO = PREGUNTAS;
