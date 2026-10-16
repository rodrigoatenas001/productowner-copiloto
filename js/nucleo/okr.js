// Objetivos y resultados clave (OKR) del proyecto, e hipótesis de valor por épica.
// Conecta el backlog con el negocio: ¿para qué objetivo trabaja cada épica?
import { nuevoId } from './historias.js';

const txt = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Cómo resultó la hipótesis de una épica, una vez medida. */
export const RESULTADOS_HIPOTESIS = {
  pendiente: 'Por medir',
  cumplida: 'Se cumplió',
  parcial: 'Se cumplió en parte',
  no: 'No se cumplió',
};

export function agregarObjetivo(proyecto, texto) {
  const objetivo = txt(texto, 200);
  if (!objetivo) return proyecto;
  return { ...proyecto, objetivos: [...(proyecto.objetivos || []), { id: nuevoId('o'), objetivo, resultados: [] }] };
}

export function agregarResultado(proyecto, objetivoId, texto) {
  const resultado = txt(texto, 200);
  if (!resultado) return proyecto;
  return {
    ...proyecto,
    objetivos: (proyecto.objetivos || []).map((o) => (o.id === objetivoId ? { ...o, resultados: [...o.resultados, { id: nuevoId('kr'), texto: resultado }] } : o)),
  };
}

export function quitarObjetivo(proyecto, objetivoId) {
  const quitados = new Set((proyecto.objetivos || []).find((o) => o.id === objetivoId)?.resultados.map((r) => r.id) || []);
  return limpiarVinculos({ ...proyecto, objetivos: (proyecto.objetivos || []).filter((o) => o.id !== objetivoId) }, quitados);
}

export function quitarResultado(proyecto, resultadoId) {
  return limpiarVinculos({
    ...proyecto,
    objetivos: (proyecto.objetivos || []).map((o) => ({ ...o, resultados: o.resultados.filter((r) => r.id !== resultadoId) })),
  }, new Set([resultadoId]));
}

function limpiarVinculos(proyecto, quitados) {
  const info = Object.fromEntries(Object.entries(proyecto.epicasInfo || {}).map(([e, i]) => [e, { ...i, resultados: (i.resultados || []).filter((r) => !quitados.has(r)) }]));
  return { ...proyecto, epicasInfo: info };
}

/** Datos de una épica (hipótesis y resultados clave vinculados). */
export function infoEpica(proyecto, epica) {
  const i = (proyecto.epicasInfo || {})[epica] || {};
  return {
    creemos: i.creemos || '', lograremos: i.lograremos || '', veremos: i.veremos || '', resultados: i.resultados || [],
    horizonte: i.horizonte || '', resultadoHipotesis: i.resultadoHipotesis || 'pendiente', datoReal: i.datoReal || '',
  };
}

export function editarEpica(proyecto, epica, cambios) {
  return { ...proyecto, epicasInfo: { ...(proyecto.epicasInfo || {}), [epica]: { ...infoEpica(proyecto, epica), ...cambios } } };
}

/** La hipótesis en una frase, o null si está incompleta. */
export function hipotesis(info) {
  if (!info.creemos || !info.lograremos || !info.veremos) return null;
  const accion = info.creemos.replace(/^al\s+/i, '');
  return `Creemos que al ${accion}, lograremos ${info.lograremos}; lo sabremos cuando ${info.veremos}.`;
}

/**
 * Cobertura: qué resultados clave no tienen épicas trabajando en ellos y qué épicas no apoyan ningún objetivo.
 * @returns {{resultadosSinEpica: {objetivo: string, texto: string}[], epicasSinResultado: string[], epicasPorResultado: Object<string, string[]>}}
 */
export function cobertura(proyecto) {
  const epicas = [...new Set(proyecto.historias.map((h) => h.epica).filter(Boolean))];
  const epicasPorResultado = {};
  for (const e of epicas) for (const r of infoEpica(proyecto, e).resultados) (epicasPorResultado[r] ||= []).push(e);
  const resultadosSinEpica = (proyecto.objetivos || []).flatMap((o) => o.resultados.filter((r) => !epicasPorResultado[r.id]).map((r) => ({ objetivo: o.objetivo, texto: r.texto })));
  const idsValidos = new Set((proyecto.objetivos || []).flatMap((o) => o.resultados.map((r) => r.id)));
  const epicasSinResultado = (proyecto.objetivos || []).length ? epicas.filter((e) => !infoEpica(proyecto, e).resultados.some((r) => idsValidos.has(r))) : [];
  return { resultadosSinEpica, epicasSinResultado, epicasPorResultado };
}

/** Texto de los resultados clave vinculados a una épica, para reportes y especificaciones. */
export function resultadosDeEpica(proyecto, epica) {
  const ids = new Set(infoEpica(proyecto, epica).resultados);
  return (proyecto.objetivos || []).flatMap((o) => o.resultados.filter((r) => ids.has(r.id)).map((r) => ({ objetivo: o.objetivo, texto: r.texto })));
}

export function normalizarOkr(objetivos, epicasInfo) {
  const lista = (Array.isArray(objetivos) ? objetivos : []).slice(0, 30)
    .map((o) => ({
      id: txt(o?.id, 60) || nuevoId('o'),
      objetivo: txt(o?.objetivo, 200),
      resultados: (Array.isArray(o?.resultados) ? o.resultados : []).slice(0, 10)
        .map((r) => ({ id: txt(r?.id, 60) || nuevoId('kr'), texto: txt(r?.texto, 200) })).filter((r) => r.texto),
    }))
    .filter((o) => o.objetivo);
  const ids = new Set(lista.flatMap((o) => o.resultados.map((r) => r.id)));
  const info = {};
  for (const [epica, i] of Object.entries(epicasInfo && typeof epicasInfo === 'object' ? epicasInfo : {}).slice(0, 200)) {
    const nombre = txt(epica, 120);
    if (!nombre || !i || typeof i !== 'object') continue;
    info[nombre] = {
      creemos: txt(i.creemos, 300), lograremos: txt(i.lograremos, 300), veremos: txt(i.veremos, 300),
      resultados: (Array.isArray(i.resultados) ? i.resultados : []).filter((r) => ids.has(r)),
      horizonte: ['ahora', 'siguiente', 'despues'].includes(i.horizonte) ? i.horizonte : '',
      resultadoHipotesis: Object.hasOwn(RESULTADOS_HIPOTESIS, i.resultadoHipotesis) ? i.resultadoHipotesis : 'pendiente',
      datoReal: txt(i.datoReal, 300),
    };
  }
  return { objetivos: lista, epicasInfo: info };
}
