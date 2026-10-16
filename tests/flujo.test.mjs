import { test } from 'node:test';
import assert from 'node:assert/strict';
import { notasAHistorias } from '../js/nucleo/historias.js';
import { nuevoProyecto, normalizarProyecto, cambiarEstado } from '../js/nucleo/proyecto.js';
import {
  columnasDe, usoWip, tiempoCiclo, cicloPromedio, bloquear, desbloquear, diasBloqueada,
} from '../js/nucleo/flujo.js';

test('la columna de revisión es opcional', () => {
  const p = nuevoProyecto();
  assert.deepEqual(columnasDe(p), ['todo', 'doing', 'done']);
  p.flujo.revision = true;
  assert.deepEqual(columnasDe(p), ['todo', 'doing', 'review', 'done']);
});

test('límite WIP: cuenta lo que está en la columna y avisa al pasarse', () => {
  const p = nuevoProyecto();
  p.flujo.wip.doing = 2;
  p.historias = notasAHistorias('- a a\n- b b\n- c c').map((h) => ({ ...h, sprintId: 's1', estado: 'doing' }));
  assert.deepEqual(usoWip(p, 's1', 'doing'), { cuenta: 3, limite: 2, excede: true });
  assert.deepEqual(usoWip(p, 's1', 'review'), { cuenta: 0, limite: null, excede: false });
});

test('tiempo de ciclo: desde que se empieza hasta que se termina; se reinicia si vuelve a por hacer', () => {
  let [h] = notasAHistorias('- algo útil');
  h = cambiarEstado(h, 'doing', new Date('2026-03-02T09:00:00Z'));
  h = cambiarEstado(h, 'review', new Date('2026-03-03T09:00:00Z'));
  h = cambiarEstado(h, 'done', new Date('2026-03-05T21:00:00Z'));
  assert.equal(tiempoCiclo(h), 3.5);
  const reiniciada = cambiarEstado(cambiarEstado(h, 'todo'), 'doing', new Date('2026-03-10T09:00:00Z'));
  assert.equal(reiniciada.iniciada, '2026-03-10T09:00:00.000Z');
  assert.equal(tiempoCiclo(reiniciada), null);
  assert.equal(cicloPromedio([h, { ...h, iniciada: '2026-03-01T00:00:00Z', terminada: '2026-03-02T00:00:00Z' }, reiniciada]), 2.3);
});

test('bloquear exige motivo; al terminar se desbloquea sola', () => {
  const [h] = notasAHistorias('- algo útil');
  assert.throws(() => bloquear(h, '  '), /qué la bloquea/);
  const b = bloquear(h, 'Esperando credenciales del cliente', new Date('2026-03-01T10:00:00Z'));
  assert.equal(diasBloqueada(b, new Date('2026-03-04T09:00:00Z')), 2);
  assert.equal(desbloquear(b).bloqueo, null);
  assert.equal(cambiarEstado(b, 'done').bloqueo, null);
  assert.equal(cambiarEstado(b, 'doing').bloqueo.motivo, 'Esperando credenciales del cliente');
});

test('flujo, bloqueos y fechas sobreviven al respaldo, limpios', () => {
  const p = nuevoProyecto();
  p.flujo = { revision: true, wip: { doing: 3, review: -1 } };
  p.historias = notasAHistorias('- a a\n- b b');
  p.historias[0] = bloquear(cambiarEstado(p.historias[0], 'doing'), 'API caída');
  p.historias[1].bloqueo = { motivo: '' };
  p.historias[1].estado = 'review';
  const n = normalizarProyecto(JSON.parse(JSON.stringify(p)));
  assert.deepEqual(n.flujo, { revision: true, wip: { doing: 3, review: null } });
  assert.equal(n.historias[0].bloqueo.motivo, 'API caída');
  assert.ok(n.historias[0].iniciada);
  assert.equal(n.historias[1].bloqueo, null);
  assert.equal(n.historias[1].estado, 'review');
});
