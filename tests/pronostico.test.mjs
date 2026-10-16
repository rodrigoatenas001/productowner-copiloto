import { test } from 'node:test';
import assert from 'node:assert/strict';
import { notasAHistorias } from '../js/nucleo/historias.js';
import { nuevoProyecto } from '../js/nucleo/proyecto.js';
import { velocidades, escenarios, pronosticar, textoPronostico } from '../js/nucleo/pronostico.js';

/** Proyecto con 3 sprints cerrados de 14 días (10, 20 y 15 puntos) y un backlog pendiente. */
function proyecto() {
  const p = nuevoProyecto('Cliente');
  const cerrados = [['2026-01-05', '2026-01-18', 10], ['2026-01-19', '2026-02-01', 20], ['2026-02-02', '2026-02-15', 15]];
  cerrados.forEach(([inicio, fin, pts], i) => {
    p.sprints.push({ id: `s${i}`, nombre: `Sprint ${i + 1}`, inicio, fin, capacidad: 20, estado: 'cerrado', objetivo: '' });
    p.historias.push({ ...notasAHistorias('- hecha')[0], sprintId: `s${i}`, estado: 'done', puntos: pts === 15 ? 13 : pts, terminada: fin });
    if (pts === 15) p.historias.push({ ...notasAHistorias('- otra hecha')[0], sprintId: `s${i}`, estado: 'done', puntos: 2, terminada: fin });
  });
  const pendientes = notasAHistorias('Pagos:\n- pagar\n- boleta\nReportes:\n- ventas\n- comparar');
  [20, 10, 8, 2].forEach((x, i) => { pendientes[i].puntos = x; });
  p.historias.push(...pendientes);
  return p;
}

test('velocidades y escenarios salen de los sprints cerrados', () => {
  const p = proyecto();
  assert.deepEqual(velocidades(p), [10, 20, 15]);
  assert.deepEqual(escenarios(p), { optimista: 20, probable: 15, pesimista: 10, sprints: 3 });
  assert.equal(escenarios(nuevoProyecto()), null, 'sin sprints cerrados no hay pronóstico');
});

test('pronóstico acumulado en orden del backlog, con fechas por escenario', () => {
  const p = proyecto();
  const r = pronosticar(p, new Date('2026-02-16T10:00:00Z'));
  const [pagos, reportes] = r.epicas;
  // Pagos: 30 pts → optimista 2 sprints, probable 2, pesimista 3
  assert.deepEqual([pagos.optimista.sprints, pagos.probable.sprints, pagos.pesimista.sprints], [2, 2, 3]);
  assert.equal(pagos.probable.fecha, '2026-03-15');
  // Reportes llega después: 40 pts acumulados → 2, 3, 4 sprints
  assert.deepEqual([reportes.optimista.sprints, reportes.probable.sprints, reportes.pesimista.sprints], [2, 3, 4]);
  assert.equal(reportes.pesimista.fecha, '2026-04-12');
  assert.equal(r.total.pendientes, 40);
  assert.equal(textoPronostico(reportes), 'probable 29-03-2026 (entre 15-03-2026 y 12-04-2026)');
});

test('lo del sprint activo queda en el sprint activo y el pronóstico parte después', () => {
  const p = proyecto();
  p.sprints.push({ id: 'act', nombre: 'Sprint 4', inicio: '2026-02-16', fin: '2026-03-01', capacidad: 20, estado: 'activo', objetivo: '' });
  p.historias[p.historias.length - 4].sprintId = 'act'; // "pagar" (20 pts) está en curso
  const r = pronosticar(p, new Date('2026-02-20T10:00:00Z'));
  const pagos = r.epicas.find((e) => e.epica === 'Pagos');
  assert.equal(pagos.pendientes, 10);
  assert.equal(pagos.probable.sprints, 1);
  assert.equal(pagos.probable.fecha, '2026-03-15', 'el primer sprint pronosticado empieza al terminar el activo');
});

test('avisa historias sin estimar y omite "esta vez no"', () => {
  const p = proyecto();
  p.historias[p.historias.length - 1].puntos = null;
  p.historias[p.historias.length - 2].prioridad = 'wont';
  const r = pronosticar(p, new Date('2026-02-16T10:00:00Z'));
  const reportes = r.epicas.find((e) => e.epica === 'Reportes');
  assert.equal(reportes.sinEstimar, 1);
  assert.equal(r.total.pendientes, 30);
});
