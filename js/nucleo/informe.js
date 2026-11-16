// Exportaciones con formato del proyecto: planillas de Excel (backlog y proyecto completo) y el
// contenido del documento del proyecto, que Word y el PDF comparten como lista de bloques.
import { enunciado, PRIORIDADES, TIPOS } from './historias.js';
import { ESTADOS, resumenSprint, resumenEpicas, puntosDe } from './proyecto.js';
import { alcanceDe, cotizacion, formatoMonto, montoHito, comercialDe } from './comercial.js';
import { wsjf } from './priorizacion.js';
import { procesoDe, TIPOS_PASO, revisarProceso, flujoDeValor, formatoDuracion } from './proceso.js';
import { libroExcel } from './xlsx.js';
import { hipotesis } from './okr.js';

const ESTADO_SPRINT = { planificado: 'Planificado', activo: 'En curso', cerrado: 'Cerrado' };
const ESTADO_HITO = { pendiente: 'Pendiente', entregado: 'Entregado', aceptado: 'Aceptado' };
const ESTADO_CAMBIO = { propuesto: 'Propuesto', aprobado: 'Aprobado', rechazado: 'Rechazado' };

/** Código corto y estable dentro del archivo: H-01, H-02… según el orden del backlog. */
export function codigos(proyecto) {
  const ancho = String(proyecto.historias.length).length < 2 ? 2 : String(proyecto.historias.length).length;
  return new Map(proyecto.historias.map((h, i) => [h.id, `H-${String(i + 1).padStart(ancho, '0')}`]));
}

const fechaLarga = (d) => new Date(d).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
const fechaCorta = (iso) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('es-CL') : '');

function contexto(proyecto) {
  const cod = codigos(proyecto);
  const sprints = Object.fromEntries(proyecto.sprints.map((s) => [s.id, s.nombre]));
  const proceso = procesoDe(proyecto);
  const pasoDe = new Map();
  proceso.pasos.forEach((p, i) => p.historiaIds.forEach((id) => pasoDe.set(id, `${i + 1}. ${p.texto}`)));
  return { cod, sprints, proceso, pasoDe };
}

const estiloEstado = (e) => (e === 'done' ? 'hecho' : e === 'doing' || e === 'review' ? 'curso' : 'centro');

// ── Excel ──────────────────────────────────────────────────────────────────

function hojaBacklog(proyecto, ctx) {
  return {
    nombre: 'Backlog',
    titulo: `Backlog · ${proyecto.nombre}`,
    nota: `Exportado el ${fechaLarga(new Date())} desde Copiloto PO. Orden = prioridad del backlog.`,
    columnas: [
      { titulo: 'ID', ancho: 7 }, { titulo: 'Épica', ancho: 16 }, { titulo: 'Título', ancho: 30 },
      { titulo: 'Como', ancho: 14 }, { titulo: 'Quiero', ancho: 36 }, { titulo: 'Para', ancho: 30 },
      { titulo: 'Criterios de aceptación', ancho: 60 }, { titulo: 'Reglas de negocio', ancho: 44 },
      { titulo: 'Tipo', ancho: 12 }, { titulo: 'Prioridad', ancho: 14 }, { titulo: 'Puntos', ancho: 8 },
      { titulo: 'WSJF', ancho: 8 }, { titulo: 'Estado', ancho: 12 }, { titulo: 'Sprint', ancho: 11 },
      { titulo: 'Paso del proceso', ancho: 28 },
    ],
    filas: proyecto.historias.map((h) => [
      { v: ctx.cod.get(h.id), estilo: 'centro' }, h.epica, h.titulo, h.rol, h.quiero, h.para,
      h.criterios.map((c) => `• ${c}`).join('\n'), (h.reglas || []).map((r) => `• ${r}`).join('\n'),
      { v: TIPOS[h.tipo] || h.tipo, estilo: 'centro' },
      { v: PRIORIDADES[h.prioridad] || h.prioridad, estilo: h.prioridad },
      h.puntos ?? { v: '', estilo: 'centro' }, wsjf(h) ?? '',
      { v: ESTADOS[h.estado] || h.estado, estilo: estiloEstado(h.estado) },
      { v: ctx.sprints[h.sprintId] || '', estilo: 'centro' }, ctx.pasoDe.get(h.id) || '',
    ]),
  };
}

/** Excel del backlog: una hoja lista para filtrar, ordenar e imprimir. */
export function excelBacklog(proyecto) {
  return libroExcel([hojaBacklog(proyecto, contexto(proyecto))], { titulo: `Backlog · ${proyecto.nombre}` });
}

/** Excel del proyecto completo: resumen, backlog, épicas, proceso, sprints, hitos y cambios. */
export function excelProyecto(proyecto) {
  const ctx = contexto(proyecto);
  const c = cotizacion(proyecto);
  const com = comercialDe(proyecto);
  const hechas = proyecto.historias.filter((h) => h.estado === 'done');
  const resumen = [
    ['Proyecto', proyecto.nombre],
    ['Visión', proyecto.vision?.vision || ''],
    ['Objetivo del producto', proyecto.vision?.objetivoProducto || ''],
    ['Historias', proyecto.historias.length],
    ['Historias terminadas', hechas.length],
    ['Puntos estimados', puntosDe(proyecto.historias)],
    ['Puntos terminados', puntosDe(hechas)],
    ['Horas estimadas del alcance', c.horas],
    [`Total cotizado (${com.moneda})`, c.total ?? 'Sin valor hora'],
    ['Sprints', proyecto.sprints.length],
    ['Pasos del proceso', ctx.proceso.pasos.length],
  ];
  const info = proyecto.epicasInfo || {};
  const hojas = [
    { nombre: 'Resumen', titulo: proyecto.nombre, nota: `Proyecto exportado el ${fechaLarga(new Date())} desde Copiloto PO.`, filtro: false,
      columnas: [{ titulo: 'Dato', ancho: 30 }, { titulo: 'Valor', ancho: 80 }], filas: resumen.map(([k, v]) => [{ v: k, estilo: 'total' }, typeof v === 'number' ? v.toLocaleString('es-CL') : v]) },
    hojaBacklog(proyecto, ctx),
    { nombre: 'Épicas', titulo: 'Épicas', columnas: [
      { titulo: 'Épica', ancho: 24 }, { titulo: 'Historias', ancho: 10 }, { titulo: 'Terminadas', ancho: 11 }, { titulo: 'Puntos', ancho: 9 },
      { titulo: 'Puntos hechos', ancho: 10 }, { titulo: 'Avance %', ancho: 10 }, { titulo: 'Hipótesis (creemos… lograremos… veremos…)', ancho: 70 }],
    filas: resumenEpicas(proyecto).map((e) => {
      const x = info[e.epica] || {};
      return [e.epica || 'Sin épica', e.historias, e.hechas, e.puntos, e.puntosHechos, e.avance,
        hipotesis(x) || ''];
    }) },
  ];
  if (ctx.proceso.pasos.length) {
    const actor = Object.fromEntries(ctx.proceso.carriles.map((ca) => [ca.id, ca.nombre]));
    const n = new Map(ctx.proceso.pasos.map((p, i) => [p.id, i + 1]));
    hojas.push({ nombre: 'Proceso', titulo: 'Proceso', nota: 'Pasos en orden; «Va a» indica la salida (y su respuesta, en las decisiones).',
      columnas: [{ titulo: 'N°', ancho: 5 }, { titulo: 'Tipo', ancho: 11 }, { titulo: 'Actor', ancho: 18 }, { titulo: 'Paso', ancho: 40 }, { titulo: 'Trabajo', ancho: 11 }, { titulo: 'Espera antes', ancho: 12 }, { titulo: 'Va a', ancho: 30 }, { titulo: 'Historias', ancho: 50 }],
      filas: ctx.proceso.pasos.map((p, i) => [{ v: i + 1, estilo: 'centro' }, { v: TIPOS_PASO[p.tipo], estilo: 'centro' }, actor[p.carril] || '', p.texto,
        { v: Number.isFinite(p.trabajo) ? formatoDuracion(p.trabajo) : '', estilo: 'centro' }, { v: Number.isFinite(p.espera) ? formatoDuracion(p.espera) : '', estilo: 'centro' },
        p.siguientes.map((s) => `→ ${n.get(s.a)}${s.etiqueta ? ` (${s.etiqueta})` : ''}`).join('\n'),
        p.historiaIds.map((id) => `${ctx.cod.get(id)} ${proyecto.historias.find((h) => h.id === id)?.titulo || ''}`).join('\n')]) });
  }
  if (proyecto.sprints.length) {
    hojas.push({ nombre: 'Sprints', titulo: 'Sprints', columnas: [
      { titulo: 'Sprint', ancho: 12 }, { titulo: 'Inicio', ancho: 11 }, { titulo: 'Fin', ancho: 11 }, { titulo: 'Objetivo', ancho: 50 },
      { titulo: 'Capacidad', ancho: 10 }, { titulo: 'Comprometidos', ancho: 13 }, { titulo: 'Terminados', ancho: 11 }, { titulo: 'Estado', ancho: 12 }],
    filas: proyecto.sprints.map((s) => {
      const r = resumenSprint(s, proyecto.historias);
      return [s.nombre, fechaCorta(s.inicio), fechaCorta(s.fin), s.objetivo, s.capacidad ?? '', r.puntos, r.hechos,
        { v: ESTADO_SPRINT[s.estado], estilo: s.estado === 'cerrado' ? 'hecho' : s.estado === 'activo' ? 'curso' : 'centro' }];
    }) });
  }
  if ((proyecto.hitos || []).length) {
    hojas.push({ nombre: 'Hitos de pago', titulo: 'Hitos de pago', nota: c.total !== null ? `Total cotizado: ${formatoMonto(c.total, c.moneda)}.` : 'Define el valor hora en Cliente › Cotización para ver los montos.',
      columnas: [{ titulo: 'Hito', ancho: 30 }, { titulo: '%', ancho: 7 }, { titulo: `Monto (${c.moneda})`, ancho: 14 }, { titulo: 'Fecha', ancho: 11 }, { titulo: 'Estado', ancho: 12 }, { titulo: 'Aceptado por', ancho: 22 }, { titulo: 'Historias', ancho: 40 }],
      filas: proyecto.hitos.map((x) => [x.nombre, x.porcentaje, montoHito(proyecto, x) ?? '', fechaCorta(x.fecha),
        { v: ESTADO_HITO[x.estado] || x.estado, estilo: x.estado === 'aceptado' ? 'hecho' : x.estado === 'entregado' ? 'curso' : 'centro' },
        x.aceptacion ? `${x.aceptacion.nombre} (${fechaCorta(x.aceptacion.fecha)})` : '',
        (x.historiaIds || []).map((id) => ctx.cod.get(id)).filter(Boolean).join(', ')]) });
  }
  if ((proyecto.cambios || []).length) {
    hojas.push({ nombre: 'Cambios', titulo: 'Solicitudes de cambio', columnas: [{ titulo: 'Fecha', ancho: 11 }, { titulo: 'Descripción', ancho: 60 }, { titulo: 'Horas', ancho: 8 }, { titulo: 'Estado', ancho: 12 }],
      filas: proyecto.cambios.map((x) => [fechaCorta(x.fecha), x.descripcion, x.horas ?? '', { v: ESTADO_CAMBIO[x.estado] || x.estado, estilo: x.estado === 'aprobado' ? 'hecho' : 'centro' }]) });
  }
  return libroExcel(hojas, { titulo: proyecto.nombre });
}

// ── Documento (Word y PDF) ─────────────────────────────────────────────────

/**
 * Contenido del documento del proyecto como bloques simples, para que Word y el PDF digan lo mismo.
 * Tipos: titulo, subtitulo, h1, h2, h3, p, cita, lista, check, datos (pares clave/valor), tabla y salto (de página).
 */
export function documentoProyecto(proyecto, hoy = new Date()) {
  const ctx = contexto(proyecto);
  const b = [];
  const hechas = proyecto.historias.filter((h) => h.estado === 'done');
  const avance = puntosDe(proyecto.historias) ? Math.round((puntosDe(hechas) / puntosDe(proyecto.historias)) * 100) : 0;
  let n = 0;
  const seccion = (texto, { nuevaPagina = false } = {}) => {
    // La primera sección siempre empieza después de la portada
    if (nuevaPagina || n === 0) b.push({ t: 'salto' });
    n += 1;
    b.push({ t: 'h1', texto: `${n}. ${texto}` });
  };
  let tras = false; // la sección que sigue al backlog empieza en página nueva

  b.push({ t: 'titulo', texto: proyecto.nombre });
  b.push({ t: 'subtitulo', texto: `Documento del proyecto · ${fechaLarga(hoy)}` });
  b.push({ t: 'datos', pares: [
    ['Visión', proyecto.vision?.vision || '—'],
    ['Objetivo del producto', proyecto.vision?.objetivoProducto || '—'],
    ['Historias', `${proyecto.historias.length} (${hechas.length} terminadas)`],
    ['Avance', `${avance}% de los puntos estimados`],
  ] });

  const a = alcanceDe(proyecto);
  if (a.incluye.length || a.noIncluye.length || a.supuestos.length || a.cliente.length) {
    seccion('Alcance');
    for (const [titulo, lista] of [['Incluye', a.incluye], ['No incluye', a.noIncluye], ['Supuestos', a.supuestos], ['Lo que aporta el cliente', a.cliente]]) {
      if (lista.length) b.push({ t: 'h2', texto: titulo }, { t: 'lista', items: lista });
    }
  }

  if (ctx.proceso.pasos.length) {
    seccion('Proceso');
    b.push({ t: 'p', texto: 'El circuito acordado con el cliente, paso a paso. Cada tarea indica las historias que la cubren.' });
    const actor = Object.fromEntries(ctx.proceso.carriles.map((ca) => [ca.id, ca.nombre]));
    const num = new Map(ctx.proceso.pasos.map((p, i) => [p.id, i + 1]));
    b.push({ t: 'tabla', anchos: [6, 13, 17, 30, 14, 20], columnas: ['N°', 'Tipo', 'Actor', 'Paso', 'Va a', 'Historias'],
      filas: ctx.proceso.pasos.map((p, i) => [String(i + 1), TIPOS_PASO[p.tipo], actor[p.carril] || '', p.texto,
        p.siguientes.map((s) => `${num.get(s.a)}${s.etiqueta ? ` (${s.etiqueta})` : ''}`).join(', '),
        p.historiaIds.map((id) => ctx.cod.get(id)).join(', ')]) });
    const vsm = flujoDeValor(ctx.proceso);
    if (vsm.medidos) {
      const cuello = ctx.proceso.pasos.find((p) => p.id === vsm.cuello);
      b.push({ t: 'h2', texto: 'Flujo de valor' }, { t: 'datos', pares: [
        ['Tiempo total del circuito', formatoDuracion(vsm.total)],
        ['Trabajo', formatoDuracion(vsm.trabajo)],
        ['Espera', formatoDuracion(vsm.espera)],
        ['Eficiencia del flujo', `${vsm.eficiencia}% del tiempo se trabaja; el resto se espera`],
        ['Cuello de botella', cuello ? `${cuello.texto} (${formatoDuracion(cuello.espera || 0)} de espera)` : '—'],
      ] });
      if (vsm.faltan) b.push({ t: 'p', nota: true, texto: `${vsm.faltan} ${vsm.faltan === 1 ? 'tarea no tiene' : 'tareas no tienen'} tiempos anotados y no suman.` });
    }
    const { historiasFuera } = revisarProceso(ctx.proceso, proyecto.historias);
    if (historiasFuera.length) b.push({ t: 'p', nota: true, texto: `Historias de soporte, fuera del circuito: ${historiasFuera.map((h) => `${ctx.cod.get(h.id)} ${h.titulo}`).join('; ')}.` });
  }

  seccion('Backlog', { nuevaPagina: true });
  tras = true;
  b.push({ t: 'p', texto: 'Historias de usuario por épica, en orden de prioridad, con sus criterios de aceptación y reglas de negocio.' });
  const porEpica = new Map();
  for (const h of proyecto.historias) {
    const k = h.epica || 'Sin épica';
    if (!porEpica.has(k)) porEpica.set(k, []);
    porEpica.get(k).push(h);
  }
  for (const [epica, hs] of porEpica) {
    b.push({ t: 'h2', texto: epica });
    const x = proyecto.epicasInfo?.[epica];
    const frase = x ? hipotesis(x) : null;
    if (frase) b.push({ t: 'p', nota: true, texto: `Hipótesis: ${frase}` });
    for (const h of hs) {
      b.push({ t: 'h3', texto: `${ctx.cod.get(h.id)} · ${h.titulo}` });
      b.push({ t: 'cita', texto: enunciado(h) });
      b.push({ t: 'p', nota: true, texto: [PRIORIDADES[h.prioridad], h.puntos ? `${h.puntos} puntos` : 'sin estimar', ESTADOS[h.estado], ctx.sprints[h.sprintId], TIPOS[h.tipo] !== TIPOS.historia ? TIPOS[h.tipo] : null].filter(Boolean).join(' · ') });
      if (h.criterios.length) b.push({ t: 'p', fuerte: true, texto: 'Criterios de aceptación' }, { t: 'check', items: h.criterios });
      if (h.reglas?.length) b.push({ t: 'p', fuerte: true, texto: 'Reglas de negocio' }, { t: 'lista', items: h.reglas });
    }
  }

  const c = cotizacion(proyecto);
  if (c.total !== null || (proyecto.hitos || []).length) {
    seccion('Cotización e hitos de pago', { nuevaPagina: tras });
    tras = false;
    if (c.total !== null) {
      b.push({ t: 'datos', pares: [
        ['Horas estimadas', `${c.horas.toLocaleString('es-CL')} h${c.sinEstimar ? ` (${c.sinEstimar} historias sin estimar)` : ''}`],
        ['Subtotal', formatoMonto(c.subtotal, c.moneda)],
        ['Imprevistos', formatoMonto(c.margen, c.moneda)],
        ['Total', `${formatoMonto(c.total, c.moneda)}${c.totalCLP ? ` (≈ ${formatoMonto(c.totalCLP, 'CLP')})` : ''}`],
      ] });
    }
    if ((proyecto.hitos || []).length) {
      b.push({ t: 'tabla', anchos: [34, 8, 16, 14, 28], columnas: ['Hito', '%', 'Monto', 'Fecha', 'Estado'],
        filas: proyecto.hitos.map((x) => [x.nombre, `${x.porcentaje}%`, formatoMonto(montoHito(proyecto, x), c.moneda), fechaCorta(x.fecha),
          x.aceptacion ? `Aceptado por ${x.aceptacion.nombre}` : ESTADO_HITO[x.estado] || x.estado]) });
    }
  }

  if (proyecto.sprints.length) {
    seccion('Sprints', { nuevaPagina: tras });
    tras = false;
    b.push({ t: 'tabla', anchos: [14, 26, 36, 12, 12], columnas: ['Sprint', 'Fechas', 'Objetivo', 'Puntos', 'Estado'],
      filas: proyecto.sprints.map((s) => {
        const r = resumenSprint(s, proyecto.historias);
        return [s.nombre, `${fechaCorta(s.inicio)} – ${fechaCorta(s.fin)}`, s.objetivo || '—', `${r.hechos} de ${r.puntos}`, ESTADO_SPRINT[s.estado]];
      }) });
  }

  if ((proyecto.cambios || []).length) {
    seccion('Solicitudes de cambio', { nuevaPagina: tras });
    tras = false;
    b.push({ t: 'tabla', anchos: [16, 56, 12, 16], columnas: ['Fecha', 'Descripción', 'Horas', 'Estado'],
      filas: proyecto.cambios.map((x) => [fechaCorta(x.fecha), x.descripcion, x.horas ? String(x.horas) : '', ESTADO_CAMBIO[x.estado] || x.estado]) });
  }

  const acciones = (proyecto.retros || []).flatMap((r) => (r.acciones || []).map((x) => `${x.texto}${x.responsable ? ` (${x.responsable})` : ''}${x.hecha ? ' ✓' : ''}`));
  if (acciones.length) {
    seccion('Mejoras acordadas en las retrospectivas', { nuevaPagina: tras });
    b.push({ t: 'lista', items: acciones });
  }
  return b;
}
