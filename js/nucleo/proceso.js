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
    trabajo: minutos(p?.trabajo),
    espera: minutos(p?.espera),
    // Puntos de dolor del paso: los de una plantilla parten sin confirmar hasta verlos en terreno
    dolores: (Array.isArray(p?.dolores) ? p.dolores : []).slice(0, 8)
      .map((d) => ({ texto: texto(d?.texto, 200), confirmado: d?.confirmado === true })).filter((d) => d.texto),
    // Para qué sirve el paso (el «para» de sus historias) y sus reglas, si vienen de una plantilla
    valor: texto(p?.valor, 200),
    reglas: (Array.isArray(p?.reglas) ? p.reglas : []).map((r) => texto(r, 200)).filter(Boolean).slice(0, 8),
  }));
  return { carriles, pasos };
}

// ── Flujo de valor (VSM): cuánto se trabaja y cuánto se espera en cada paso ──────

/** Minutos válidos (de 0 a un año) o null. */
const minutos = (v) => (Number.isFinite(v) && v >= 0 && v <= 525600 ? Math.round(v) : null);

const UNIDADES = [
  [/^(?:min|mins|minutos?|m)$/, 1],
  [/^(?:h|hr|hrs|horas?)$/, 60],
  [/^(?:d|dias?|días?)$/, 1440],
  [/^(?:sem|semanas?)$/, 10080],
];

/**
 * Lee una duración escrita como la diría una persona: «45 min», «2 h», «1,5 d», «3 días», «1 semana».
 * Sin unidad se entiende en horas. Devuelve minutos, o null si no se entiende.
 */
export function leerDuracion(texto) {
  const t = String(texto ?? '').trim().toLowerCase().replace(',', '.');
  if (!t) return null;
  const m = t.match(/^(\d+(?:\.\d+)?)\s*([a-záéíóú]*)\.?$/);
  if (!m) return null;
  const valor = Number(m[1]);
  const unidad = m[2] ? UNIDADES.find(([re]) => re.test(m[2]))?.[1] : 60;
  return unidad ? minutos(valor * unidad) : null;
}

/** «45 min», «2 h», «1 h 30 min», «2,5 d». Los días son de calendario (24 h): las esperas corren aunque nadie trabaje. */
export function formatoDuracion(min) {
  if (min === null || min === undefined) return '—';
  if (min < 60) return `${min} min`;
  if (min < 1440) {
    const h = Math.floor(min / 60);
    const resto = min % 60;
    return resto ? `${h} h ${resto} min` : `${h} h`;
  }
  const d = Math.round((min / 1440) * 10) / 10;
  return `${String(d).replace('.', ',')} d`;
}

/**
 * Resumen del flujo de valor: tiempo total (suma de trabajo y espera de las tareas en el orden del
 * proceso, como el camino principal), eficiencia (trabajo / total) y el cuello de botella (el paso con
 * más espera; si nadie anotó esperas, el de más trabajo).
 */
export function flujoDeValor(proceso) {
  const tareas = proceso.pasos.filter((p) => p.tipo === 'tarea');
  const conTiempo = tareas.filter((p) => Number.isFinite(p.trabajo) || Number.isFinite(p.espera));
  const trabajo = conTiempo.reduce((t, p) => t + (p.trabajo || 0), 0);
  const espera = conTiempo.reduce((t, p) => t + (p.espera || 0), 0);
  const total = trabajo + espera;
  const criterio = espera > 0 ? (p) => p.espera || 0 : (p) => p.trabajo || 0;
  const cuello = conTiempo.length ? conTiempo.reduce((a, b) => (criterio(b) > criterio(a) ? b : a)) : null;
  return {
    pasos: conTiempo.map((p) => ({ id: p.id, texto: p.texto, trabajo: p.trabajo || 0, espera: p.espera || 0, total: (p.trabajo || 0) + (p.espera || 0) })),
    trabajo,
    espera,
    total,
    eficiencia: total ? Math.round((trabajo / total) * 100) : null,
    cuello: cuello && criterio(cuello) > 0 ? cuello.id : null,
    medidos: conTiempo.length,
    faltan: tareas.length - conTiempo.length,
  };
}

export const procesoDe = (proyecto) => proyecto.proceso || PROCESO_VACIO;

export function agregarCarril(proceso, nombre) {
  const limpio = texto(nombre, 60);
  if (!limpio) return proceso;
  return { ...proceso, carriles: [...proceso.carriles, { id: nuevoId('ca'), nombre: limpio }] };
}

export function renombrarCarril(proceso, id, nombre) {
  const limpio = texto(nombre, 60);
  if (!limpio) return proceso;
  return { ...proceso, carriles: proceso.carriles.map((c) => (c.id === id ? { ...c, nombre: limpio } : c)) };
}

/** Sube o baja un carril (el orden es el de arriba hacia abajo en el diagrama). */
export function moverCarril(proceso, id, delta) {
  const carriles = [...proceso.carriles];
  const i = carriles.findIndex((c) => c.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= carriles.length) return proceso;
  [carriles[i], carriles[j]] = [carriles[j], carriles[i]];
  return { ...proceso, carriles };
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

/**
 * Inserta un paso justo después de otro. Si el anterior no es una decisión y lleva a un solo paso,
 * el nuevo queda en medio (anterior → nuevo → siguiente): así agregar un paso olvidado no exige
 * rehacer las flechas. El nuevo queda en el mismo carril que el anterior.
 */
export function insertarPasoDespues(proceso, id, { tipo = 'tarea', texto: t = '' } = {}) {
  const i = proceso.pasos.findIndex((p) => p.id === id);
  if (i < 0) return agregarPaso(proceso, { tipo, texto: t });
  const anterior = proceso.pasos[i];
  const paso = { id: nuevoId('pa'), tipo: Object.hasOwn(TIPOS_PASO, tipo) ? tipo : 'tarea', texto: texto(t, 160), carril: anterior.carril, siguientes: [], historiaIds: [] };
  const enMedio = anterior.tipo !== 'decision' && anterior.tipo !== 'fin' && anterior.siguientes.length <= 1;
  if (enMedio) paso.siguientes = anterior.siguientes.map((s) => ({ ...s }));
  const pasos = [...proceso.pasos];
  if (enMedio) pasos[i] = { ...anterior, siguientes: [{ a: paso.id, etiqueta: '' }] };
  pasos.splice(i + 1, 0, paso);
  return { ...proceso, pasos };
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
  // Flechas que vuelven atrás: cada una por su propio carril inferior y llegando a su propio punto,
  // para que dos vueltas al mismo paso no se dibujen una sobre otra
  let vueltas = 0;
  const llegadas = new Map();
  for (const p of proceso.pasos) {
    const o = porId.get(p.id);
    p.siguientes.forEach((s) => {
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
        const fondo = Math.max(o.fila, d.fila) * M.carril + M.carril - 8 - (vueltas % 4) * 8;
        const n = llegadas.get(d.id) || 0;
        llegadas.set(d.id, n + 1);
        const dx = d.cx + (n % 2 ? 1 : -1) * Math.ceil(n / 2) * 14;
        puntos = [[o.cx, o.y + o.alto], [o.cx, fondo], [dx, fondo], [dx, d.y + d.alto]];
        vueltas += 1;
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
