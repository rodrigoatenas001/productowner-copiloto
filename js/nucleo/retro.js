// Retrospectiva: qué funcionó, qué mejorar e ideas; votos para priorizar y acciones con responsable.
import { nuevoId } from './historias.js';
import { fechaISO } from './proyecto.js';

export const COLUMNAS_RETRO = {
  bien: 'Qué funcionó',
  mejorar: 'Qué mejorar',
  ideas: 'Ideas para probar',
};

export function nuevaRetro(proyecto, hoy = new Date()) {
  const ultimoCerrado = [...proyecto.sprints].reverse().find((s) => s.estado === 'cerrado');
  return {
    id: nuevoId('r'),
    titulo: ultimoCerrado ? `Retro de ${ultimoCerrado.nombre}` : `Retro del ${fechaISO(hoy).split('-').reverse().join('-')}`,
    sprintId: ultimoCerrado?.id || null,
    fecha: fechaISO(hoy),
    notas: [],
    acciones: [],
  };
}

export function agregarNota(retro, columna, texto) {
  const limpio = String(texto || '').trim().slice(0, 500);
  if (!limpio || !(columna in COLUMNAS_RETRO)) return retro;
  return { ...retro, notas: [...retro.notas, { id: nuevoId('n'), columna, texto: limpio, votos: 0 }] };
}

export function votar(retro, notaId, delta = 1) {
  return { ...retro, notas: retro.notas.map((n) => (n.id === notaId ? { ...n, votos: Math.max(0, n.votos + delta) } : n)) };
}

export function quitarNota(retro, notaId) {
  return { ...retro, notas: retro.notas.filter((n) => n.id !== notaId) };
}

/** Notas de una columna, las más votadas primero (empates: orden de creación). */
export function notasDe(retro, columna) {
  return retro.notas
    .map((n, i) => ({ ...n, orden: i }))
    .filter((n) => n.columna === columna)
    .sort((a, b) => b.votos - a.votos || a.orden - b.orden);
}

export function agregarAccion(retro, texto, responsable = '') {
  const limpio = String(texto || '').trim().slice(0, 300);
  if (!limpio) return retro;
  return { ...retro, acciones: [...retro.acciones, { id: nuevoId('a'), texto: limpio, responsable: String(responsable).trim().slice(0, 80), hecha: false }] };
}

export function alternarAccion(retro, accionId) {
  return { ...retro, acciones: retro.acciones.map((a) => (a.id === accionId ? { ...a, hecha: !a.hecha } : a)) };
}

/** Acciones sin cumplir de retros anteriores, para revisarlas al empezar la siguiente. */
export function accionesPendientes(retros, excepto = null) {
  return retros
    .filter((r) => r.id !== excepto)
    .flatMap((r) => r.acciones.filter((a) => !a.hecha).map((a) => ({ ...a, retroId: r.id, retroTitulo: r.titulo })));
}

/** Valida retros de un respaldo importado. */
export function normalizarRetros(lista, idsSprint) {
  const txt = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
  return (Array.isArray(lista) ? lista : []).slice(0, 200).map((r) => ({
    id: txt(r.id, 60) || nuevoId('r'),
    titulo: txt(r.titulo, 120) || 'Retrospectiva',
    sprintId: idsSprint.has(r.sprintId) ? r.sprintId : null,
    fecha: /^\d{4}-\d{2}-\d{2}$/.test(r.fecha) ? r.fecha : fechaISO(new Date()),
    notas: (Array.isArray(r.notas) ? r.notas : []).filter((n) => n && n.columna in COLUMNAS_RETRO && txt(n.texto, 500).trim()).slice(0, 300)
      .map((n) => ({ id: txt(n.id, 60) || nuevoId('n'), columna: n.columna, texto: txt(n.texto, 500), votos: Number.isInteger(n.votos) && n.votos > 0 ? Math.min(n.votos, 999) : 0 })),
    acciones: (Array.isArray(r.acciones) ? r.acciones : []).filter((a) => a && txt(a.texto, 300).trim()).slice(0, 100)
      .map((a) => ({ id: txt(a.id, 60) || nuevoId('a'), texto: txt(a.texto, 300), responsable: txt(a.responsable, 80), hecha: a.hecha === true })),
  }));
}
