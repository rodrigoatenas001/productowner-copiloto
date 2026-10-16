// Importar un backlog existente desde CSV (Excel, Jira, Trello exportado a CSV, o el CSV del propio copiloto).
import { aHistoria, nuevoId, resumirTitulo, sugerirCriterios, ESCALA_PUNTOS } from './historias.js';

/**
 * Lee CSV con comillas, saltos de línea dentro de celdas, BOM y separador "," o ";" (Excel en español).
 * @returns {string[][]}
 */
export function leerCsv(texto) {
  const t = String(texto ?? '').replace(/^﻿/, '');
  const primera = t.split(/\r?\n/, 1)[0] || '';
  const separador = (primera.match(/;/g) || []).length > (primera.match(/,/g) || []).length ? ';' : ',';
  const filas = [];
  let fila = [];
  let celda = '';
  let enComillas = false;

  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (enComillas) {
      if (c === '"' && t[i + 1] === '"') { celda += '"'; i++; } else if (c === '"') { enComillas = false; } else { celda += c; }
    } else if (c === '"') {
      enComillas = true;
    } else if (c === separador) {
      fila.push(celda); celda = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      fila.push(celda); celda = '';
      if (fila.some((x) => x.trim())) filas.push(fila);
      fila = [];
    } else {
      celda += c;
    }
  }
  fila.push(celda);
  if (fila.some((x) => x.trim())) filas.push(fila);
  return filas;
}

const sinAcentos = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Nombres de columna reconocidos (Jira en inglés y español, Excel, el CSV del copiloto). */
const COLUMNAS = {
  titulo: ['summary', 'resumen', 'titulo', 'title', 'nombre', 'name', 'tarea'],
  historia: ['historia', 'user story', 'historia de usuario', 'description', 'descripcion', 'detalle'],
  criterios: ['criterios de aceptacion', 'acceptance criteria', 'criterios', 'ac'],
  puntos: ['story points', 'puntos', 'estimacion', 'points', 'story point estimate', 'custom field (story points)'],
  prioridad: ['priority', 'prioridad'],
  epica: ['epic', 'epica', 'epic name', 'epic link', 'labels', 'etiquetas', 'parent summary'],
  estado: ['status', 'estado'],
  tipo: ['issue type', 'tipo de incidencia', 'tipo', 'type'],
  id: ['issue id', 'id de incidencia', 'issue key', 'clave', 'key'],
  padre: ['parent id', 'parent', 'id principal', 'parent key'],
};

export function mapearColumnas(encabezados) {
  const normal = encabezados.map(sinAcentos);
  const mapa = {};
  for (const [campo, nombres] of Object.entries(COLUMNAS)) {
    const i = normal.findIndex((n) => nombres.includes(n));
    if (i >= 0) mapa[campo] = i;
  }
  return mapa;
}

const PRIORIDAD = {
  highest: 'must', blocker: 'must', critical: 'must', imprescindible: 'must', must: 'must', urgente: 'must', 'muy alta': 'must',
  high: 'should', alta: 'should', importante: 'should', should: 'should',
  medium: 'could', media: 'could', deseable: 'could', could: 'could',
  low: 'wont', lowest: 'wont', baja: 'wont', trivial: 'wont', 'esta vez no': 'wont', wont: 'wont',
};
const HECHO = ['done', 'hecho', 'closed', 'cerrado', 'resolved', 'resuelto', 'terminado', 'finalizado', 'completado'];

/** Puntos a la escala del copiloto (redondea hacia arriba al valor más cercano). */
function aEscala(valor) {
  const n = Number(String(valor).replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  return ESCALA_PUNTOS.find((p) => p >= n) ?? ESCALA_PUNTOS[ESCALA_PUNTOS.length - 1];
}

/** Separa criterios: líneas con viñeta, "* ", "- ", o la sección "Criterios de aceptación:" de una descripción. */
function extraerCriterios(texto) {
  return String(texto || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)]|\[[ x]\])\s*/i, '').trim())
    .filter((l) => l && !/^criterios de aceptaci[oó]n:?$/i.test(l) && !/^acceptance criteria:?$/i.test(l));
}

/**
 * Convierte las filas de un CSV en historias del copiloto.
 * Lo terminado se omite (no sirve en un backlog nuevo) y se informa cuántas.
 * @returns {{historias: object[], omitidas: number, sinTitulo: number, columnas: string[]}}
 */
export function importarCsv(texto, { rolPorDefecto = 'usuario' } = {}) {
  const filas = leerCsv(texto);
  if (filas.length < 2) throw new Error('El archivo no tiene filas para importar.');
  const mapa = mapearColumnas(filas[0]);
  if (mapa.titulo === undefined && mapa.historia === undefined) {
    throw new Error('No encontramos una columna de título o historia (por ejemplo "Summary", "Título" o "Historia").');
  }

  const historias = [];
  let omitidas = 0;
  let sinTitulo = 0;
  const celda = (fila, campo) => (mapa[campo] === undefined ? '' : String(fila[mapa[campo]] ?? '').trim());
  const tipoDe = (fila) => sinAcentos(celda(fila, 'tipo'));

  // Las épicas del archivo no se importan como historias: dan nombre a la épica de sus hijas
  const epicasPorId = {};
  for (const fila of filas.slice(1)) {
    if (tipoDe(fila) === 'epic' || tipoDe(fila) === 'epica') epicasPorId[celda(fila, 'id')] = celda(fila, 'titulo');
  }

  for (const fila of filas.slice(1, 2001)) {
    const tipo = tipoDe(fila);
    if (tipo === 'epic' || tipo === 'epica' || tipo.startsWith('sub')) continue;
    if (HECHO.includes(sinAcentos(celda(fila, 'estado')))) { omitidas++; continue; }

    const titulo = celda(fila, 'titulo');
    const descripcion = celda(fila, 'historia');
    if (!titulo && !descripcion) { sinTitulo++; continue; }

    // La descripción puede traer "Como… quiero… para…" seguido de criterios
    const [enunciado, ...resto] = descripcion.split(/\r?\n\s*\r?\n|criterios de aceptaci[oó]n:?/i);
    const base = /^\s*como\s+/i.test(enunciado || '')
      ? aHistoria({ texto: enunciado.trim() }, { rolPorDefecto })
      : aHistoria({ texto: titulo || enunciado }, { rolPorDefecto });

    const criterios = extraerCriterios(celda(fila, 'criterios') || resto.join('\n'));
    const epica = epicasPorId[celda(fila, 'padre')] || celda(fila, 'epica').split(/[,;]/)[0].trim();

    historias.push({
      ...base,
      id: nuevoId('h'),
      titulo: (titulo || resumirTitulo(base.quiero)).slice(0, 200),
      criterios: criterios.length ? criterios.slice(0, 20) : sugerirCriterios(base.quiero),
      epica: epica.slice(0, 120),
      puntos: aEscala(celda(fila, 'puntos')),
      prioridad: PRIORIDAD[sinAcentos(celda(fila, 'prioridad'))] || 'should',
      estado: 'backlog',
      sprintId: null,
      notaOriginal: [titulo, descripcion].filter(Boolean).join('\n').slice(0, 2000),
    });
  }

  const nombres = Object.keys(mapa);
  return { historias, omitidas, sinTitulo, columnas: nombres };
}
