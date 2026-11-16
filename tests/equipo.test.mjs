import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mezclar, iguales } from '../js/nucleo/mezcla.js';
import { nuevaSala, cifrar, descifrar, enlaceInvitacion, leerInvitacion, normalizarServidor, urlSocket } from '../js/nucleo/sala.js';
import { procesar, partir } from '../servidor/src/protocolo.js';

const h = (id, extra = {}) => ({ id, titulo: id, estado: 'backlog', puntos: null, ...extra });

test('mezcla: cada lado edita una historia distinta y ambas quedan', () => {
  const base = { nombre: 'P', historias: [h('a'), h('b')] };
  const local = { ...base, historias: [h('a', { puntos: 3 }), h('b')] };
  const remoto = { ...base, historias: [h('a'), h('b', { estado: 'listo' })] };
  assert.deepEqual(mezclar(base, local, remoto).historias, [h('a', { puntos: 3 }), h('b', { estado: 'listo' })]);
});

test('mezcla: campos distintos de la misma historia no se pisan; el mismo campo lo gana el local', () => {
  const base = { historias: [h('a')] };
  const m = mezclar(base, { historias: [h('a', { titulo: 'Local', puntos: 5 })] }, { historias: [h('a', { titulo: 'Remoto', estado: 'listo' })] });
  assert.deepEqual(m.historias[0], h('a', { titulo: 'Local', puntos: 5, estado: 'listo' }));
});

test('mezcla: historias nuevas de ambos lados quedan, cada una tras su vecina', () => {
  const base = { historias: [h('a'), h('b')] };
  const m = mezclar(base, { historias: [h('a'), h('x'), h('b')] }, { historias: [h('a'), h('b'), h('y')] });
  assert.deepEqual(m.historias.map((x) => x.id), ['a', 'x', 'b', 'y']);
});

test('mezcla: un borrado se respeta, salvo que el otro lado haya editado esa historia', () => {
  const base = { historias: [h('a'), h('b')] };
  assert.deepEqual(mezclar(base, { historias: [h('a')] }, base).historias.map((x) => x.id), ['a']);
  assert.deepEqual(mezclar(base, { historias: [h('a')] }, { historias: [h('a'), h('b', { puntos: 8 })] }).historias.map((x) => x.id), ['a', 'b']);
});

test('mezcla: si solo el otro reordenó, se respeta su orden', () => {
  const base = { historias: [h('a'), h('b'), h('c')] };
  const remoto = { historias: [h('c'), h('a'), h('b')] };
  const local = { historias: [h('a', { puntos: 1 }), h('b'), h('c')] };
  assert.deepEqual(mezclar(base, local, remoto).historias.map((x) => x.id), ['c', 'a', 'b']);
});

test('mezcla: listas de valores suman agregados y quitan borrados', () => {
  assert.deepEqual(mezclar(['r1', 'r2'], ['r1', 'r2', 'r3'], ['r2', 'r4']), ['r2', 'r3', 'r4']);
});

test('mezcla: iguales ignora claves undefined', () => {
  assert.ok(iguales({ a: 1, b: undefined }, { a: 1 }));
  assert.ok(!iguales([1, 2], [2, 1]));
});

test('sala: cifrar y descifrar un proyecto; otra clave no sirve', async () => {
  const { clave } = nuevaSala();
  const dato = { nombre: 'Ñandú', historias: Array.from({ length: 300 }, (_, i) => h(`h${i}`)) };
  const texto = await cifrar(clave, dato);
  assert.ok(!texto.includes('Ñandú') && !texto.includes('historias') && texto.length < 4000, 'cifrado y comprimido');
  assert.deepEqual(await descifrar(clave, texto), dato);
  await assert.rejects(descifrar(nuevaSala().clave, texto));
});

test('sala: enlace de invitación ida y vuelta, la clave va después del #', () => {
  const s = { servidor: 'https://salas.ejemplo.workers.dev', ...nuevaSala() };
  const enlace = enlaceInvitacion('https://app.cl/copiloto/?x=1#backlog', s);
  assert.ok(enlace.startsWith('https://app.cl/copiloto/?x=1#equipo='));
  assert.deepEqual(leerInvitacion(new URL(enlace).hash), s);
  assert.equal(leerInvitacion('#backlog'), null);
  assert.equal(leerInvitacion('#equipo=https%3A%2F%2Fa.cl~corta~x'), null);
});

test('sala: dirección del servidor', () => {
  assert.equal(normalizarServidor('salas.ejemplo.workers.dev/'), 'https://salas.ejemplo.workers.dev');
  assert.equal(normalizarServidor('http://localhost:8787'), 'http://localhost:8787');
  assert.throws(() => normalizarServidor('http://salas.cl'));
  assert.equal(urlSocket('https://a.cl', 'abc'), 'wss://a.cl/sala/abc');
  assert.equal(urlSocket('http://localhost:8787', 'abc'), 'ws://localhost:8787/sala/abc');
});

test('servidor: guarda solo sobre la versión actual y avisa a los demás', () => {
  let estado = { version: 0, datos: null };
  assert.deepEqual(procesar(estado, '{"t":"hola"}').responder, { t: 'estado', version: 0, datos: null });
  const r = procesar(estado, JSON.stringify({ t: 'guardar', base: 0, datos: 'iv.uno' }));
  assert.deepEqual(r.responder, { t: 'ok', version: 1 });
  assert.deepEqual(r.difundir, { t: 'nuevo', version: 1, datos: 'iv.uno' });
  estado = r.estado;
  const tarde = procesar(estado, JSON.stringify({ t: 'guardar', base: 0, datos: 'iv.dos' }));
  assert.deepEqual(tarde.responder, { t: 'rechazo', version: 1, datos: 'iv.uno' });
  assert.equal(tarde.estado, undefined);
  assert.equal(procesar(estado, 'basura').responder.t, 'error');
  assert.deepEqual(procesar(estado, '{"t":"aviso","datos":"iv.x"}').difundir, { t: 'aviso', datos: 'iv.x' });
});

test('servidor: parte los datos para el almacenamiento', () => {
  assert.deepEqual(partir('abcdefg', 3), ['abc', 'def', 'g']);
  assert.equal(partir('x'.repeat(250_001)).length, 3);
});
