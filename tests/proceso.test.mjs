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
