import { test } from 'node:test';
import assert from 'node:assert/strict';
import { notasAHistorias, nuevoId } from '../js/nucleo/historias.js';
import { nuevoProyecto, normalizarProyecto, cambiarEstado } from '../js/nucleo/proyecto.js';
import { editarEpica } from '../js/nucleo/okr.js';
import { horizonteDe, roadmap, visionDe } from '../js/nucleo/roadmap.js';

/** Un sprint cerrado de 10 puntos y épicas con distinto trabajo pendiente. */
function proyecto() {
  const p = nuevoProyecto('Cliente');
  p.sprints.push({ id: 's1', nombre: 'Sprint 1', inicio: '2026-01-05', fin: '2026-01-18', capacidad: 10, estado: 'cerrado', objetivo: '' });
  p.historias = notasAHistorias('Base:\n- hecha\nPagos:\n- pagar\nReportes:\n- ventas\nIntegraciones:\n- api\nCierre:\n- terminada');
  const [hecha, pagar, ventas, api, terminada] = p.historias;
  Object.assign(hecha, { sprintId: 's1', estado: 'done', puntos: 10 });
  Object.assign(pagar, { puntos: 5 });
  Object.assign(ventas, { puntos: 20 });
  Object.assign(api, { puntos: 40 });
  Object.assign(terminada, cambiarEstado({ ...terminada, puntos: 3 }, 'done'));
  return p;
}

test('horizonte automático: en sprint abierto → ahora; pronóstico cercano → siguiente; lejano → después', () => {
  const p = proyecto();
  p.sprints.push({ id: 's2', nombre: 'Sprint 2', inicio: '2026-01-19', fin: '2026-02-01', capacidad: 10, estado: 'planificado', objetivo: '' });
  p.historias[1].sprintId = 's2';
  assert.deepEqual(horizonteDe(p, 'Pagos'), { horizonte: 'ahora', automatico: true });
  assert.equal(horizonteDe(p, 'Reportes').horizonte, 'siguiente'); // 25 pts acumulados / 10 = 3 sprints
  assert.equal(horizonteDe(p, 'Integraciones').horizonte, 'despues'); // 65 pts → 7 sprints
});

test('la elección manual manda sobre la automática', () => {
  const p = editarEpica(proyecto(), 'Integraciones', { horizonte: 'ahora' });
  assert.deepEqual(horizonteDe(p, 'Integraciones'), { horizonte: 'ahora', automatico: false });
});

test('el roadmap agrupa y separa lo terminado', () => {
  const r = roadmap(proyecto());
  assert.deepEqual(r.siguiente.map((e) => e.epica), ['Pagos', 'Reportes']);
  assert.deepEqual(r.despues.map((e) => e.epica), ['Integraciones']);
  assert.deepEqual(r.terminadas.map((e) => e.epica), ['Base', 'Cierre']);
  assert.match(r.siguiente[0].pronostico, /^probable/);
});

test('visión, horizonte y resultado de hipótesis sobreviven al respaldo', () => {
  let p = proyecto();
  p.vision = { vision: 'Que cada pyme venda en línea', objetivoProducto: 'Tienda propia en 3 meses' };
  p = editarEpica(p, 'Pagos', { horizonte: 'ahora', resultadoHipotesis: 'parcial', datoReal: 'conversión 3%' });
  p = editarEpica(p, 'Reportes', { horizonte: 'nunca', resultadoHipotesis: 'quizás' });
  const n = normalizarProyecto(JSON.parse(JSON.stringify(p)));
  assert.deepEqual(visionDe(n), { vision: 'Que cada pyme venda en línea', objetivoProducto: 'Tienda propia en 3 meses' });
  assert.equal(n.epicasInfo.Pagos.horizonte, 'ahora');
  assert.equal(n.epicasInfo.Pagos.resultadoHipotesis, 'parcial');
  assert.equal(n.epicasInfo.Reportes.horizonte, '');
  assert.equal(n.epicasInfo.Reportes.resultadoHipotesis, 'pendiente');
  assert.ok(nuevoId());
});

test('reporte de roadmap en Markdown con visión y horizontes', async () => {
  const { reporteRoadmap } = await import('../js/nucleo/reportes.js');
  const p = proyecto();
  p.vision = { vision: 'Que cada pyme venda en línea', objetivoProducto: 'Tienda propia en 3 meses' };
  const md = reporteRoadmap(p);
  assert.ok(md.includes('**Visión:** Que cada pyme venda en línea'));
  assert.ok(md.includes('## Ahora\n\n_Sin épicas._'));
  assert.ok(md.includes('### Pagos · 0%'));
  assert.ok(md.includes('**Terminado:** Base, Cierre.'));
  assert.ok(md.includes('no un compromiso'));
});

test('el feedback de la Review se vuelve historias que recuerdan su origen', async () => {
  const { feedbackAHistorias } = await import('../js/nucleo/proyecto.js');
  const p = proyecto();
  const hs = feedbackAHistorias(p, 's1', '- que el reporte se pueda filtrar por sucursal\n- el botón de pago no se ve en celular');
  assert.equal(hs.length, 2);
  assert.equal(hs[0].estado, 'backlog');
  assert.ok(hs[0].notaOriginal.startsWith('Feedback de la Review de Sprint 1: '));
});
