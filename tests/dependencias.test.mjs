import { test } from 'node:test';
import assert from 'node:assert/strict';
import { notasAHistorias, revisarInvest, aHistoria } from '../js/nucleo/historias.js';
import { nuevoProyecto, normalizarProyecto } from '../js/nucleo/proyecto.js';
import {
  dependenciasPendientes, creaCiclo, agregarDependencia, quitarDependencia, bloqueosDelSprint,
} from '../js/nucleo/dependencias.js';
import { aJiraCsv } from '../js/nucleo/exportar.js';

function proyecto() {
  const p = nuevoProyecto();
  p.historias = notasAHistorias('- api de pagos\n- pagar con tarjeta\n- boleta por correo');
  return p;
}

test('agregar, consultar y quitar dependencias', () => {
  let p = proyecto();
  const [api, pagar] = p.historias;
  p = agregarDependencia(p, pagar.id, api.id);
  assert.deepEqual(dependenciasPendientes(p, p.historias[1]).map((x) => x.id), [api.id]);
  p.historias[0].estado = 'done';
  assert.deepEqual(dependenciasPendientes(p, p.historias[1]), [], 'lo terminado no bloquea');
  p = quitarDependencia(p, pagar.id, api.id);
  assert.deepEqual(p.historias[1].dependeDe, []);
});

test('no permite ciclos, ni directos ni indirectos', () => {
  let p = proyecto();
  const [a, b, c] = p.historias.map((x) => x.id);
  p = agregarDependencia(p, b, a);
  p = agregarDependencia(p, c, b);
  assert.equal(creaCiclo(p, a, c), true);
  assert.throws(() => agregarDependencia(p, a, c), /ciclo/);
  assert.equal(creaCiclo(p, a, a), true);
});

test('avisa en el sprint solo si la dependencia no está terminada ni en el mismo sprint', () => {
  let p = proyecto();
  const [api, pagar, boleta] = p.historias.map((x) => x.id);
  p = agregarDependencia(agregarDependencia(p, pagar, api), boleta, pagar);
  p.historias[1].sprintId = 's1';
  p.historias[2].sprintId = 's1';
  const r = bloqueosDelSprint(p, 's1');
  assert.deepEqual(r.map((x) => [x.historia.id, x.espera.map((e) => e.id)]), [[pagar, [api]]], 'boleta espera a pagar, pero están juntas');
});

test('el respaldo limpia dependencias inválidas y rompe ciclos', () => {
  const p = proyecto();
  const [a, b] = p.historias.map((x) => x.id);
  p.historias[0].dependeDe = [b, 'no-existe', a];
  p.historias[1].dependeDe = [a];
  const n = normalizarProyecto(JSON.parse(JSON.stringify(p)));
  const deps = n.historias.map((h) => h.dependeDe);
  assert.ok(!deps[0].includes('no-existe') && !deps[0].includes(a));
  assert.ok(!(deps[0].includes(b) && deps[1].includes(a)), 'no queda el ciclo');
});

test('tipos: INVEST se adapta y Jira recibe el tipo correcto', () => {
  const bug = { ...aHistoria({ texto: 'el total no suma el IVA' }), tipo: 'bug' };
  const codigos = revisarInvest(bug).map((x) => x.codigo);
  assert.ok(!codigos.includes('valor') && !codigos.includes('rol'), 'un bug no necesita "para qué" ni rol');
  assert.ok(codigos.includes('reproducir'));
  const spike = { ...aHistoria({ texto: 'investigar pasarelas de pago' }), tipo: 'spike' };
  assert.ok(revisarInvest(spike).some((x) => x.codigo === 'timebox'));

  const p = proyecto();
  p.historias[0].tipo = 'bug';
  p.historias[1].tipo = 'deuda';
  const csv = aJiraCsv(p);
  assert.ok(csv.includes(',Bug,'));
  assert.ok(csv.includes(',Task,') && csv.includes('deuda-tecnica'));
  const n = normalizarProyecto(JSON.parse(JSON.stringify({ ...p, historias: [{ ...p.historias[0], tipo: 'raro' }] })));
  assert.equal(n.historias[0].tipo, 'historia');
});
