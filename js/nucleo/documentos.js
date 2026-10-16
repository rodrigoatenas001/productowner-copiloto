// Documentos para el cliente, en lenguaje de negocio: propuesta de alcance y cotización,
// acta de aceptación de un hito y respuesta a una solicitud de cambio.
// Son borradores para revisar y adaptar; no reemplazan un contrato ni asesoría legal.
import {
  alcanceDe, historiasEnAlcance, comercialDe, cotizacion, formatoMonto, montoHito, horasDe, impactoCambio,
} from './comercial.js';
import { visionDe } from './roadmap.js';

const fecha = (iso) => String(iso || '').slice(0, 10).split('-').reverse().join('-');
const hoyISO = () => new Date().toISOString().slice(0, 10);
const lista = (items, vacio) => (items.length ? items.map((x) => `- ${x}`) : [vacio]);

/** Propuesta de alcance y cotización, lista para enviar al cliente. */
export function propuestaAlcance(proyecto, { validezDias = 15, hoy = hoyISO() } = {}) {
  const a = alcanceDe(proyecto);
  const c = comercialDe(proyecto);
  const cot = cotizacion(proyecto);
  const v = visionDe(proyecto);
  const hs = historiasEnAlcance(proyecto);
  const porEpica = new Map();
  for (const h of hs) {
    const clave = h.epica || 'Otros';
    if (!porEpica.has(clave)) porEpica.set(clave, []);
    porEpica.get(clave).push(h);
  }
  const hitos = proyecto.hitos || [];

  return [
    `# Propuesta: ${proyecto.nombre}`,
    '',
    `_${fecha(hoy)} · válida por ${validezDias} días_`,
    '',
    ...(v.vision || v.objetivoProducto ? ['## Objetivo', '', ...(v.vision ? [v.vision, ''] : []), ...(v.objetivoProducto ? [`**Meta:** ${v.objetivoProducto}`, ''] : [])] : []),
    '## Qué incluye',
    '',
    ...(hs.length ? [...porEpica].flatMap(([epica, lista_]) => [`**${epica}**`, '', ...lista_.map((h) => `- ${h.titulo}${h.para ? `, para ${h.para}` : ''}.`), '']) : ['_Por definir._', '']),
    ...a.incluye.map((x) => `- ${x}`),
    ...(a.incluye.length ? [''] : []),
    '## Qué NO incluye',
    '',
    ...lista(a.noIncluye, '- _Todo lo que no esté en "Qué incluye"._'),
    '',
    'Cualquier necesidad fuera de este alcance se evalúa como una solicitud de cambio, con su propio costo y plazo.',
    '',
    '## Supuestos',
    '',
    ...lista(a.supuestos, '- _Sin supuestos especiales._'),
    '',
    '## Lo que necesitamos de ti',
    '',
    ...lista(a.cliente, '- _Nada especial._'),
    '',
    '## Inversión',
    '',
    ...(cot.total !== null ? [
      `| | |`,
      `|---|---|`,
      `| Horas estimadas | ${cot.horas.toLocaleString('es-CL')} h |`,
      `| Valor hora | ${formatoMonto(c.valorHora, c.moneda)} |`,
      `| Imprevistos (${c.margen}%) | ${formatoMonto(cot.margen, c.moneda)} |`,
      `| **Total** | **${formatoMonto(cot.total, c.moneda)}**${cot.totalCLP ? ` (≈ $${cot.totalCLP.toLocaleString('es-CL')} con UF a $${c.valorUF.toLocaleString('es-CL')})` : ''} |`,
      '',
      cot.sinEstimar ? `_${cot.sinEstimar} ${cot.sinEstimar === 1 ? 'ítem aún no tiene' : 'ítems aún no tienen'} estimación y no ${cot.sinEstimar === 1 ? 'está incluido' : 'están incluidos'} en el total._` : null,
      'Valores antes de impuestos y retenciones (boleta de honorarios o factura, según corresponda).',
    ].filter((l) => l !== null) : ['_Por cotizar: falta indicar el valor hora o estimar los ítems._']),
    '',
    ...(hitos.length ? [
      '## Forma de pago por hitos',
      '',
      '| Hito | Entrega | % | Monto |',
      '|---|---|---:|---:|',
      ...hitos.map((x) => `| ${x.nombre} | ${x.fecha ? fecha(x.fecha) : 'por acordar'} | ${x.porcentaje}% | ${formatoMonto(montoHito(proyecto, x), c.moneda)} |`),
      '',
      'Cada hito se paga contra la aceptación de sus entregables, según sus criterios de aceptación.',
      '',
    ] : []),
    '---',
    '',
    '_Borrador generado con Copiloto PO. Revísalo antes de enviarlo; no reemplaza un contrato ni asesoría legal._',
  ].join('\n');
}

/** Acta de aceptación de un hito: entregables con sus criterios como lista de verificación y firmas. */
export function actaAceptacion(proyecto, hitoId) {
  const hito = (proyecto.hitos || []).find((x) => x.id === hitoId);
  if (!hito) throw new Error('No existe ese hito.');
  const c = comercialDe(proyecto);
  const hs = proyecto.historias.filter((h) => hito.historiaIds.includes(h.id));
  const monto = montoHito(proyecto, hito);
  return [
    `# Acta de aceptación · ${hito.nombre}`,
    '',
    `**Proyecto:** ${proyecto.nombre}`,
    '',
    `**Fecha:** ${hito.aceptacion?.fecha ? fecha(hito.aceptacion.fecha) : '____ / ____ / ________'}`,
    '',
    '## Entregables',
    '',
    ...hs.flatMap((h, i) => [
      `### ${i + 1}. ${h.titulo}`,
      '',
      ...(h.criterios.length ? h.criterios.map((cr) => `- [ ] ${cr}`) : ['- [ ] Funciona según lo acordado']),
      '',
    ]),
    '## Observaciones',
    '',
    '_______________________________________________',
    '',
    '_______________________________________________',
    '',
    '## Conformidad',
    '',
    `El cliente declara haber recibido y revisado los entregables de este hito y los acepta${monto !== null ? `, liberando el pago de **${formatoMonto(monto, c.moneda)}** (${hito.porcentaje}% del total)` : ''}.`,
    '',
    `| Por el cliente | Por el proveedor |`,
    `|---|---|`,
    `| ${hito.aceptacion?.nombre || 'Nombre: ____________________'} | Nombre: ____________________ |`,
    `| Firma: ____________________ | Firma: ____________________ |`,
    '',
    '_Si algún criterio no se cumple, anótalo en Observaciones: se corrige sin costo antes de aceptar._',
  ].join('\n');
}

/** Mensaje listo para responder una solicitud de cambio, con su impacto en horas, valor y plazo. */
export function respuestaCambio(proyecto, cambioId) {
  const cambio = (proyecto.cambios || []).find((x) => x.id === cambioId);
  if (!cambio) throw new Error('No existe ese cambio.');
  const im = impactoCambio(proyecto, cambio);
  const lineas = [
    'Hola,',
    '',
    `Gracias por la solicitud: "${cambio.descripcion.replace(/\s+/g, ' ').slice(0, 300)}".`,
    '',
    'Este punto no estaba en el alcance acordado, así que te comparto su impacto antes de incorporarlo:',
    '',
    `- Esfuerzo estimado: ${im.horas ? `${im.horas.toLocaleString('es-CL')} horas` : 'por estimar'}`,
    `- Valor adicional: ${im.valor !== null ? formatoMonto(im.valor, im.moneda) : 'por cotizar'}`,
    `- Efecto en la entrega: ${im.dias ? `se mueve unos ${im.dias} días` : 'por confirmar'}`,
    '',
    'Si te parece, lo agregamos con tu confirmación por escrito. Otra opción es dejarlo para una siguiente etapa o reemplazar algo de menor prioridad que tenga un esfuerzo similar.',
    '',
    'Quedo atento a tu respuesta.',
  ];
  return lineas.join('\n');
}

/** Horas de cada historia, para mostrarlas junto a la cotización. */
export function detalleHoras(proyecto) {
  const c = comercialDe(proyecto);
  return historiasEnAlcance(proyecto).map((h) => ({ id: h.id, titulo: h.titulo, horas: horasDe(h, c), manual: Number.isFinite(h.horas) && h.horas > 0 }));
}
