// Modelo de proyecto, sprints y métricas. Puro y serializable a JSON.
import { nuevoId, ESCALA_PUNTOS, PRIORIDADES } from './historias.js';
import { normalizarRetros } from './retro.js';
import { DEFINICIONES_INICIALES, normalizarDefiniciones, normalizarChecks } from './definiciones.js';
import { normalizarPriorizacion } from './priorizacion.js';
import { normalizarOkr } from './okr.js';
import { repoGithub } from './issues.js';

export const VERSION_DATOS = 1;
export const ESTADOS = { backlog: 'Backlog', todo: 'Por hacer', doing: 'En curso', done: 'Hecho' };

export function nuevoProyecto(nombre = 'Mi proyecto') {
  const ahora = new Date().toISOString();
  return {
    version: VERSION_DATOS,
    id: nuevoId('p'),
    nombre: String(nombre).trim() || 'Mi proyecto',
    rolPorDefecto: 'usuario',
    notas: '',
    historias: [],
    sprints: [],
    retros: [],
    definiciones: structuredClone(DEFINICIONES_INICIALES),
    objetivos: [],
    epicasInfo: {},
    vision: { vision: '', objetivoProducto: '' },
    respaldado: null,
    creado: ahora,
    actualizado: ahora,
  };
}

/**
 * ¿Conviene recordar un respaldo? Los datos viven solo en el navegador.
 * Sí cuando hay trabajo sin respaldar: 5+ historias y nunca respaldado,
 * o cambios posteriores a un respaldo de hace más de 14 días.
 */
export function necesitaRespaldo(p, hoy = new Date()) {
  if (p.historias.length < 5) return false;
  if (!p.respaldado) return true;
  const dias = (new Date(hoy) - new Date(p.respaldado)) / 86400000;
  return dias > 14 && new Date(p.actualizado) > new Date(p.respaldado);
}

export function nuevoSprint(proyecto, { capacidad = null, objetivo = '', dias = 14, inicio = null } = {}) {
  const numero = proyecto.sprints.length + 1;
  const desde = inicio ? new Date(inicio) : new Date();
  const hasta = new Date(desde.getTime() + (dias - 1) * 86400000);
  return {
    id: nuevoId('s'),
    nombre: `Sprint ${numero}`,
    objetivo,
    inicio: fechaISO(desde),
    fin: fechaISO(hasta),
    capacidad: capacidad ?? (velocidad(proyecto) || null),
    estado: 'planificado',
  };
}

export function fechaISO(d) {
  return new Date(d).toISOString().slice(0, 10);
}

const texto = (v, max = 2000) => (typeof v === 'string' ? v.slice(0, max) : '');

/**
 * Valida y normaliza un respaldo importado. Nunca confía en el archivo:
 * descarta campos desconocidos y corrige tipos.
 * @throws {Error} si el archivo no parece un respaldo del copiloto
 */
export function normalizarProyecto(datos) {
  if (!datos || typeof datos !== 'object' || !Array.isArray(datos.historias)) {
    throw new Error('El archivo no es un respaldo del copiloto (falta la lista de historias).');
  }
  if (datos.version && datos.version > VERSION_DATOS) {
    throw new Error('Este respaldo viene de una versión más nueva del copiloto. Actualiza la aplicación e inténtalo de nuevo.');
  }

  const sprints = (Array.isArray(datos.sprints) ? datos.sprints : []).map((s) => ({
    id: texto(s.id, 60) || nuevoId('s'),
    nombre: texto(s.nombre, 80) || 'Sprint',
    objetivo: texto(s.objetivo, 500),
    inicio: /^\d{4}-\d{2}-\d{2}$/.test(s.inicio) ? s.inicio : fechaISO(new Date()),
    fin: /^\d{4}-\d{2}-\d{2}$/.test(s.fin) ? s.fin : fechaISO(new Date()),
    capacidad: Number.isFinite(s.capacidad) && s.capacidad >= 0 ? s.capacidad : null,
    estado: ['planificado', 'activo', 'cerrado'].includes(s.estado) ? s.estado : 'planificado',
  }));
  const idsSprint = new Set(sprints.map((s) => s.id));

  const historias = datos.historias.map((h) => ({
    id: texto(h.id, 60) || nuevoId('h'),
    titulo: texto(h.titulo, 200),
    rol: texto(h.rol, 120) || 'usuario',
    quiero: texto(h.quiero, 1000),
    para: texto(h.para, 1000),
    criterios: (Array.isArray(h.criterios) ? h.criterios : []).map((c) => texto(c, 1000)).filter(Boolean).slice(0, 20),
    epica: texto(h.epica, 120),
    puntos: ESCALA_PUNTOS.includes(h.puntos) ? h.puntos : null,
    prioridad: h.prioridad in PRIORIDADES ? h.prioridad : 'should',
    estado: h.estado in ESTADOS ? h.estado : 'backlog',
    sprintId: idsSprint.has(h.sprintId) ? h.sprintId : null,
    notaOriginal: texto(h.notaOriginal, 2000),
    creada: texto(h.creada, 40) || new Date().toISOString(),
    terminada: texto(h.terminada, 40) || null,
    checks: normalizarChecks(h.checks),
    priorizacion: normalizarPriorizacion(h.priorizacion),
  }));

  return {
    version: VERSION_DATOS,
    id: texto(datos.id, 60) || nuevoId('p'),
    nombre: texto(datos.nombre, 120) || 'Proyecto importado',
    rolPorDefecto: texto(datos.rolPorDefecto, 120) || 'usuario',
    github: repoGithub(datos.github) || '',
    notas: texto(datos.notas, 100000),
    historias,
    sprints,
    retros: normalizarRetros(datos.retros, idsSprint),
    definiciones: normalizarDefiniciones(datos.definiciones),
    ...normalizarOkr(datos.objetivos, datos.epicasInfo),
    vision: { vision: texto(datos.vision?.vision, 600), objetivoProducto: texto(datos.vision?.objetivoProducto, 300) },
    respaldado: texto(datos.respaldado, 40) || null,
    creado: texto(datos.creado, 40) || new Date().toISOString(),
    actualizado: new Date().toISOString(),
  };
}

/** Mueve una historia dentro del backlog (orden = prioridad). */
export function mover(historias, id, destino) {
  const lista = [...historias];
  const desde = lista.findIndex((h) => h.id === id);
  if (desde < 0) return lista;
  const hasta = Math.max(0, Math.min(lista.length - 1, destino));
  const [h] = lista.splice(desde, 1);
  lista.splice(hasta, 0, h);
  return lista;
}

/** Cambia el estado y registra cuándo se terminó (para el burndown). */
export function cambiarEstado(h, estado, cuando = new Date()) {
  return {
    ...h,
    estado,
    terminada: estado === 'done' ? (h.terminada || new Date(cuando).toISOString()) : null,
  };
}

export const puntosDe = (hs) => hs.reduce((t, h) => t + (h.puntos || 0), 0);

/** Promedio de puntos terminados en los últimos 3 sprints cerrados. */
export function velocidad(proyecto) {
  const cerrados = proyecto.sprints.filter((s) => s.estado === 'cerrado').slice(-3);
  if (!cerrados.length) return 0;
  const total = cerrados.reduce(
    (t, s) => t + puntosDe(proyecto.historias.filter((h) => h.sprintId === s.id && h.estado === 'done')),
    0,
  );
  return Math.round(total / cerrados.length);
}

/**
 * Propone qué historias del backlog caben en un sprint, respetando el orden de prioridad.
 * Salta las que no caben y sigue buscando más pequeñas; ignora las sin estimar.
 */
export function sugerirSprint(proyecto, capacidad) {
  const elegidas = [];
  let usado = 0;
  for (const h of proyecto.historias) {
    if (h.estado !== 'backlog' || h.sprintId || h.prioridad === 'wont' || !h.puntos) continue;
    if (usado + h.puntos <= capacidad) {
      elegidas.push(h.id);
      usado += h.puntos;
    }
  }
  return { ids: elegidas, puntos: usado };
}

/**
 * Burndown del sprint: puntos pendientes al final de cada día y la línea ideal.
 * @returns {{dia: string, pendiente: number|null, ideal: number}[]}
 */
export function burndown(sprint, historias, hoy = new Date()) {
  const delSprint = historias.filter((h) => h.sprintId === sprint.id);
  const total = puntosDe(delSprint);
  const inicio = new Date(sprint.inicio + 'T00:00:00');
  const fin = new Date(sprint.fin + 'T00:00:00');
  const dias = Math.max(1, Math.round((fin - inicio) / 86400000) + 1);
  const limite = fechaISO(hoy);
  const puntos = [];

  for (let i = 0; i < dias; i++) {
    const dia = fechaISO(new Date(inicio.getTime() + i * 86400000));
    const hecho = puntosDe(delSprint.filter((h) => h.terminada && h.terminada.slice(0, 10) <= dia));
    puntos.push({
      dia,
      pendiente: dia <= limite ? total - hecho : null,
      ideal: Math.round((total * (dias - 1 - i)) / Math.max(1, dias - 1) * 10) / 10,
    });
  }
  return puntos;
}

/** Resumen para la cabecera del sprint. */
export function resumenSprint(sprint, historias) {
  const hs = historias.filter((h) => h.sprintId === sprint.id);
  const hechos = hs.filter((h) => h.estado === 'done');
  return {
    historias: hs.length,
    puntos: puntosDe(hs),
    hechos: puntosDe(hechos),
    sinEstimar: hs.filter((h) => !h.puntos).length,
    sobrecarga: sprint.capacidad ? puntosDe(hs) > sprint.capacidad : false,
  };
}

/** Cierra el sprint: lo no terminado vuelve al backlog, arriba de todo y en su orden. */
export function cerrarSprint(proyecto, sprintId) {
  const pendientes = [];
  const resto = [];
  for (const h of proyecto.historias) {
    if (h.sprintId === sprintId && h.estado !== 'done') {
      pendientes.push({ ...h, sprintId: null, estado: 'backlog' });
    } else {
      resto.push(h);
    }
  }
  return {
    ...proyecto,
    historias: [...pendientes, ...resto],
    sprints: proyecto.sprints.map((s) => (s.id === sprintId ? { ...s, estado: 'cerrado' } : s)),
  };
}

/**
 * Avance por épica, en el orden en que aparecen en el backlog (su prioridad).
 * El avance se mide en puntos; si nada está estimado, en historias.
 */
export function resumenEpicas(proyecto) {
  const mapa = new Map();
  for (const h of proyecto.historias) {
    const clave = h.epica || '';
    if (!mapa.has(clave)) mapa.set(clave, { epica: clave, historias: 0, hechas: 0, puntos: 0, puntosHechos: 0, sinEstimar: 0 });
    const e = mapa.get(clave);
    e.historias += 1;
    e.puntos += h.puntos || 0;
    if (!h.puntos) e.sinEstimar += 1;
    if (h.estado === 'done') { e.hechas += 1; e.puntosHechos += h.puntos || 0; }
  }
  return [...mapa.values()].map((e) => ({
    ...e,
    avance: e.puntos ? Math.round((e.puntosHechos / e.puntos) * 100) : (e.historias ? Math.round((e.hechas / e.historias) * 100) : 0),
  }));
}

/** Filas del mapa de historias: la prioridad funciona como versión. */
export const VERSIONES = {
  must: 'Versión 1 · imprescindible',
  should: 'Versión 2 · importante',
  could: 'Más adelante · deseable',
  wont: 'Esta vez no',
};

/**
 * Mapa de historias (story mapping): columnas = épicas en orden de aparición, filas = versiones.
 * @returns {{epicas: string[], filas: {prioridad: string, nombre: string, celdas: Object<string, object[]>, puntos: number}[]}}
 */
export function mapaHistorias(proyecto) {
  const epicas = [...new Set(proyecto.historias.map((h) => h.epica || ''))];
  const filas = Object.entries(VERSIONES).map(([prioridad, nombre]) => {
    const celdas = Object.fromEntries(epicas.map((e) => [e, []]));
    for (const h of proyecto.historias) if (h.prioridad === prioridad) celdas[h.epica || ''].push(h);
    return { prioridad, nombre, celdas, puntos: puntosDe(proyecto.historias.filter((h) => h.prioridad === prioridad && h.estado !== 'done')) };
  });
  return { epicas, filas };
}

/** Mueve una historia a otra celda del mapa. */
export function moverEnMapa(historias, id, epica, prioridad) {
  return historias.map((h) => (h.id === id ? { ...h, epica, prioridad } : h));
}
