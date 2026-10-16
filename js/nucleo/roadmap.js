// Visión, Objetivo del Producto (Guía Scrum 2020) y roadmap Ahora / Siguiente / Después por épica.
import { resumenEpicas } from './proyecto.js';
import { infoEpica, hipotesis, resultadosDeEpica } from './okr.js';
import { pronosticar, textoPronostico } from './pronostico.js';

export const HORIZONTES = {
  ahora: { nombre: 'Ahora', ayuda: 'En curso o en el próximo sprint.' },
  siguiente: { nombre: 'Siguiente', ayuda: 'En los próximos meses.' },
  despues: { nombre: 'Después', ayuda: 'Ideas con valor, sin fecha.' },
};

/** Sprints de pronóstico hasta los que una épica se considera "Siguiente". */
const LIMITE_SIGUIENTE = 4;

export function visionDe(proyecto) {
  const v = proyecto.vision || {};
  return { vision: v.vision || '', objetivoProducto: v.objetivoProducto || '' };
}

/**
 * Horizonte de una épica: el que eligió la persona, o uno automático:
 * "ahora" si tiene historias en un sprint abierto; "siguiente" si el pronóstico probable
 * la termina en 4 sprints o menos; si no, "después".
 */
export function horizonteDe(proyecto, epica, pronostico = pronosticar(proyecto)) {
  const manual = infoEpica(proyecto, epica).horizonte;
  if (manual && manual in HORIZONTES) return { horizonte: manual, automatico: false };
  const abiertos = new Set(proyecto.sprints.filter((s) => s.estado !== 'cerrado').map((s) => s.id));
  if (proyecto.historias.some((h) => (h.epica || '') === epica && h.estado !== 'done' && abiertos.has(h.sprintId))) return { horizonte: 'ahora', automatico: true };
  const p = pronostico?.epicas.find((x) => x.epica === epica);
  return { horizonte: p && p.probable.sprints <= LIMITE_SIGUIENTE ? 'siguiente' : 'despues', automatico: true };
}

/**
 * El roadmap: épicas con trabajo pendiente agrupadas por horizonte, en orden del backlog.
 * @returns {{ahora: object[], siguiente: object[], despues: object[], terminadas: object[]}}
 */
export function roadmap(proyecto, hoy = new Date()) {
  const pron = pronosticar(proyecto, hoy);
  const grupos = { ahora: [], siguiente: [], despues: [], terminadas: [] };
  for (const e of resumenEpicas(proyecto)) {
    if (!e.epica) continue;
    const info = infoEpica(proyecto, e.epica);
    const p = pron?.epicas.find((x) => x.epica === e.epica);
    const ficha = {
      ...e,
      hipotesis: hipotesis(info),
      resultadoHipotesis: info.resultadoHipotesis || 'pendiente',
      resultados: resultadosDeEpica(proyecto, e.epica),
      pronostico: p ? textoPronostico(p) : null,
      ...horizonteDe(proyecto, e.epica, pron),
    };
    if (e.historias && e.hechas === e.historias) grupos.terminadas.push(ficha);
    else grupos[ficha.horizonte].push(ficha);
  }
  return grupos;
}
