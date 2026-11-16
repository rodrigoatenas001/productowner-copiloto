// Mapa del proceso (BPMN liviano): carriles por actor y pasos de cinco tipos.
// Sirve para validar con el cliente el circuito real antes de escribir historias, y para ver
// qué pasos no tienen historias y qué historias no calzan con ningún paso.
// Se exporta a BPMN 2.0 XML con su diagrama, para abrirlo en Camunda Modeler, Bizagi o bpmn.io.
import { nuevoId } from './historias.js';

export const TIPOS_PASO = { inicio: 'Inicio', tarea: 'Tarea', decision: 'Decisión', fin: 'Fin' };

export const PROCESO_VACIO = { carriles: [], pasos: [] };

const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Limpia un proceso venido de un respaldo: ids válidos, enlaces a pasos e historias que existen. */
export function normalizarProceso(datos, idsHistoria = new Set()) {
  const d = datos && typeof datos === 'object' ? datos : {};
  const carriles = (Array.isArray(d.carriles) ? d.carriles : []).slice(0, 12)
    .map((c) => ({ id: texto(c?.id, 60) || nuevoId('ca'), nombre: texto(c?.nombre, 60) || 'Actor' }));
  const idsCarril = new Set(carriles.map((c) => c.id));
  const crudos = (Array.isArray(d.pasos) ? d.pasos : []).slice(0, 80);
  const ids = new Set(crudos.map((p) => texto(p?.id, 60)).filter(Boolean));
  const pasos = crudos.map((p) => ({
    id: texto(p?.id, 60) || nuevoId('pa'),
    tipo: Object.hasOwn(TIPOS_PASO, p?.tipo) ? p.tipo : 'tarea',
    texto: texto(p?.texto, 160),
    carril: idsCarril.has(p?.carril) ? p.carril : (carriles[0]?.id || null),
    siguientes: (Array.isArray(p?.siguientes) ? p.siguientes : [])
      .filter((s) => ids.has(s?.a)).slice(0, 6)
      .map((s) => ({ a: s.a, etiqueta: texto(s.etiqueta, 40) })),
    historiaIds: (Array.isArray(p?.historiaIds) ? p.historiaIds : []).filter((id) => idsHistoria.has(id)).slice(0, 30),
  }));
  return { carriles, pasos };
}

export const procesoDe = (proyecto) => proyecto.proceso || PROCESO_VACIO;

export function agregarCarril(proceso, nombre) {
  const limpio = texto(nombre, 60);
  if (!limpio) return proceso;
  return { ...proceso, carriles: [...proceso.carriles, { id: nuevoId('ca'), nombre: limpio }] };
}

/** Quita un carril; sus pasos pasan al primer carril que quede. */
export function quitarCarril(proceso, id) {
  const carriles = proceso.carriles.filter((c) => c.id !== id);
  return { carriles, pasos: proceso.pasos.map((p) => (p.carril === id ? { ...p, carril: carriles[0]?.id || null } : p)) };
}

/**
 * Agrega un paso al final. Si el último paso es una tarea o un inicio sin salida, se conecta
 * con el nuevo: así un proceso lineal se arma solo, paso a paso.
 */
export function agregarPaso(proceso, { tipo = 'tarea', texto: t = '', carril = null } = {}) {
  const paso = { id: nuevoId('pa'), tipo: Object.hasOwn(TIPOS_PASO, tipo) ? tipo : 'tarea', texto: texto(t, 160), carril: carril || proceso.carriles[0]?.id || null, siguientes: [], historiaIds: [] };
  const ultimo = proceso.pasos[proceso.pasos.length - 1];
  const pasos = proceso.pasos.map((p) => (p === ultimo && (p.tipo === 'tarea' || p.tipo === 'inicio') && !p.siguientes.length
    ? { ...p, siguientes: [{ a: paso.id, etiqueta: '' }] } : p));
  return { ...proceso, pasos: [...pasos, paso] };
}

export function editarPaso(proceso, id, cambios) {
  return { ...proceso, pasos: proceso.pasos.map((p) => (p.id === id ? { ...p, ...cambios } : p)) };
}

/** Elimina un paso y las flechas que llegaban a él. */
export function eliminarPaso(proceso, id) {
  return {
    ...proceso,
    pasos: proceso.pasos.filter((p) => p.id !== id).map((p) => ({ ...p, siguientes: p.siguientes.filter((s) => s.a !== id) })),
  };
}

/** Sube o baja un paso en el orden (el orden define la columna en el diagrama). */
export function moverPaso(proceso, id, delta) {
  const pasos = [...proceso.pasos];
  const i = pasos.findIndex((p) => p.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= pasos.length) return proceso;
  [pasos[i], pasos[j]] = [pasos[j], pasos[i]];
  return { ...proceso, pasos };
}

export function conectar(proceso, de, a, etiqueta = '') {
  if (de === a) return proceso;
  return editarPaso(proceso, de, {
    siguientes: [...(proceso.pasos.find((p) => p.id === de)?.siguientes || []).filter((s) => s.a !== a), { a, etiqueta: texto(etiqueta, 40) }],
  });
}

export function desconectar(proceso, de, a) {
  return editarPaso(proceso, de, { siguientes: (proceso.pasos.find((p) => p.id === de)?.siguientes || []).filter((s) => s.a !== a) });
}

/**
 * Revisa el circuito y su cobertura con el backlog. Devuelve avisos explicables, no errores:
 * el proceso puede estar a medio levantar.
 * @returns {{avisos: {nivel: 'error'|'aviso'|'info', texto: string, pasoId?: string}[], pasosSinHistorias: object[], historiasFuera: object[]}}
 */
export function revisarProceso(proceso, historias = []) {
  const avisos = [];
  const { pasos } = proceso;
  if (!pasos.length) return { avisos, pasosSinHistorias: [], historiasFuera: [] };
  const nombre = (p) => `«${p.texto || TIPOS_PASO[p.tipo]}»`;
  const inicios = pasos.filter((p) => p.tipo === 'inicio');
  if (!inicios.length) avisos.push({ nivel: 'error', texto: 'Falta el inicio: ¿qué dispara el proceso?' });
  if (!pasos.some((p) => p.tipo === 'fin')) avisos.push({ nivel: 'error', texto: 'Falta el fin: ¿cuándo se da por terminado?' });

  const entrantes = new Map(pasos.map((p) => [p.id, 0]));
  for (const p of pasos) for (const s of p.siguientes) entrantes.set(s.a, entrantes.get(s.a) + 1);
  for (const p of pasos) {
    if (!p.texto && p.tipo !== 'inicio' && p.tipo !== 'fin') avisos.push({ nivel: 'aviso', texto: `Hay un paso de tipo ${TIPOS_PASO[p.tipo].toLowerCase()} sin nombre.`, pasoId: p.id });
    if (p.tipo !== 'fin' && !p.siguientes.length) avisos.push({ nivel: 'error', texto: `${nombre(p)} no lleva a ningún paso.`, pasoId: p.id });
    if (p.tipo === 'fin' && p.siguientes.length) avisos.push({ nivel: 'aviso', texto: `${nombre(p)} es un fin pero sigue a otro paso.`, pasoId: p.id });
    if (p.tipo === 'decision') {
      if (p.siguientes.length < 2) avisos.push({ nivel: 'error', texto: `La decisión ${nombre(p)} necesita al menos dos salidas (por ejemplo, sí y no).`, pasoId: p.id });
      else if (p.siguientes.some((s) => !s.etiqueta)) avisos.push({ nivel: 'aviso', texto: `Pon nombre a cada salida de la decisión ${nombre(p)}.`, pasoId: p.id });
    }
    if (p.tipo !== 'inicio' && !entrantes.get(p.id)) avisos.push({ nivel: 'aviso', texto: `Ningún paso lleva a ${nombre(p)}.`, pasoId: p.id });
  }

  // Lo que no se alcanza desde un inicio no forma parte del circuito
  const alcanzados = new Set();
  const cola = inicios.map((p) => p.id);
  while (cola.length) {
    const id = cola.shift();
    if (alcanzados.has(id)) continue;
    alcanzados.add(id);
    for (const s of pasos.find((p) => p.id === id)?.siguientes || []) cola.push(s.a);
  }
  if (inicios.length) {
    for (const p of pasos) if (!alcanzados.has(p.id) && entrantes.get(p.id)) avisos.push({ nivel: 'aviso', texto: `${nombre(p)} no se alcanza desde el inicio.`, pasoId: p.id });
  }

  const pasosSinHistorias = pasos.filter((p) => p.tipo === 'tarea' && !p.historiaIds.length);
  for (const p of pasosSinHistorias) avisos.push({ nivel: 'info', texto: `${nombre(p)} no tiene historias: ¿es manual o falta levantarla?`, pasoId: p.id });
  const enlazadas = new Set(pasos.flatMap((p) => p.historiaIds));
  const historiasFuera = historias.filter((h) => h.tipo === 'historia' && h.prioridad !== 'wont' && !enlazadas.has(h.id));
  if (historiasFuera.length) avisos.push({ nivel: 'info', texto: `${historiasFuera.length} ${historiasFuera.length === 1 ? 'historia no está' : 'historias no están'} en ningún paso: ¿son de soporte (administración, reportes) o falta un paso?` });
  return { avisos, pasosSinHistorias, historiasFuera };
}

// ── Diagrama: posiciones calculadas, sin arrastrar ─────────────────────────────
export const MEDIDAS = { cabecera: 116, columna: 176, carril: 132, tarea: { ancho: 140, alto: 66 }, decision: 60, evento: 40, margen: 16 };

/** Parte un texto en líneas de hasta `max` caracteres (máximo 4 líneas). */
export function lineas(t, max = 19) {
  const salida = [];
  let actual = '';
  for (const palabra of String(t || '').split(/\s+/).filter(Boolean)) {
    if ((actual + ' ' + palabra).trim().length > max && actual) { salida.push(actual); actual = palabra; } else actual = (actual + ' ' + palabra).trim();
  }
  if (actual) salida.push(actual);
  if (salida.length > 4) return [...salida.slice(0, 3), `${salida[3].slice(0, max - 1)}…`];
  return salida;
}

/**
 * Ubica cada paso: su columna es el orden en la lista y su fila, el carril.
 * Las flechas hacia adelante van en ángulo recto; las que vuelven atrás pasan por debajo.
 */
export function disposicion(proceso) {
  const M = MEDIDAS;
  const carriles = proceso.carriles.length ? proceso.carriles : [{ id: null, nombre: 'Proceso' }];
  const fila = new Map(carriles.map((c, i) => [c.id, i]));
  const alto = carriles.length * M.carril;
  const ancho = M.cabecera + Math.max(1, proceso.pasos.length) * M.columna + M.margen;

  const nodos = proceso.pasos.map((p, i) => {
    const f = fila.get(p.carril) ?? 0;
    const cx = M.cabecera + i * M.columna + M.columna / 2;
    const cy = f * M.carril + M.carril / 2;
    const [w, hgt] = p.tipo === 'tarea' ? [M.tarea.ancho, M.tarea.alto] : p.tipo === 'decision' ? [M.decision, M.decision] : [M.evento, M.evento];
    return { id: p.id, tipo: p.tipo, texto: p.texto, cx, cy, x: cx - w / 2, y: cy - hgt / 2, ancho: w, alto: hgt, fila: f, columna: i, lineas: lineas(p.texto), historias: p.historiaIds.length };
  });
  const porId = new Map(nodos.map((n) => [n.id, n]));

  const flechas = [];
  for (const p of proceso.pasos) {
    const o = porId.get(p.id);
    p.siguientes.forEach((s, k) => {
      const d = porId.get(s.a);
      if (!d) return;
      let puntos;
      if (d.columna > o.columna) {
        const sx = o.x + o.ancho;
        const tx = d.x;
        const mx = tx - 18;
        puntos = o.fila === d.fila ? [[sx, o.cy], [tx, d.cy]] : [[sx, o.cy], [mx, o.cy], [mx, d.cy], [tx, d.cy]];
      } else {
        // Vuelve atrás: baja, cruza por el borde inferior del carril y sube al destino
        const fondo = Math.max(o.fila, d.fila) * M.carril + M.carril - 10 - k * 6;
        puntos = [[o.cx, o.y + o.alto], [o.cx, fondo], [d.cx, fondo], [d.cx, d.y + d.alto]];
      }
      flechas.push({ de: p.id, a: s.a, etiqueta: s.etiqueta, puntos });
    });
  }
  return { ancho, alto, carriles: carriles.map((c, i) => ({ ...c, y: i * M.carril, alto: M.carril })), nodos, flechas };
}

// ── Exportación a BPMN 2.0 ─────────────────────────────────────────────────────
const xml = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const idXml = (id) => `id_${String(id).replace(/[^\w.-]/g, '_')}`;
const ETIQUETA_BPMN = { inicio: 'startEvent', tarea: 'task', decision: 'exclusiveGateway', fin: 'endEvent' };

/**
 * BPMN 2.0 XML con carriles, pasos, flujos y su diagrama (BPMNDI), para que las herramientas
 * de modelado lo abran ya dibujado. Las historias enlazadas van como documentación del paso.
 */
export function aBpmn(proceso, nombre = 'Proceso', historias = []) {
  const d = disposicion(proceso);
  const titulos = new Map(historias.map((h) => [h.id, h.titulo]));
  const flujos = proceso.pasos.flatMap((p) => p.siguientes.filter((s) => proceso.pasos.some((x) => x.id === s.a))
    .map((s, k) => ({ id: `flujo_${idXml(p.id)}_${k}`, de: p.id, a: s.a, etiqueta: s.etiqueta })));
  const entra = (id) => flujos.filter((f) => f.a === id).map((f) => `      <bpmn:incoming>${f.id}</bpmn:incoming>`);
  const sale = (id) => flujos.filter((f) => f.de === id).map((f) => `      <bpmn:outgoing>${f.id}</bpmn:outgoing>`);

  const carriles = proceso.carriles.length ? [
    '    <bpmn:laneSet id="carriles">',
    ...proceso.carriles.map((c) => [
      `      <bpmn:lane id="${idXml(c.id)}" name="${xml(c.nombre)}">`,
      ...proceso.pasos.filter((p) => p.carril === c.id).map((p) => `        <bpmn:flowNodeRef>${idXml(p.id)}</bpmn:flowNodeRef>`),
      '      </bpmn:lane>',
    ]).flat(),
    '    </bpmn:laneSet>',
  ] : [];

  const elementos = proceso.pasos.map((p) => {
    const doc = p.historiaIds.map((id) => titulos.get(id)).filter(Boolean);
    return [
      `    <bpmn:${ETIQUETA_BPMN[p.tipo]} id="${idXml(p.id)}" name="${xml(p.texto)}">`,
      doc.length ? `      <bpmn:documentation>Historias: ${xml(doc.join('; '))}</bpmn:documentation>` : null,
      ...entra(p.id), ...sale(p.id),
      `    </bpmn:${ETIQUETA_BPMN[p.tipo]}>`,
    ].filter(Boolean);
  }).flat();

  const secuencias = flujos.map((f) => `    <bpmn:sequenceFlow id="${f.id}" sourceRef="${idXml(f.de)}" targetRef="${idXml(f.a)}"${f.etiqueta ? ` name="${xml(f.etiqueta)}"` : ''} />`);

  const forma = (id, x, y, w, hgt, extra = '') => `      <bpmndi:BPMNShape id="${id}_di" bpmnElement="${id}"${extra}><dc:Bounds x="${Math.round(x)}" y="${Math.round(y)}" width="${Math.round(w)}" height="${Math.round(hgt)}" /></bpmndi:BPMNShape>`;
  const dibujo = [
    forma('participante', 0, 0, d.ancho, d.alto, ' isHorizontal="true"'),
    ...(proceso.carriles.length ? d.carriles.map((c) => forma(idXml(c.id), 30, c.y, d.ancho - 30, c.alto, ' isHorizontal="true"')) : []),
    ...d.nodos.map((n) => forma(idXml(n.id), n.x, n.y, n.ancho, n.alto)),
    ...flujos.map((f) => {
      const flecha = d.flechas.find((x) => x.de === f.de && x.a === f.a);
      return [`      <bpmndi:BPMNEdge id="${f.id}_di" bpmnElement="${f.id}">`, ...flecha.puntos.map(([x, y]) => `        <di:waypoint x="${Math.round(x)}" y="${Math.round(y)}" />`), '      </bpmndi:BPMNEdge>'];
    }).flat(),
  ];

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="definiciones" targetNamespace="https://www.productowner.cl/copiloto" exporter="Copiloto PO">',
    '  <bpmn:collaboration id="colaboracion">',
    `    <bpmn:participant id="participante" name="${xml(nombre)}" processRef="proceso" />`,
    '  </bpmn:collaboration>',
    `  <bpmn:process id="proceso" name="${xml(nombre)}" isExecutable="false">`,
    ...carriles, ...elementos, ...secuencias,
    '  </bpmn:process>',
    '  <bpmndi:BPMNDiagram id="diagrama">',
    '    <bpmndi:BPMNPlane id="plano" bpmnElement="colaboracion">',
    ...dibujo,
    '    </bpmndi:BPMNPlane>',
    '  </bpmndi:BPMNDiagram>',
    '</bpmn:definitions>',
  ].join('\n');
}
