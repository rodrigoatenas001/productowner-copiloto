import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumenDaily, dailyMarkdown } from '../js/nucleo/daily.js';
import { nuevoProyecto } from '../js/nucleo/proyecto.js';

const ahora = new Date('2026-11-10T12:00:00');
const sprint = { id: 's1', nombre: 'Sprint 1', objetivo: 'Agendar en línea', inicio: '2026-11-03', fin: '2026-11-14', estado: 'activo', capacidad: 20 };
const h = (titulo, cambios) => ({ id: titulo, titulo, sprintId: 's1', puntos: 5, estado: 'todo', ...cambios });

function proyecto() {
  const p = nuevoProyecto('Taller');
  p.sprints = [sprint];
  p.historias = [
    h('Ver agenda', { estado: 'done', iniciada: '2026-11-05T10:00:00', terminada: '2026-11-09T18:00:00' }),
    h('Reservar hora', { estado: 'doing', iniciada: '2026-11-04T09:00:00' }),
    h('Avisar listo', { estado: 'doing', iniciada: '2026-11-10T08:00:00' }),
    h('Pagar abono', { estado: 'todo', bloqueo: { motivo: 'Falta la cuenta de la pasarela', desde: '2026-11-08T12:00:00' } }),
    h('Reportes', { estado: 'todo' }),
    h('Otro sprint', { sprintId: 's2', estado: 'doing', iniciada: '2026-11-01T00:00:00' }),
  ];
  return p;
}

test('Daily: terminado en las últimas 24 h, en curso con sus días, bloqueos y lo que falta empezar', () => {
  const r = resumenDaily(proyecto(), sprint, ahora);
  assert.deepEqual(r.terminadas.map((x) => x.titulo), ['Ver agenda']);
  assert.deepEqual(r.enCurso.map((x) => [x.historia.titulo, x.dias]), [['Reservar hora', 6], ['Avisar listo', 0]]);
  assert.deepEqual(r.estancadas.map((x) => x.titulo), ['Reservar hora'], 'más de 3 días en curso merece la pregunta');
  assert.deepEqual(r.bloqueadas.map((x) => [x.historia.titulo, x.dias]), [['Pagar abono', 2]]);
  assert.deepEqual(r.porEmpezar.map((x) => x.titulo), ['Reportes']);
  assert.equal(r.ritmo, 'atrasado', 'faltan 20 de 25 puntos con más de la mitad del sprint');
});

test('Daily: «Daily hecha» marca el corte para lo terminado', () => {
  const r = resumenDaily(proyecto(), { ...sprint, ultimaDaily: '2026-11-09T20:00:00' }, ahora);
  assert.deepEqual(r.terminadas, [], 'lo terminado antes de la última Daily ya se contó');
});

test('Daily en Markdown para el chat del equipo', () => {
  const md = dailyMarkdown(proyecto(), sprint, ahora);
  assert.ok(md.startsWith('## Daily · Sprint 1 · '));
  assert.ok(md.includes('**Objetivo del sprint:** Agendar en línea'));
  assert.ok(md.includes('- Reservar hora (6 días, ¿sigue avanzando?)'));
  assert.ok(md.includes('- Pagar abono: Falta la cuenta de la pasarela (2 días)'));
  assert.ok(md.includes('_Por empezar: 1._'));
});
