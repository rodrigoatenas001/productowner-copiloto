import { test } from 'node:test';
import assert from 'node:assert/strict';
import { notasAHistorias } from '../js/nucleo/historias.js';
import { nuevoProyecto, nuevoSprint } from '../js/nucleo/proyecto.js';
import { editarEpica } from '../js/nucleo/okr.js';
import { sugerirObjetivo } from '../js/nucleo/objetivo.js';

function proyecto() {
  const p = nuevoProyecto('Tienda');
  p.historias = notasAHistorias(`Pagos:
- Como clienta, quiero pagar con tarjeta, para no transferir
- Como clienta, quiero guardar mi tarjeta, para comprar más rápido
- Como clienta, quiero ver mis pagos, para controlar gastos
Catálogo:
- Como clienta, quiero ver precios, para decidir`);
  const s = nuevoSprint(p);
  p.sprints.push(s);
  p.historias = p.historias.map((h, i) => ({ ...h, sprintId: s.id, puntos: [5, 3, 2, 8][i] }));
  p.historias[0].prioridad = 'must';
  return { p, s };
}

test('elige la épica con más puntos y sus dos historias más importantes', () => {
  const { p, s } = proyecto(); // Pagos: 10 pts > Catálogo: 8 pts
  assert.equal(sugerirObjetivo(p, s.id), 'Que la clienta pueda pagar con tarjeta y guardar su tarjeta, para no transferir.');
});

test('usa lo que la hipótesis de la épica dice que lograremos', () => {
  const { p, s } = proyecto();
  const conHipotesis = editarEpica(p, 'Pagos', { lograremos: 'que más visitas terminen comprando' });
  assert.match(sugerirObjetivo(conHipotesis, s.id), /, para que más visitas terminen comprando\.$/);
});

test('rol genérico y sprint vacío', () => {
  const p = nuevoProyecto();
  const s = nuevoSprint(p);
  p.sprints.push(s);
  assert.equal(sugerirObjetivo(p, s.id), null);
  p.historias = notasAHistorias('- exportar el reporte').map((h) => ({ ...h, sprintId: s.id }));
  assert.equal(sugerirObjetivo(p, s.id), 'Que las personas usuarias puedan exportar el reporte.');
});
