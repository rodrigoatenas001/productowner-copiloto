import { test } from 'node:test';
import assert from 'node:assert/strict';
import { notasAHistorias } from '../js/nucleo/historias.js';
import { nuevoProyecto, normalizarProyecto } from '../js/nucleo/proyecto.js';
import {
  wsjf, rice, costoDelRetraso, ordenarPorPuntaje, reordenarBacklog, matrizValorEsfuerzo, normalizarPriorizacion,
} from '../js/nucleo/priorizacion.js';

const historia = (puntos, priorizacion) => ({ ...notasAHistorias('- algo útil para alguien')[0], puntos, priorizacion });

test('WSJF = (valor + urgencia + riesgo) / tamaño', () => {
  const h = historia(5, { valor: 8, urgencia: 5, riesgo: 2 });
  assert.equal(costoDelRetraso(h), 15);
  assert.equal(wsjf(h), 3);
  assert.equal(wsjf(historia(null, { valor: 8, urgencia: 5, riesgo: 2 })), null, 'sin estimar no hay WSJF');
  assert.equal(wsjf(historia(5, { valor: 8, urgencia: 5 })), null, 'faltan datos');
});

test('RICE = alcance × impacto × confianza / esfuerzo', () => {
  assert.equal(rice(historia(5, { alcance: 1000, impacto: 2, confianza: 80 })), 320);
  assert.equal(rice(historia(5, { alcance: 0, impacto: 2, confianza: 80 })), 0, 'alcance cero es válido');
  assert.equal(rice(historia(5, { impacto: 2, confianza: 80 })), null);
});

test('ordenar por puntaje deja al final lo que no tiene datos, en su orden', () => {
  const a = historia(5, { valor: 2, urgencia: 1, riesgo: 1 }); // 0.8
  const b = historia(2, { valor: 8, urgencia: 8, riesgo: 5 }); // 10.5
  const c = historia(3, {});
  const d = historia(1, {});
  assert.deepEqual(ordenarPorPuntaje([a, c, b, d], 'wsjf'), [b, a, c, d]);
});

test('reordenar el backlog no mueve lo que está en sprint', () => {
  const enSprint = { ...historia(3, { valor: 1, urgencia: 1, riesgo: 1 }), estado: 'todo' };
  const a = historia(5, { valor: 2, urgencia: 1, riesgo: 1 });
  const b = historia(2, { valor: 8, urgencia: 8, riesgo: 5 });
  assert.deepEqual(reordenarBacklog([a, enSprint, b], 'wsjf'), [b, enSprint, a]);
});

test('matriz valor/esfuerzo con cortes en la mediana del backlog', () => {
  const rapida = historia(2, { valor: 13, urgencia: 8, riesgo: 5 }); // 26, 2
  const grande = historia(13, { valor: 13, urgencia: 13, riesgo: 5 }); // 31, 13
  const relleno = historia(1, { valor: 1, urgencia: 1, riesgo: 1 }); // 3, 1
  const trampa = historia(8, { valor: 2, urgencia: 1, riesgo: 1 }); // 4, 8
  const sin = historia(null, {});
  const m = matrizValorEsfuerzo([rapida, grande, relleno, trampa, sin]);
  assert.deepEqual(m.cortes, { valor: 15, esfuerzo: 5 });
  assert.deepEqual(m.cuadrantes.rapida, [rapida]);
  assert.deepEqual(m.cuadrantes.grande, [grande]);
  assert.deepEqual(m.cuadrantes.relleno, [relleno]);
  assert.deepEqual(m.cuadrantes.trampa, [trampa]);
  assert.deepEqual(m.sinDatos, [sin]);
});

test('los datos de priorización se limpian al importar un respaldo', () => {
  assert.deepEqual(normalizarPriorizacion({ valor: 4, urgencia: 8, riesgo: '5', alcance: -3, impacto: 2, confianza: 70 }),
    { valor: null, urgencia: 8, riesgo: 5, alcance: null, impacto: 2, confianza: null });
  const p = nuevoProyecto();
  p.historias = [historia(3, { valor: 8, urgencia: 5, riesgo: 2, alcance: 500, impacto: 1, confianza: 100 })];
  const n = normalizarProyecto(JSON.parse(JSON.stringify(p)));
  assert.equal(wsjf(n.historias[0]), 5);
  assert.equal(rice(n.historias[0]), 166.7);
});
