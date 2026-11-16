// Matriz de stakeholders (poder / interés): quién aprueba, quién opera en terreno y quién mantiene el
// sistema. Sirve desde el día 1 para no diseñar algo perfecto en el escritorio que después se rechaza.
import { nuevoId } from './historias.js';

export const ROLES_STAKEHOLDER = {
  aprueba: 'Aprueba presupuesto o decide',
  opera: 'Opera en terreno',
  mantiene: 'Mantiene el sistema (TI/OT)',
  usa: 'Usa el resultado',
  otro: 'Otro',
};

export const NIVELES = { alto: 'Alto', bajo: 'Bajo' };

/** Los cuatro cuadrantes, con lo que conviene hacer con cada grupo. */
export const CUADRANTES_PI = {
  gestionar: { nombre: 'Gestionar de cerca', poder: 'alto', interes: 'alto', estrategia: 'Involúcralos en las decisiones y en cada Review: su apoyo define el proyecto.' },
  satisfacer: { nombre: 'Mantener satisfechos', poder: 'alto', interes: 'bajo', estrategia: 'Pocas reuniones, con resultados, costos y riesgos claros: que nada los sorprenda.' },
  informar: { nombre: 'Mantener informados', poder: 'bajo', interes: 'alto', estrategia: 'Muéstrales avances y escucha su experiencia: suelen ser quienes lo usarán cada día.' },
  monitorear: { nombre: 'Monitorear', poder: 'bajo', interes: 'bajo', estrategia: 'Informa lo necesario y revisa si su posición cambia.' },
};

const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export function normalizarStakeholders(lista, idsCarril = new Set()) {
  return (Array.isArray(lista) ? lista : []).slice(0, 60).map((s) => ({
    id: texto(s?.id, 60) || nuevoId('st'),
    nombre: texto(s?.nombre, 80) || 'Sin nombre',
    cargo: texto(s?.cargo, 80),
    rol: Object.hasOwn(ROLES_STAKEHOLDER, s?.rol) ? s.rol : 'otro',
    poder: s?.poder === 'alto' ? 'alto' : 'bajo',
    interes: s?.interes === 'alto' ? 'alto' : 'bajo',
    carril: idsCarril.has(s?.carril) ? s.carril : null,
    notas: texto(s?.notas, 500),
  }));
}

export const stakeholdersDe = (proyecto) => proyecto.stakeholders || [];

export function cuadranteDe(s) {
  return Object.entries(CUADRANTES_PI).find(([, c]) => c.poder === s.poder && c.interes === s.interes)[0];
}

export function nuevoStakeholder(datos = {}) {
  return normalizarStakeholders([{ ...datos, id: nuevoId('st') }], new Set(datos.carril ? [datos.carril] : []))[0];
}

/**
 * Lo que suele faltar al mapear stakeholders. Avisos, no errores.
 * @returns {{texto: string}[]}
 */
export function revisarStakeholders(lista, proceso = { carriles: [] }) {
  if (!lista.length) return [];
  const avisos = [];
  const tiene = (rol) => lista.some((s) => s.rol === rol);
  if (!tiene('aprueba')) avisos.push({ texto: 'Nadie aprueba presupuesto o decide: ¿quién firma si hay que cambiar el alcance?' });
  if (!tiene('opera')) avisos.push({ texto: 'Nadie opera en terreno: falta quien use el sistema cada día y pueda rechazarlo.' });
  if (!tiene('mantiene')) avisos.push({ texto: 'Nadie mantiene el sistema (TI/OT): ¿quién lo instala, respalda y soporta después de la entrega?' });
  for (const c of proceso.carriles || []) {
    if (!lista.some((s) => s.carril === c.id)) avisos.push({ texto: `¿Quién habla por «${c.nombre}», del proceso? Si es un sistema, enlázalo con quien lo mantiene.` });
  }
  for (const s of lista) {
    if (s.rol === 'opera' && s.interes === 'bajo') avisos.push({ texto: `${s.nombre} opera en terreno pero tiene interés bajo: es el riesgo típico de rechazo. Conviene involucrarle antes de construir.` });
  }
  return avisos;
}
