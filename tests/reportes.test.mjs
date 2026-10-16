import { test } from 'node:test';
import assert from 'node:assert/strict';
import { notasAHistorias } from '../js/nucleo/historias.js';
import { nuevoProyecto, nuevoSprint, cambiarEstado, cerrarSprint } from '../js/nucleo/proyecto.js';
import { nuevaRetro, agregarNota, votar, agregarAccion } from '../js/nucleo/retro.js';
import {
  reporteSprint, reporteEpicas, reporteRetro, notasDeVersion, especificacionHistoria, especificacionEpica,
} from '../js/nucleo/reportes.js';

function proyecto() {
  const p = nuevoProyecto('Tienda Ñuñoa');
  p.historias = notasAHistorias(`Pagos:
- Como clienta, quiero pagar con tarjeta, para no transferir
- Como clienta, quiero recibir la boleta por correo, para no guardarla en papel
Catálogo:
- Como clienta, quiero ver los precios, para decidir`);
  [5, 3, 2].forEach((x, i) => { p.historias[i].puntos = x; });
  const s = { ...nuevoSprint(p, { inicio: '2026-03-02', dias: 5 }), objetivo: 'Cobrar en línea', capacidad: 10 };
  p.sprints.push(s);
  p.historias = p.historias.map((h, i) => (i < 2 ? { ...h, sprintId: s.id, estado: 'todo' } : h));
  p.historias[0] = cambiarEstado(p.historias[0], 'done', new Date('2026-03-03T12:00:00Z'));
  return { p, s };
}

test('reporte de sprint: resumen, terminado, pendiente, burndown y acciones de la retro', () => {
  const { p, s } = proyecto();
  let r = nuevaRetro({ ...p, sprints: [{ ...s, estado: 'cerrado' }] });
  r = agregarAccion(r, 'Preparar la demo antes', 'Ana');
  p.retros = [r];
  const md = reporteSprint(p, s.id, new Date('2026-03-04T12:00:00Z'));
  assert.ok(md.startsWith('# Tienda Ñuñoa · Sprint 1'));
  assert.ok(md.includes('> **Objetivo:** Cobrar en línea'));
  assert.ok(md.includes('| Terminado | 5 de 8 puntos (63%) |'));
  assert.ok(md.includes('- [x] **Pagar con tarjeta** (5 pts) · Pagos'));
  assert.ok(md.includes('- [ ] **Recibir la boleta por correo** (3 pts) · Por hacer'));
  assert.ok(md.includes('| 03-03-2026 | 3 |'));
  assert.ok(md.includes('- [ ] Preparar la demo antes · Ana'));
  assert.throws(() => reporteSprint(p, 'nada'), /No existe/);
});

test('avance por épica con barra y lo que falta', () => {
  const { p } = proyecto();
  const md = reporteEpicas(p);
  assert.ok(md.includes('| Pagos | ██████░░░░ 63% | 1/2 | 5/8 | 0 |'));
  assert.ok(md.includes('## Catálogo: lo que falta'));
  assert.ok(!md.includes('Pagar con tarjeta ·'), 'lo terminado no aparece como pendiente');
});

test('retro ordenada por votos', () => {
  const { p } = proyecto();
  let r = agregarNota(agregarNota(nuevaRetro(p), 'mejorar', 'Reuniones largas'), 'mejorar', 'Demo improvisada');
  r = votar(votar(r, r.notas[1].id), r.notas[1].id);
  p.retros = [r];
  const md = reporteRetro(p, r.id);
  assert.ok(md.indexOf('Demo improvisada **(2 votos)**') < md.indexOf('Reuniones largas'));
  assert.ok(md.includes('## Ideas para probar\n\n_Nada._'));
});

test('notas de versión hablan desde quien lo usa', () => {
  const { p, s } = proyecto();
  const md = notasDeVersion(cerrarSprint(p, s.id), { sprintId: s.id });
  assert.ok(md.startsWith('# Novedades de Tienda Ñuñoa · Sprint 1'));
  assert.ok(md.includes('- **Pagar con tarjeta.** Ahora, como clienta, puedes pagar con tarjeta, para no transferir.'));
  assert.ok(!md.includes('boleta'));
});

test('especificación para agente: criterios, DoD, fuera de alcance e instrucciones', () => {
  const { p } = proyecto();
  p.historias.push(...notasAHistorias('Pagos:\n- Como clienta, quiero pagar en cuotas, para comprar más'));
  const md = especificacionHistoria(p, p.historias[1].id);
  assert.ok(md.includes('- Pagar en cuotas'), 'la historia hermana pendiente queda fuera de alcance');
  assert.ok(!md.includes('- Pagar con tarjeta'), 'lo terminado no se lista');
  assert.ok(md.includes('> Como clienta, quiero recibir la boleta por correo, para no guardarla en papel.'));
  assert.ok(md.includes('## Definition of Done'));
  assert.ok(md.includes('## Fuera de alcance'));
  assert.ok(md.includes('- Ver los precios') === false, 'otra épica no es "fuera de alcance"');
  assert.ok(md.includes('**pregunta antes de suponer**'));
});

test('especificación de épica: historias pendientes en orden y aviso de DoR', () => {
  const { p } = proyecto();
  const md = especificacionEpica(p, 'Pagos');
  assert.ok(md.includes('## 1. Recibir la boleta por correo'));
  assert.ok(!md.includes('Pagar con tarjeta'), 'lo terminado no se vuelve a pedir');
  assert.ok(md.includes('no cumple la Definition of Ready'));
  assert.throws(() => especificacionEpica(p, 'Inexistente'), /no tiene historias/);
});
