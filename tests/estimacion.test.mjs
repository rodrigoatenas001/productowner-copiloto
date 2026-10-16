import { test } from 'node:test';
import assert from 'node:assert/strict';
import { consenso, siguienteSinEstimar } from '../js/nucleo/estimacion.js';
import { notasAHistorias } from '../js/nucleo/historias.js';

test('acuerdo cuando los votos son iguales o vecinos en la escala', () => {
  const r = consenso([3, 5, 3]);
  assert.equal(r.sugerencia, 3);
  assert.equal(r.acuerdo, true);
  assert.equal(r.conversar, false);
});

test('pide conversar cuando hay votos lejanos, y sugiere la mediana hacia arriba', () => {
  const r = consenso([2, 3, 13, 8]);
  assert.deepEqual([r.min, r.max], [2, 13]);
  assert.equal(r.sugerencia, 8); // mediana 5.5 → 8
  assert.equal(r.acuerdo, false);
  assert.equal(r.conversar, true);
});

test('los "no sé" piden conversar y no cuentan en la sugerencia', () => {
  const r = consenso([5, '?', 5]);
  assert.equal(r.sugerencia, 5);
  assert.equal(r.dudas, 1);
  assert.equal(r.acuerdo, false);
  assert.equal(r.conversar, true);
  assert.equal(consenso(['?', '?']).sugerencia, null);
  assert.equal(consenso([]).conversar, false);
});

test('ignora valores fuera de la escala', () => {
  assert.deepEqual(consenso([4, 'x', 5]).numericos, [5]);
});

test('siguienteSinEstimar respeta el orden y salta lo estimado o descartado', () => {
  const hs = notasAHistorias('- uno uno\n- dos dos\n- tres tres\n- cuatro cuatro');
  hs[0].puntos = 3;
  hs[2].prioridad = 'wont';
  assert.equal(siguienteSinEstimar(hs).quiero, 'dos dos');
  assert.equal(siguienteSinEstimar(hs, hs[1].id).quiero, 'cuatro cuatro');
  assert.equal(siguienteSinEstimar(hs, hs[3].id), null);
});
