import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nuevoProyecto, nuevoSprint, normalizarProyecto } from '../js/nucleo/proyecto.js';
import {
  nuevaRetro, agregarNota, votar, quitarNota, notasDe, agregarAccion, alternarAccion, accionesPendientes,
} from '../js/nucleo/retro.js';

test('la retro se asocia al último sprint cerrado', () => {
  const p = nuevoProyecto('X');
  assert.equal(nuevaRetro(p).sprintId, null);
  const s = { ...nuevoSprint(p), estado: 'cerrado' };
  p.sprints.push(s);
  const r = nuevaRetro(p);
  assert.equal(r.sprintId, s.id);
  assert.equal(r.titulo, 'Retro de Sprint 1');
});

test('notas: ignora vacías o columnas inválidas, ordena por votos y no baja de cero', () => {
  let r = nuevaRetro(nuevoProyecto());
  r = agregarNota(r, 'bien', 'Buena comunicación');
  r = agregarNota(r, 'bien', 'Daily corta');
  r = agregarNota(r, 'bien', '   ');
  r = agregarNota(r, 'otra', 'x');
  assert.equal(r.notas.length, 2);
  const daily = r.notas[1].id;
  r = votar(votar(r, daily), daily);
  r = votar(r, r.notas[0].id, -1);
  assert.deepEqual(notasDe(r, 'bien').map((n) => [n.texto, n.votos]), [['Daily corta', 2], ['Buena comunicación', 0]]);
  r = quitarNota(r, daily);
  assert.equal(r.notas.length, 1);
});

test('las acciones pendientes de retros anteriores se arrastran', () => {
  let r1 = agregarAccion(nuevaRetro(nuevoProyecto()), 'Limitar el WIP a 3', 'Ana');
  r1 = agregarAccion(r1, 'Daily a las 9:30');
  r1 = alternarAccion(r1, r1.acciones[1].id);
  const r2 = nuevaRetro(nuevoProyecto());
  const pendientes = accionesPendientes([r1, r2], r2.id);
  assert.deepEqual(pendientes.map((a) => [a.texto, a.responsable]), [['Limitar el WIP a 3', 'Ana']]);
});

test('las retros sobreviven al respaldo y se limpian al importar', () => {
  const p = nuevoProyecto();
  p.retros = [agregarNota(nuevaRetro(p), 'mejorar', 'Menos reuniones'), { titulo: 'rota', notas: [{ columna: 'x', texto: 'y' }], acciones: 'no' }];
  const n = normalizarProyecto(JSON.parse(JSON.stringify(p)));
  assert.equal(n.retros.length, 2);
  assert.equal(n.retros[0].notas[0].texto, 'Menos reuniones');
  assert.deepEqual(n.retros[1].notas, []);
  assert.deepEqual(n.retros[1].acciones, []);
});
