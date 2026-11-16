import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PROCESO_VACIO, agregarCarril, agregarPaso, conectar, desconectar, eliminarPaso, moverPaso, quitarCarril,
  normalizarProceso, revisarProceso, disposicion, aBpmn, lineas,
} from '../js/nucleo/proceso.js';
import { nuevoProyecto, normalizarProyecto } from '../js/nucleo/proyecto.js';

/** Inicio → Elegir → ¿Hay stock? → (sí) Pagar → Fin, (no) vuelve a Elegir. */
function pedido() {
  let p = agregarCarril(agregarCarril(PROCESO_VACIO, 'Clienta'), 'Tienda');
  const [clienta, tienda] = p.carriles.map((c) => c.id);
  p = agregarPaso(p, { tipo: 'inicio', texto: 'Quiere una torta', carril: clienta });
  p = agregarPaso(p, { texto: 'Elige productos', carril: clienta });
  p = agregarPaso(p, { tipo: 'decision', texto: '¿Hay stock?', carril: tienda });
  p = agregarPaso(p, { texto: 'Paga', carril: clienta });
  p = agregarPaso(p, { tipo: 'fin', texto: 'Pedido confirmado', carril: tienda });
  const [, elegir, stock, pagar, fin] = p.pasos.map((x) => x.id);
  p = conectar(conectar(p, stock, pagar, 'Sí'), stock, elegir, 'No');
  p = conectar(p, pagar, fin);
  return { p, ids: { elegir, stock, pagar, fin } };
}

test('agregar pasos los conecta en orden, salvo después de una decisión o un fin', () => {
  const { p, ids } = pedido();
  assert.deepEqual(p.pasos[0].siguientes.map((s) => s.a), [ids.elegir]);
  assert.deepEqual(p.pasos[1].siguientes.map((s) => s.a), [ids.stock]);
  assert.deepEqual(p.pasos[2].siguientes.map((s) => s.etiqueta), ['Sí', 'No'], 'la decisión solo tiene las salidas que se le dieron');
});

test('un proceso completo y conectado solo avisa lo que falta levantar', () => {
  const { p } = pedido();
  const { avisos, pasosSinHistorias } = revisarProceso(p, []);
  assert.deepEqual(avisos.filter((a) => a.nivel !== 'info'), []);
  assert.equal(pasosSinHistorias.length, 2, 'las dos tareas no tienen historias todavía');
});

test('detecta inicio o fin faltante, decisiones con una salida y pasos sueltos', () => {
  let { p, ids } = pedido();
  p = desconectar(p, ids.stock, ids.elegir);
  p = eliminarPaso(p, p.pasos[0].id);
  p = agregarPaso(p, { texto: 'Paso suelto' });
  const textos = revisarProceso(p).avisos.map((a) => a.texto).join('\n');
  assert.match(textos, /Falta el inicio/);
  assert.match(textos, /¿Hay stock\?» necesita al menos dos salidas/);
  assert.match(textos, /«Paso suelto» no lleva a ningún paso/);
});

test('cobertura: historias fuera del proceso, sin contar spikes ni las «esta vez no»', () => {
  const { p, ids } = pedido();
  const historias = [
    { id: 'h1', tipo: 'historia', prioridad: 'must', titulo: 'Pagar' },
    { id: 'h2', tipo: 'historia', prioridad: 'should', titulo: 'Reportes' },
    { id: 'h3', tipo: 'spike', prioridad: 'should', titulo: 'Investigar' },
    { id: 'h4', tipo: 'historia', prioridad: 'wont', titulo: 'Cupones' },
  ];
  const conHistoria = { ...p, pasos: p.pasos.map((x) => (x.id === ids.pagar ? { ...x, historiaIds: ['h1'] } : x)) };
  assert.deepEqual(revisarProceso(conHistoria, historias).historiasFuera.map((h) => h.id), ['h2']);
});

test('normalizar descarta flechas a pasos que no existen e historias borradas', () => {
  const { p, ids } = pedido();
  const sucio = { ...p, pasos: p.pasos.map((x) => (x.id === ids.pagar ? { ...x, siguientes: [...x.siguientes, { a: 'no-existe' }], historiaIds: ['h1', 'borrada'] } : x)) };
  const limpio = normalizarProceso(JSON.parse(JSON.stringify(sucio)), new Set(['h1']));
  const pagar = limpio.pasos.find((x) => x.id === ids.pagar);
  assert.deepEqual(pagar.siguientes.map((s) => s.a), [ids.fin]);
  assert.deepEqual(pagar.historiaIds, ['h1']);
  assert.deepEqual(normalizarProyecto(nuevoProyecto('X')).proceso, { carriles: [], pasos: [] });
});

test('mover y quitar carril reacomodan sin perder pasos', () => {
  const { p, ids } = pedido();
  assert.equal(moverPaso(p, ids.pagar, -1).pasos[2].id, ids.pagar);
  const sinTienda = quitarCarril(p, p.carriles[1].id);
  assert.equal(sinTienda.pasos.length, 5);
  assert.ok(sinTienda.pasos.every((x) => x.carril === p.carriles[0].id));
});

test('el diagrama ubica cada paso en su carril y las flechas de vuelta pasan por debajo', () => {
  const { p, ids } = pedido();
  const d = disposicion(p);
  const nodo = (id) => d.nodos.find((n) => n.id === id);
  assert.equal(nodo(ids.stock).fila, 1);
  assert.ok(nodo(ids.pagar).cx > nodo(ids.stock).cx, 'el orden de la lista es el orden de izquierda a derecha');
  const vuelta = d.flechas.find((f) => f.de === ids.stock && f.a === ids.elegir);
  assert.ok(vuelta.puntos[1][1] > nodo(ids.stock).y + nodo(ids.stock).alto, 'baja antes de volver');
  assert.deepEqual(lineas('Arma el carro y elige el día y bloque de entrega'), ['Arma el carro y', 'elige el día y', 'bloque de entrega']);
});

test('BPMN 2.0: carriles, elementos, flujos con nombre y diagrama, con texto escapado', () => {
  const { p } = pedido();
  const conHistoria = { ...p, pasos: p.pasos.map((x, i) => (i === 3 ? { ...x, texto: 'Paga <con> "tarjeta"', historiaIds: ['h1'] } : x)) };
  const bpmn = aBpmn(conHistoria, 'Pedido & entrega', [{ id: 'h1', titulo: 'Pagar con tarjeta' }]);
  assert.match(bpmn, /^<\?xml version="1.0" encoding="UTF-8"\?>/);
  for (const etiqueta of ['bpmn:laneSet', 'bpmn:startEvent', 'bpmn:exclusiveGateway', 'bpmn:endEvent', 'bpmndi:BPMNEdge', 'di:waypoint']) assert.ok(bpmn.includes(`<${etiqueta}`), etiqueta);
  assert.equal((bpmn.match(/<bpmn:sequenceFlow /g) || []).length, 5);
  assert.ok(bpmn.includes('name="Sí"') && bpmn.includes('name="Pedido &amp; entrega"'));
  assert.ok(bpmn.includes('name="Paga &lt;con&gt; &quot;tarjeta&quot;"'));
  assert.ok(bpmn.includes('<bpmn:documentation>Historias: Pagar con tarjeta</bpmn:documentation>'));
  assert.ok((bpmn.match(/ id="[^"]*"/g) || []).every((a) => /^ id="[A-Za-z_][\w.-]*"$/.test(a)), 'los ids son válidos para XML');
});

test('el ejemplo de Carla trae su circuito completo, con cada tarea enlazada a historias', async () => {
  const { readFile } = await import('node:fs/promises');
  const p = normalizarProyecto(JSON.parse(await readFile(new URL('../docs/ejemplo/pasteleria-carla.json', import.meta.url), 'utf8')));
  const { avisos, pasosSinHistorias, historiasFuera } = revisarProceso(p.proceso, p.historias);
  assert.deepEqual(avisos.filter((a) => a.nivel !== 'info'), []);
  assert.equal(pasosSinHistorias.length, 0);
  assert.ok(historiasFuera.length > 0, 'muestra historias de soporte fuera del circuito');
  assert.equal(p.proceso.carriles.length, 3);
});

test('insertar un paso olvidado lo deja en medio, sin rehacer flechas', async () => {
  const { insertarPasoDespues } = await import('../js/nucleo/proceso.js');
  const { p, ids } = pedido();
  const conPaso = insertarPasoDespues(p, ids.elegir, { texto: 'Revisa el carro' });
  const nuevo = conPaso.pasos[2];
  assert.equal(nuevo.texto, 'Revisa el carro');
  assert.deepEqual(conPaso.pasos[1].siguientes.map((s) => s.a), [nuevo.id], 'el anterior lleva al nuevo');
  assert.deepEqual(nuevo.siguientes.map((s) => s.a), [ids.stock], 'el nuevo lleva a donde iba el anterior');
  assert.equal(nuevo.carril, p.pasos[1].carril);
  const trasDecision = insertarPasoDespues(p, ids.stock, { texto: 'Avisa' });
  assert.equal(trasDecision.pasos[3].siguientes.length, 0, 'después de una decisión no adivina qué salida tomar');
  assert.deepEqual(revisarProceso(conPaso).avisos.filter((a) => a.nivel === 'error'), []);
});

test('los carriles se renombran y reordenan sin perder sus pasos', async () => {
  const { renombrarCarril, moverCarril } = await import('../js/nucleo/proceso.js');
  const { p } = pedido();
  const [clienta, tienda] = p.carriles.map((c) => c.id);
  const r = moverCarril(renombrarCarril(p, tienda, 'Tienda en línea'), tienda, -1);
  assert.deepEqual(r.carriles.map((c) => c.nombre), ['Tienda en línea', 'Clienta']);
  assert.ok(r.pasos.some((x) => x.carril === clienta) && r.pasos.some((x) => x.carril === tienda));
  assert.equal(renombrarCarril(p, tienda, '   '), p, 'un nombre vacío no cambia nada');
});

test('dos flechas que vuelven al mismo paso llegan por puntos distintos', () => {
  let { p, ids } = pedido();
  p = conectar(p, ids.pagar, ids.elegir, 'Cambiar');
  const vueltas = disposicion(p).flechas.filter((f) => f.a === ids.elegir && f.puntos.length === 4 && f.puntos[0][1] < f.puntos[1][1]);
  assert.equal(vueltas.length, 2);
  assert.notEqual(vueltas[0].puntos[3][0], vueltas[1].puntos[3][0]);
  assert.notEqual(vueltas[0].puntos[1][1], vueltas[1].puntos[1][1]);
});

test('mapa clásico: columnas en el orden del recorrido, con su actor, y soporte al final', async () => {
  const { mapaPorProceso, moverEnMapaProceso } = await import('../js/nucleo/proyecto.js');
  const { p: proceso, ids } = pedido();
  const proyecto = { ...nuevoProyecto('X'), historias: [
    { id: 'h1', titulo: 'Elegir', prioridad: 'must', estado: 'backlog', puntos: 3 },
    { id: 'h2', titulo: 'Pagar', prioridad: 'should', estado: 'backlog', puntos: 5 },
    { id: 'h3', titulo: 'Reportes', prioridad: 'must', estado: 'backlog', puntos: 2 },
  ], proceso: { ...proceso, pasos: proceso.pasos.map((x) => (x.id === ids.elegir ? { ...x, historiaIds: ['h1'] } : x.id === ids.pagar ? { ...x, historiaIds: ['h2', 'h1'] } : x)) } };
  const m = mapaPorProceso(proyecto);
  assert.deepEqual(m.columnas.map((c) => c.nombre), ['Elige productos', 'Paga', 'Soporte (fuera del recorrido)']);
  assert.equal(m.columnas[0].actor, 'Clienta');
  const must = m.filas.find((f) => f.prioridad === 'must');
  assert.deepEqual(must.celdas[ids.elegir].map((h) => h.id), ['h1'], 'una historia en dos pasos aparece en el primero');
  assert.deepEqual(must.celdas[''].map((h) => h.id), ['h3']);
  const movido = moverEnMapaProceso(proyecto, 'h3', ids.pagar, 'could');
  assert.equal(movido.historias.find((h) => h.id === 'h3').prioridad, 'could');
  assert.ok(movido.proceso.pasos.find((x) => x.id === ids.pagar).historiaIds.includes('h3'));
  const aSoporte = moverEnMapaProceso(proyecto, 'h1', '', 'must');
  assert.ok(aSoporte.proceso.pasos.every((x) => !x.historiaIds.includes('h1')), 'a soporte = sin paso');
  assert.equal(mapaPorProceso({ ...nuevoProyecto('Y'), historias: [] }).hayProceso, false);
});

test('VSM: las duraciones se leen como las escribe una persona y se muestran legibles', async () => {
  const { leerDuracion, formatoDuracion } = await import('../js/nucleo/proceso.js');
  assert.deepEqual(['45 min', '2 h', '1,5 d', '3 días', '1 semana', '2', '', 'mucho'].map(leerDuracion), [45, 120, 2160, 4320, 10080, 120, null, null]);
  assert.deepEqual([30, 90, 120, 2160, null].map(formatoDuracion), ['30 min', '1 h 30 min', '2 h', '1,5 d', '—']);
});

test('VSM: tiempo total, eficiencia y cuello de botella; las tareas sin tiempo no suman', async () => {
  const { flujoDeValor } = await import('../js/nucleo/proceso.js');
  const { p, ids } = pedido();
  const conTiempos = { ...p, pasos: p.pasos.map((x) => (x.id === ids.elegir ? { ...x, trabajo: 30, espera: 0 } : x.id === ids.pagar ? { ...x, trabajo: 10, espera: 2880 } : x)) };
  const v = flujoDeValor(conTiempos);
  assert.equal(v.total, 2920);
  assert.equal(v.trabajo, 40);
  assert.equal(v.eficiencia, 1, 'casi todo el tiempo se espera');
  assert.equal(v.cuello, ids.pagar);
  assert.equal(v.faltan, 0);
  assert.equal(flujoDeValor(p).medidos, 0, 'sin tiempos anotados no hay flujo que medir');
  assert.equal(flujoDeValor(p).cuello, null);
});

test('stakeholders: cuadrantes poder/interés y avisos de lo que falta', async () => {
  const { nuevoStakeholder, cuadranteDe, revisarStakeholders, normalizarStakeholders } = await import('../js/nucleo/stakeholders.js');
  const { p } = pedido();
  const gerente = nuevoStakeholder({ nombre: 'Gerente', rol: 'aprueba', poder: 'alto', interes: 'bajo' });
  const supervisora = nuevoStakeholder({ nombre: 'Supervisora', rol: 'opera', poder: 'bajo', interes: 'bajo', carril: p.carriles[0].id });
  assert.equal(cuadranteDe(gerente), 'satisfacer');
  assert.equal(cuadranteDe({ poder: 'alto', interes: 'alto' }), 'gestionar');
  const textos = revisarStakeholders([gerente, supervisora], p).map((a) => a.texto).join('\n');
  assert.match(textos, /Nadie mantiene el sistema/);
  assert.match(textos, /¿Quién habla por «Tienda»/);
  assert.match(textos, /Supervisora opera en terreno pero tiene interés bajo/);
  assert.doesNotMatch(textos, /Nadie aprueba/);
  assert.equal(normalizarStakeholders([{ nombre: 'X', carril: 'no-existe', rol: 'raro' }])[0].carril, null);
  assert.deepEqual(revisarStakeholders([], p), [], 'sin stakeholders todavía, no hay avisos');
  const proyecto = normalizarProyecto(JSON.parse(JSON.stringify({ ...nuevoProyecto('X'), proceso: p, stakeholders: [supervisora] })));
  assert.equal(proyecto.stakeholders[0].carril, p.carriles[0].id, 'conserva el enlace al carril');
});

test('el ejemplo de Carla trae VSM con cuello de botella, stakeholders y KPIs medidos', async () => {
  const { readFile } = await import('node:fs/promises');
  const { flujoDeValor } = await import('../js/nucleo/proceso.js');
  const { revisarStakeholders } = await import('../js/nucleo/stakeholders.js');
  const { avanceResultado } = await import('../js/nucleo/okr.js');
  const p = normalizarProyecto(JSON.parse(await readFile(new URL('../docs/ejemplo/pasteleria-carla.json', import.meta.url), 'utf8')));
  const vsm = flujoDeValor(p.proceso);
  assert.equal(vsm.faltan, 0, 'todas las tareas tienen tiempos');
  assert.equal(p.proceso.pasos.find((x) => x.id === vsm.cuello).texto, 'Despacha o entrega en tienda');
  assert.equal(p.stakeholders.length, 5);
  assert.ok(!revisarStakeholders(p.stakeholders, p.proceso).some((a) => /Nadie/.test(a.texto)), 'aprueba, opera y mantiene están cubiertos');
  assert.ok(p.objetivos[0].resultados.every((r) => avanceResultado(r).avance > 0), 'los resultados clave avanzan');
  assert.ok(p.historias.every((h) => !h.terminada || h.creada <= h.terminada), 'ninguna historia termina antes de crearse');
});

test('plantillas por industria: procesos completos, sin errores, con tiempos y dolores sin confirmar', async () => {
  const { PLANTILLAS_PROCESO, INDUSTRIAS, procesoDesdePlantilla, plantillasDe } = await import('../js/nucleo/plantillasProceso.js');
  const { flujoDeValor } = await import('../js/nucleo/proceso.js');
  assert.equal(plantillasDe('agro').length, 3);
  assert.equal(plantillasDe('construccion').length, 3);
  for (const pl of PLANTILLAS_PROCESO) {
    assert.ok(INDUSTRIAS[pl.industria], pl.clave);
    const pr = normalizarProceso(JSON.parse(JSON.stringify(procesoDesdePlantilla(pl))));
    const errores = revisarProceso(pr).avisos.filter((a) => a.nivel !== 'info');
    assert.deepEqual(errores, [], `${pl.nombre}: ${errores.map((a) => a.texto).join('; ')}`);
    assert.ok(flujoDeValor(pr).cuello, `${pl.nombre}: tiene cuello de botella`);
    assert.ok(pr.pasos.some((x) => x.dolores.length) && pr.pasos.every((x) => x.dolores.every((d) => !d.confirmado)), `${pl.nombre}: dolores sin confirmar`);
    assert.ok(pr.pasos.filter((x) => x.tipo === 'tarea').every((x) => x.valor), `${pl.nombre}: cada tarea dice para qué sirve`);
  }
});

test('del proceso al backlog: rol del carril, para qué, criterios de las decisiones, dolores y esperas', async () => {
  const { PLANTILLAS_PROCESO, procesoDesdePlantilla } = await import('../js/nucleo/plantillasProceso.js');
  const { historiasDesdeProceso, enlazarConPasos } = await import('../js/nucleo/derivar.js');
  const { revisarInvest } = await import('../js/nucleo/historias.js');
  const pl = PLANTILLAS_PROCESO.find((x) => x.clave === 'agro-recepcion');
  const proceso = procesoDesdePlantilla(pl);
  const muestra = proceso.pasos.find((x) => x.texto.startsWith('Tomar muestras'));
  muestra.dolores[0].confirmado = true;
  const proyecto = { ...nuevoProyecto('Planta'), proceso };
  const hs = historiasDesdeProceso(proyecto);
  assert.equal(hs.length, proceso.pasos.filter((x) => x.tipo === 'tarea').length);
  const h = hs.find((x) => x.pasoId === muestra.id);
  assert.equal(h.rol, 'encargado de control de calidad', 'un área se lee como su encargado');
  assert.equal(h.epica, 'Control de calidad');
  assert.equal(h.quiero, 'tomar muestras y registrar el análisis de calidad');
  assert.equal(h.para, 'liberar o retener el lote con datos');
  assert.ok(h.criterios.some((c) => c.includes('«Cumple la especificación» es «No»') && c.includes('«Retener o rechazar')), 'la decisión que sigue da un criterio por salida');
  assert.ok(h.criterios.some((c) => c.includes('el resultado del laboratorio llega horas después')), 'el dolor confirmado es un criterio');
  assert.ok(h.criterios.some((c) => c.includes('espera 4 h')), 'la espera del flujo de valor es un criterio');
  assert.equal(h.prioridad, 'must', 'es el cuello de botella');
  assert.deepEqual(h.reglas, ['Toda partida queda retenida hasta tener el resultado']);
  const ingreso = hs.find((x) => x.quiero.startsWith('ingresar el lote'));
  assert.equal(ingreso.rol, 'encargado de control de calidad', 'un carril de sistema toma el rol de la persona anterior');
  assert.ok(hs.every((x) => !revisarInvest(x).some((a) => a.codigo === 'criterios' || a.codigo === 'valor')), 'todas con criterios y para qué');

  const enlazado = enlazarConPasos({ ...proyecto, historias: hs }, hs);
  assert.ok(enlazado.proceso.pasos.find((x) => x.id === muestra.id).historiaIds.includes(h.id));
  assert.equal(historiasDesdeProceso(enlazado).length, 0, 'las tareas con historias no se repiten');
  assert.equal(historiasDesdeProceso(enlazado, { todas: true }).length, hs.length);
});

test('IA: mejora la redacción por paso, pero lo mal formado no reemplaza a las reglas', async () => {
  const { PLANTILLAS_PROCESO, procesoDesdePlantilla } = await import('../js/nucleo/plantillasProceso.js');
  const { historiasDesdeProceso, mejorarConIa, contextoParaIa } = await import('../js/nucleo/derivar.js');
  const proyecto = { ...nuevoProyecto('Obra'), proceso: procesoDesdePlantilla(PLANTILLAS_PROCESO.find((x) => x.clave === 'construccion-estado-pago')) };
  const reglas = historiasDesdeProceso(proyecto);
  const [a, b] = reglas;
  const ctx = contextoParaIa(proyecto, reglas);
  assert.equal(ctx[0].pasoId, a.pasoId);
  assert.equal(ctx[0].actor, 'Jefe de obra');
  assert.ok(ctx.some((x) => x.decision_siguiente.length), 'la IA recibe las salidas de la decisión');
  const mejoradas = mejorarConIa(reglas, { historias: [
    { pasoId: a.pasoId, rol: 'Jefe de obra', quiero: 'Poder medir el avance por partida desde la tablet.', para: 'para cobrar lo ejecutado sin discusiones', criterios: ['Dado un período cerrado, cuando mido una partida, entonces queda con foto y fecha.', 'esto no es un criterio'] },
    { pasoId: b.pasoId, quiero: '', criterios: [] },
    { pasoId: 'otro', quiero: 'algo que no existe' },
  ] });
  assert.equal(mejoradas[0].quiero, 'medir el avance por partida desde la tablet');
  assert.equal(mejoradas[0].para, 'cobrar lo ejecutado sin discusiones');
  assert.equal(mejoradas[0].rol, 'jefe de obra');
  assert.deepEqual(mejoradas[0].criterios, ['Dado un período cerrado, cuando mido una partida, entonces queda con foto y fecha.']);
  assert.equal(mejoradas[0].prioridad, a.prioridad, 'la prioridad sigue siendo la de las reglas');
  assert.deepEqual(mejoradas[1], b, 'sin texto válido, queda el borrador por reglas');
  assert.equal(mejoradas.length, reglas.length, 'no se agregan historias inventadas');
});

test('IA: adaptar la plantilla cambia nombres, nunca el circuito', async () => {
  const { PLANTILLAS_PROCESO, adaptarPlantilla, procesoDesdePlantilla, plantillaParaIa } = await import('../js/nucleo/plantillasProceso.js');
  const pl = PLANTILLAS_PROCESO.find((x) => x.clave === 'agro-mermas');
  assert.equal(plantillaParaIa(pl).pasos[1].carril, 'Operador de línea');
  const adaptada = adaptarPlantilla(pl, {
    carriles: ['Operario de faena', 'Jefe de turno', 'Aseguramiento de calidad', 'SAP'],
    pasos: [
      { ref: 'registro', texto: 'Registrar kilos y mermas por estación de faena', valor: 'conocer el rendimiento por canal', dolores: ['Planilla en papel por estación'] },
      { ref: 'sobre', texto: '¿Merma sobre el 2%?' },
      { ref: 'inventado', texto: 'Paso que no existe' },
    ],
  });
  assert.deepEqual(adaptada.carriles, ['Operario de faena', 'Jefe de turno', 'Aseguramiento de calidad', 'SAP']);
  assert.equal(adaptada.pasos.length, pl.pasos.length, 'no se agregan ni quitan pasos');
  const pr = normalizarProceso(JSON.parse(JSON.stringify(procesoDesdePlantilla(adaptada))));
  assert.ok(pr.pasos.some((x) => x.texto === 'Registrar kilos y mermas por estación de faena' && x.dolores[0].texto === 'Planilla en papel por estación'));
  assert.ok(pr.pasos.some((x) => x.texto === '¿Merma sobre el 2%?' && x.siguientes.length === 2), 'la decisión conserva sus salidas');
  assert.deepEqual(revisarProceso(pr).avisos.filter((a) => a.nivel !== 'info'), []);
  assert.deepEqual(adaptarPlantilla(pl, { carriles: ['solo uno'] }).carriles, pl.carriles, 'otra cantidad de carriles se ignora');
});
