// Lo comercial del PO independiente: alcance, horas y valor, hitos de pago y solicitudes de cambio.
// Todo queda en el navegador; los documentos se copian o descargan (ver documentos.js).
import { nuevoId, notasAHistorias } from './historias.js';
import { PLANTILLAS } from './plantillas.js';

const txt = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const sinRepetidos = (lista) => [...new Set(lista.map((x) => txt(x, 300)).filter(Boolean))];

// ── Alcance ────────────────────────────────────────────────────────────────

export const ALCANCE_VACIO = { incluye: [], noIncluye: [], supuestos: [], cliente: [] };

export function alcanceDe(proyecto) {
  const a = proyecto.alcance || {};
  return { incluye: a.incluye || [], noIncluye: a.noIncluye || [], supuestos: a.supuestos || [], cliente: a.cliente || [] };
}

/** Historias que forman parte del alcance acordado (sin las descartadas ni los cambios no aprobados). */
export function historiasEnAlcance(proyecto) {
  const aprobados = new Set((proyecto.cambios || []).filter((c) => c.estado === 'aprobado').map((c) => c.id));
  return proyecto.historias.filter((h) => h.prioridad !== 'wont' && (!h.cambioId || aprobados.has(h.cambioId)));
}

/** Agrega las historias y el alcance típico de una plantilla, sin duplicar. */
export function aplicarPlantilla(proyecto, clave) {
  const pl = PLANTILLAS[clave];
  if (!pl) throw new Error('Esa plantilla no existe.');
  const a = alcanceDe(proyecto);
  return {
    ...proyecto,
    historias: [...proyecto.historias, ...notasAHistorias(pl.notas, { rolPorDefecto: proyecto.rolPorDefecto })],
    alcance: {
      ...a,
      noIncluye: sinRepetidos([...a.noIncluye, ...pl.noIncluye]),
      supuestos: sinRepetidos([...a.supuestos, ...pl.supuestos]),
      cliente: sinRepetidos([...a.cliente, ...pl.cliente]),
    },
  };
}

// ── Horas y valor ──────────────────────────────────────────────────────────

export const COMERCIAL_INICIAL = { moneda: 'UF', valorHora: null, horasPorPunto: 4, margen: 15, valorUF: null, horasSemana: 20 };

export function comercialDe(proyecto) {
  return { ...COMERCIAL_INICIAL, ...(proyecto.comercial || {}) };
}

/** Horas de una historia: las indicadas a mano o, si no, puntos × horas por punto. */
export function horasDe(historia, comercial) {
  if (Number.isFinite(historia.horas) && historia.horas > 0) return historia.horas;
  return historia.puntos && comercial.horasPorPunto ? historia.puntos * comercial.horasPorPunto : null;
}

const redondear = (n, moneda) => (moneda === 'CLP' ? Math.round(n) : Math.round(n * 100) / 100);

/**
 * Resumen de cotización del alcance: horas, subtotal, margen de imprevistos y total.
 * @returns {{horas: number, sinEstimar: number, subtotal: number|null, margen: number|null, total: number|null, moneda: string, totalCLP: number|null, porEpica: {epica: string, horas: number}[]}}
 */
export function cotizacion(proyecto) {
  const c = comercialDe(proyecto);
  const hs = historiasEnAlcance(proyecto);
  let horas = 0;
  let sinEstimar = 0;
  const porEpica = new Map();
  for (const h of hs) {
    const x = horasDe(h, c);
    if (x === null) { sinEstimar++; continue; }
    horas += x;
    porEpica.set(h.epica || 'Otros', (porEpica.get(h.epica || 'Otros') || 0) + x);
  }
  const subtotal = c.valorHora ? redondear(horas * c.valorHora, c.moneda) : null;
  const margen = subtotal !== null ? redondear(subtotal * (c.margen / 100), c.moneda) : null;
  const total = subtotal !== null ? redondear(subtotal + margen, c.moneda) : null;
  return {
    horas: Math.round(horas * 10) / 10,
    sinEstimar,
    subtotal,
    margen,
    total,
    moneda: c.moneda,
    totalCLP: total !== null && c.moneda === 'UF' && c.valorUF ? Math.round(total * c.valorUF) : null,
    porEpica: [...porEpica].map(([epica, h]) => ({ epica, horas: Math.round(h * 10) / 10 })),
  };
}

/** "12,5 UF" o "$1.250.000". */
export function formatoMonto(valor, moneda) {
  if (valor === null || valor === undefined) return '—';
  return moneda === 'CLP' ? `$${Math.round(valor).toLocaleString('es-CL')}` : `${valor.toLocaleString('es-CL', { maximumFractionDigits: 2 })} UF`;
}

// ── Hitos de pago ──────────────────────────────────────────────────────────

export const REPARTOS = { 2: [50, 50], 3: [30, 40, 30], 4: [25, 25, 25, 25] };

/**
 * Propone hitos: reparte las historias del alcance, en el orden del backlog,
 * en grupos de esfuerzo parecido. El nombre de cada hito es su épica principal.
 */
export function sugerirHitos(proyecto, cantidad = 3) {
  const c = comercialDe(proyecto);
  const hs = historiasEnAlcance(proyecto);
  if (!hs.length) throw new Error('Primero define el alcance: agrega historias.');
  const n = Math.max(1, Math.min(cantidad, hs.length, 4));
  const pesos = hs.map((h) => horasDe(h, c) || 1);
  const totalPeso = pesos.reduce((a, b) => a + b, 0);
  const grupos = Array.from({ length: n }, () => []);
  let acumulado = 0;
  hs.forEach((h, i) => {
    // Se ubica por el punto medio de su esfuerzo: así los grupos quedan más parejos
    const g = Math.min(n - 1, Math.floor(((acumulado + pesos[i] / 2) / totalPeso) * n));
    grupos[g].push(h);
    acumulado += pesos[i];
  });
  const reparto = REPARTOS[n] || [100];
  return grupos.filter((g) => g.length).map((g, i, lista) => {
    const epicas = g.map((h) => h.epica).filter(Boolean);
    const principal = epicas.sort((a, b) => epicas.filter((x) => x === b).length - epicas.filter((x) => x === a).length)[0];
    return {
      id: nuevoId('hi'),
      nombre: `Hito ${i + 1}${principal ? `: ${principal}` : ''}`,
      porcentaje: lista.length === n ? reparto[i] : Math.round(100 / lista.length),
      historiaIds: g.map((h) => h.id),
      fecha: '',
      estado: 'pendiente',
      aceptacion: null,
    };
  });
}

/** Problemas de los hitos: que no sumen 100% o historias del alcance sin hito. */
export function revisarHitos(proyecto) {
  const hitos = proyecto.hitos || [];
  const problemas = [];
  const suma = hitos.reduce((t, x) => t + (x.porcentaje || 0), 0);
  if (hitos.length && suma !== 100) problemas.push(`Los porcentajes suman ${suma}%, no 100%.`);
  const asignadas = new Set(hitos.flatMap((x) => x.historiaIds));
  const sueltas = historiasEnAlcance(proyecto).filter((h) => !asignadas.has(h.id));
  if (hitos.length && sueltas.length) problemas.push(`${sueltas.length} ${sueltas.length === 1 ? 'historia del alcance no está' : 'historias del alcance no están'} en ningún hito.`);
  return problemas;
}

export function montoHito(proyecto, hito) {
  const { total, moneda } = cotizacion(proyecto);
  return total === null ? null : redondear((total * hito.porcentaje) / 100, moneda);
}

/** ¿Está lista para entregar? Todas sus historias terminadas. */
export function hitoListo(proyecto, hito) {
  const hs = proyecto.historias.filter((h) => hito.historiaIds.includes(h.id));
  return hs.length > 0 && hs.every((h) => h.estado === 'done');
}

export function aceptarHito(proyecto, hitoId, { nombre, fecha = new Date() } = {}) {
  const quien = txt(nombre, 120);
  if (!quien) throw new Error('Indica quién acepta el hito por parte del cliente.');
  return {
    ...proyecto,
    hitos: (proyecto.hitos || []).map((x) => (x.id === hitoId ? { ...x, estado: 'aceptado', aceptacion: { nombre: quien, fecha: new Date(fecha).toISOString().slice(0, 10) } } : x)),
  };
}

// ── Solicitudes de cambio ──────────────────────────────────────────────────

export function registrarCambio(proyecto, descripcion, horas) {
  const d = txt(descripcion, 2000);
  if (!d) throw new Error('Describe lo que pidió el cliente.');
  const h = Number(horas);
  const cambio = { id: nuevoId('cr'), fecha: new Date().toISOString().slice(0, 10), descripcion: d, horas: Number.isFinite(h) && h > 0 ? Math.round(h * 10) / 10 : null, estado: 'propuesto' };
  return { ...proyecto, cambios: [...(proyecto.cambios || []), cambio] };
}

/** Impacto de un cambio: valor (con margen) y días de corrimiento según las horas por semana. */
export function impactoCambio(proyecto, cambio) {
  const c = comercialDe(proyecto);
  if (!cambio.horas) return { horas: null, valor: null, dias: null, moneda: c.moneda };
  const valor = c.valorHora ? redondear(cambio.horas * c.valorHora * (1 + c.margen / 100), c.moneda) : null;
  const dias = c.horasSemana ? Math.ceil((cambio.horas / c.horasSemana) * 7) : null;
  return { horas: cambio.horas, valor, dias, moneda: c.moneda };
}

/** Aprobado: el pedido entra al backlog como historias marcadas con su cambio. */
export function aprobarCambio(proyecto, cambioId) {
  const cambio = (proyecto.cambios || []).find((x) => x.id === cambioId);
  if (!cambio) return proyecto;
  const nuevas = notasAHistorias(cambio.descripcion, { rolPorDefecto: proyecto.rolPorDefecto })
    .map((h) => ({ ...h, cambioId, notaOriginal: `Cambio aprobado el ${new Date().toISOString().slice(0, 10)}: ${h.notaOriginal}` }));
  if (nuevas.length === 1 && cambio.horas) nuevas[0].horas = cambio.horas;
  return {
    ...proyecto,
    historias: [...proyecto.historias, ...nuevas],
    cambios: proyecto.cambios.map((x) => (x.id === cambioId ? { ...x, estado: 'aprobado' } : x)),
  };
}

export function rechazarCambio(proyecto, cambioId) {
  return { ...proyecto, cambios: (proyecto.cambios || []).map((x) => (x.id === cambioId ? { ...x, estado: 'rechazado' } : x)) };
}

// ── Respaldo ───────────────────────────────────────────────────────────────

export function normalizarComercial(datos, idsHistorias) {
  const lista = (v, max = 30) => (Array.isArray(v) ? sinRepetidos(v.filter((x) => typeof x === 'string')).slice(0, max) : []);
  const num = (v, min, max) => (Number.isFinite(v) && v >= min && v <= max ? v : null);
  const c = datos.comercial || {};
  const cambios = (Array.isArray(datos.cambios) ? datos.cambios : []).slice(0, 200)
    .filter((x) => x && txt(x.descripcion, 2000))
    .map((x) => ({
      id: txt(x.id, 60) || nuevoId('cr'),
      fecha: /^\d{4}-\d{2}-\d{2}$/.test(x.fecha) ? x.fecha : new Date().toISOString().slice(0, 10),
      descripcion: txt(x.descripcion, 2000),
      horas: num(x.horas, 0.1, 10000),
      estado: ['propuesto', 'aprobado', 'rechazado'].includes(x.estado) ? x.estado : 'propuesto',
    }));
  const hitos = (Array.isArray(datos.hitos) ? datos.hitos : []).slice(0, 12)
    .filter((x) => x && txt(x.nombre, 120))
    .map((x) => ({
      id: txt(x.id, 60) || nuevoId('hi'),
      nombre: txt(x.nombre, 120),
      porcentaje: Number.isInteger(x.porcentaje) && x.porcentaje >= 0 && x.porcentaje <= 100 ? x.porcentaje : 0,
      historiaIds: [...new Set((Array.isArray(x.historiaIds) ? x.historiaIds : []).filter((id) => idsHistorias.has(id)))],
      fecha: /^\d{4}-\d{2}-\d{2}$/.test(x.fecha) ? x.fecha : '',
      estado: ['pendiente', 'entregado', 'aceptado'].includes(x.estado) ? x.estado : 'pendiente',
      aceptacion: x.aceptacion && txt(x.aceptacion.nombre, 120) ? { nombre: txt(x.aceptacion.nombre, 120), fecha: /^\d{4}-\d{2}-\d{2}$/.test(x.aceptacion.fecha) ? x.aceptacion.fecha : '' } : null,
    }));
  return {
    alcance: { incluye: lista(datos.alcance?.incluye), noIncluye: lista(datos.alcance?.noIncluye), supuestos: lista(datos.alcance?.supuestos), cliente: lista(datos.alcance?.cliente) },
    comercial: {
      moneda: c.moneda === 'CLP' ? 'CLP' : 'UF',
      valorHora: num(c.valorHora, 0.001, 100000000),
      horasPorPunto: num(c.horasPorPunto, 0.1, 200) ?? COMERCIAL_INICIAL.horasPorPunto,
      margen: num(c.margen, 0, 100) ?? COMERCIAL_INICIAL.margen,
      valorUF: num(c.valorUF, 1, 1000000),
      horasSemana: num(c.horasSemana, 1, 168) ?? COMERCIAL_INICIAL.horasSemana,
    },
    hitos,
    cambios,
  };
}
