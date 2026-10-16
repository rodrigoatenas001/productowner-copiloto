import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aHistoria } from '../js/nucleo/historias.js';
import { casosBorde, agregarCasosBorde } from '../js/nucleo/casosborde.js';

const familias = (h) => [...new Set(casosBorde(h).map((c) => c.familia))];

test('elige familias según de qué trata la historia', () => {
  assert.deepEqual(familias(aHistoria({ texto: 'Como clienta, quiero pagar con tarjeta, para no transferir' })), ['pagos', 'general']);
  assert.deepEqual(familias(aHistoria({ texto: 'Como contadora, quiero descargar las ventas en Excel, para declarar' })), ['archivos', 'general']);
  assert.deepEqual(familias(aHistoria({ texto: 'Como paciente, quiero reservar una hora, para atenderme' })), ['fechas', 'general']);
  assert.deepEqual(familias(aHistoria({ texto: 'Como vecino, quiero registrar un reclamo con foto, para que lo atiendan' })), ['datos', 'archivos', 'general']);
});

test('los generales (permisos y conexión) siempre se sugieren si no están cubiertos', () => {
  const h = aHistoria({ texto: 'Como gerente, quiero aprobar descuentos, para cerrar ventas' });
  assert.deepEqual(familias(h), ['general']);
  assert.equal(casosBorde(h).length, 2);
});

test('no sugiere lo que los criterios ya cubren', () => {
  const h = aHistoria({ texto: 'Como clienta, quiero pagar con tarjeta, para no transferir' });
  h.criterios.push('Dado que la tarjeta es rechazada, cuando pago, entonces veo el motivo.', 'Dado que mi sesión expiró, cuando pago, entonces debo ingresar.');
  assert.deepEqual(casosBorde(h), []);
});

test('agregar casos borde no duplica y se puede repetir sin efecto', () => {
  const h = aHistoria({ texto: 'Como clienta, quiero pagar con tarjeta, para no transferir' });
  const una = agregarCasosBorde(h);
  assert.equal(una.criterios.length, 1 + 4);
  assert.deepEqual(agregarCasosBorde(una).criterios, una.criterios);
  assert.deepEqual(casosBorde(una), []);
});
