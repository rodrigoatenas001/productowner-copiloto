// Borrador del objetivo del sprint a partir de sus historias (sin IA).
// Un buen objetivo dice qué valor se entrega, no la lista de tareas.
import { PRIORIDADES } from './historias.js';
import { infoEpica } from './okr.js';

const ORDEN = Object.keys(PRIORIDADES);

/**
 * Propone un objetivo: toma la épica con más puntos en el sprint y sus dos historias más importantes.
 * @returns {string|null} null si el sprint no tiene historias
 */
export function sugerirObjetivo(proyecto, sprintId) {
  const hs = proyecto.historias.filter((h) => h.sprintId === sprintId);
  if (!hs.length) return null;

  const porEpica = new Map();
  for (const h of hs) porEpica.set(h.epica, (porEpica.get(h.epica) || 0) + (h.puntos || 1));
  const [epica] = [...porEpica].sort((a, b) => b[1] - a[1])[0];

  const principales = hs
    .filter((h) => h.epica === epica)
    .sort((a, b) => ORDEN.indexOf(a.prioridad) - ORDEN.indexOf(b.prioridad) || (b.puntos || 0) - (a.puntos || 0))
    .slice(0, 2);
  const rol = principales[0].rol;
  // El objetivo habla en tercera persona: "mi tarjeta" → "su tarjeta"
  const acciones = principales.map((h) => h.quiero.replace(/(^|\s)mis(?=\s|$)/gi, '$1sus').replace(/(^|\s)mi(?=\s|$)/gi, '$1su').replace(/(^|\s)me(?=\s|$)/gi, '$1le'));
  const unidas = acciones.length > 1 ? `${acciones[0]} y ${acciones[1]}` : acciones[0];
  const beneficio = infoEpica(proyecto, epica).lograremos || principales[0].para;

  return `Que ${rol === 'usuario' ? 'las personas usuarias' : `${articulo(rol)} ${rol}`} pueda${rol === 'usuario' ? 'n' : ''} ${unidas}${beneficio ? `, para ${beneficio}` : ''}.`;
}

/** "la" o "el" según la terminación del rol (aproximación para roles comunes). */
function articulo(rol) {
  const primera = rol.split(' ')[0];
  return /a$/.test(primera) && !/(ista|ema|eta)$/.test(primera) ? 'la' : 'el';
}
