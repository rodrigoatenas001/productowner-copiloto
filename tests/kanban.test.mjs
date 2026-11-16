import { test } from 'node:test';
import assert from 'node:assert/strict';
import { itemsTablero, traerAlTablero, usoWipKanban, metricasKanban, flujoAcumulado, cambiarModo, percentil, esKanban } from '../js/nucleo/kanban.js';
import { nuevoProyecto, normalizarProyecto } from '../js/nucleo/proyecto.js';
import { resumenDaily } from '../js/nucleo/daily.js';

const ahora = new Date('2026-11-16T12:00:00');
const h = (id, cambios) => ({ id, titulo: id, estado: 'backlog', sprintId: null, puntos: 3, creada: '2026-10-01T09:00:00.000Z', ...cambios });

function proyecto() {
  const p = nuevoProyecto('Soporte de planta');
  p.flujo = { ...p.flujo, modo: 'kanban', wip: { doing: 2, review: null } };
  p.historias = [
    h('pendiente', {}),
    h('por hacer', { estado: 'todo', entrada: '2026-11-14T09:00:00.000Z' }),
    h('en curso 1', { estado: 'doing', entrada: '2026-11-10T09:00:00.000Z', iniciada: '2026-11-12T09:00:00.000Z' }),
    h('en curso 2', { estado: 'doing', entrada: '2026-11-11T09:00:00.000Z', iniciada: '2026-11-13T09:00:00.000Z' }),
    h('en curso 3', { estado: 'doing', entrada: '2026-11-11T09:00:00.000Z', iniciada: '2026-11-15T09:00:00.000Z' }),
    h('hecha reciente', { estado: 'done', entrada: '2026-11-02T09:00:00.000Z', iniciada: '2026-11-04T09:00:00.000Z', terminada: '2026-11-06T09:00:00.000Z' }),
    h('hecha antigua', { estado: 'done', entrada: '2026-10-01T09:00:00.000Z', iniciada: '2026-10-05T09:00:00.000Z', terminada: '2026-10-15T09:00:00.000Z' }),
  ];
  return p;
}

test('tablero continuo: lo terminado hace más de 14 días se archiva; el backlog no está en el tablero', () => {
  const { visibles, archivadas } = itemsTablero(proyecto(), ahora);
  assert.deepEqual(visibles.map((x) => x.id), ['por hacer', 'en curso 1', 'en curso 2', 'en curso 3', 'hecha reciente']);
  assert.equal(archivadas, 1);
});

test('pull desde el backlog anota la entrada; el límite de trabajo en curso se cuenta en el tablero', () => {
  const p = traerAlTablero(proyecto(), ['pendiente'], ahora);
  const traida = p.historias.find((x) => x.id === 'pendiente');
  assert.equal(traida.estado, 'todo');
  assert.equal(traida.entrada, ahora.toISOString());
  assert.deepEqual(usoWipKanban(p, 'doing'), { cuenta: 3, limite: 2, excede: true });
});

test('métricas de flujo: en curso, edad, rendimiento por semana, entrega y ciclo con percentil 85', () => {
  const m = metricasKanban(proyecto(), ahora);
  assert.equal(m.enCurso, 3);
  assert.equal(m.terminadas, 2);
  assert.deepEqual(m.entrega, { promedio: 9, p85: 14 }, 'de la entrada al tablero hasta terminar');
  assert.deepEqual(m.ciclo, { promedio: 6, p85: 10 }, 'de empezar a terminar');
  assert.equal(m.porSemana.length, 8);
  assert.equal(m.porSemana.reduce((t, s) => t + s.terminadas, 0), 2);
  assert.equal(percentil([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 85), 9);
});

test('flujo acumulado: cada día cuenta por hacer, en curso y hecho', () => {
  const cfd = flujoAcumulado(proyecto(), ahora, 30);
  assert.equal(cfd.length, 30);
  assert.deepEqual(cfd.at(-1), { dia: '2026-11-16', porHacer: 1, enCurso: 3, hecho: 2 });
  const d14 = cfd.find((x) => x.dia === '2026-11-14');
  assert.deepEqual([d14.porHacer, d14.enCurso, d14.hecho], [2, 2, 2], '«en curso 3» aún no empezaba');
});

test('cambiar de modo: a Kanban cierra el sprint y pasa lo pendiente al tablero; a Scrum lo devuelve al backlog', () => {
  let p = nuevoProyecto('X');
  p.sprints = [{ id: 's1', nombre: 'Sprint 1', estado: 'activo', inicio: '2026-11-10', fin: '2026-11-21' }];
  p.historias = [h('a', { estado: 'doing', sprintId: 's1', iniciada: '2026-11-11T09:00:00.000Z' }), h('b', { estado: 'done', sprintId: 's1', terminada: '2026-11-12T09:00:00.000Z' })];
  p = cambiarModo(p, 'kanban', ahora);
  assert.ok(esKanban(p));
  assert.equal(p.sprints[0].estado, 'cerrado');
  assert.equal(p.historias[0].sprintId, null);
  assert.equal(p.historias[1].sprintId, 's1', 'lo terminado queda en su sprint, como historia');
  p = cambiarModo(p, 'scrum', ahora);
  assert.equal(p.historias[0].estado, 'backlog');
  assert.equal(normalizarProyecto(JSON.parse(JSON.stringify(cambiarModo(p, 'kanban', ahora)))).flujo.modo, 'kanban', 'el modo se guarda');
});

test('la Daily también sirve en el tablero continuo', () => {
  const r = resumenDaily(proyecto(), { id: null, nombre: 'Tablero', objetivo: '', ultimaDaily: null }, ahora);
  assert.deepEqual(r.enCurso.map((x) => x.historia.id), ['en curso 1', 'en curso 2', 'en curso 3']);
  assert.deepEqual(r.porEmpezar.map((x) => x.id), ['por hacer'], 'el backlog no cuenta');
  assert.equal(r.ritmo, null, 'sin sprint no hay burndown');
});

test('un intervalo con las fechas al revés no cuenta como 0 días', () => {
  const p = proyecto();
  p.historias.push(h('rara', { estado: 'done', creada: '2026-11-16T09:00:00.000Z', terminada: '2026-11-01T09:00:00.000Z' }));
  assert.deepEqual(metricasKanban(p, ahora).entrega, { promedio: 9, p85: 14 });
});
