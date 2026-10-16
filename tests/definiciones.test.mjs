import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nuevoProyecto, normalizarProyecto } from '../js/nucleo/proyecto.js';
import { notasAHistorias } from '../js/nucleo/historias.js';
import { DEFINICIONES_INICIALES, definicionesDe, avance, marcar, listaDesdeTexto } from '../js/nucleo/definiciones.js';

test('un proyecto antiguo sin definiciones usa las iniciales', () => {
  const p = nuevoProyecto();
  delete p.definiciones;
  assert.deepEqual(definicionesDe(p), DEFINICIONES_INICIALES);
});

test('marcar y medir el avance; los puntos marcados que ya no existen no cuentan', () => {
  const [h0] = notasAHistorias('- algo útil');
  const lista = ['A', 'B', 'C'];
  let h = marcar(marcar(h0, 'done', 'A', true), 'done', 'Z', true);
  assert.deepEqual(avance(h, lista, 'done'), { hechos: 1, total: 3, faltan: ['B', 'C'], completa: false });
  h = marcar(marcar(marcar(h, 'done', 'B', true), 'done', 'C', true), 'done', 'A', false);
  assert.equal(avance(h, lista, 'done').hechos, 2);
  assert.equal(avance(h, lista, 'ready').hechos, 0);
});

test('listaDesdeTexto limpia viñetas, vacíos y repetidos', () => {
  assert.deepEqual(listaDesdeTexto('- Probado\n\n* Revisado\nProbado\n  '), ['Probado', 'Revisado']);
});

test('definiciones y marcas sobreviven al respaldo, limpias', () => {
  const p = nuevoProyecto();
  p.definiciones = { ready: ['Estimada', 3, 'Estimada'], done: 'no' };
  p.historias = notasAHistorias('- una historia');
  p.historias[0].checks = { ready: ['Estimada', {}], done: null };
  const n = normalizarProyecto(JSON.parse(JSON.stringify(p)));
  assert.deepEqual(n.definiciones.ready, ['Estimada']);
  assert.deepEqual(n.definiciones.done, DEFINICIONES_INICIALES.done);
  assert.deepEqual(n.historias[0].checks, { ready: ['Estimada'], done: [] });
});
