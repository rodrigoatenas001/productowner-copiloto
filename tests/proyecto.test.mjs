import { test } from 'node:test';
import assert from 'node:assert/strict';
import { notasAHistorias } from '../js/nucleo/historias.js';
import {
  nuevoProyecto, nuevoSprint, normalizarProyecto, mover, cambiarEstado, velocidad, sugerirSprint,
  burndown, resumenSprint, cerrarSprint,
} from '../js/nucleo/proyecto.js';
import { aCsv, aJiraCsv, aMarkdown, celdaCsv, nombreArchivo } from '../js/nucleo/exportar.js';

function proyectoDeEjemplo() {
  const p = nuevoProyecto('Tienda Ñuñoa');
  p.historias = notasAHistorias('Pagos:\n- pagar con tarjeta para comprar rápido\n- ver boletas\n- exportar ventas\n- enviar avisos');
  [5, 3, 8, 2].forEach((pts, i) => { p.historias[i].puntos = pts; });
  return p;
}

test('sugerirSprint respeta el orden y salta lo que no cabe', () => {
  const p = proyectoDeEjemplo();
  const { ids, puntos } = sugerirSprint(p, 10);
  // 5 + 3 = 8; el 8 no cabe; el 2 sí → 10
  assert.deepEqual(ids, [p.historias[0].id, p.historias[1].id, p.historias[3].id]);
  assert.equal(puntos, 10);
});

test('sugerirSprint ignora historias sin estimar y las "esta vez no"', () => {
  const p = proyectoDeEjemplo();
  p.historias[0].puntos = null;
  p.historias[1].prioridad = 'wont';
  assert.deepEqual(sugerirSprint(p, 100).ids, [p.historias[2].id, p.historias[3].id]);
});

test('mover reordena dentro de los límites', () => {
  const p = proyectoDeEjemplo();
  const ultimo = p.historias[3].id;
  assert.equal(mover(p.historias, ultimo, 0)[0].id, ultimo);
  assert.equal(mover(p.historias, ultimo, 99)[3].id, ultimo);
  assert.equal(mover(p.historias, 'no-existe', 0).length, 4);
});

test('cerrar un sprint devuelve lo pendiente al inicio del backlog y la velocidad se calcula', () => {
  let p = proyectoDeEjemplo();
  const s = nuevoSprint(p, { capacidad: 10 });
  p.sprints.push(s);
  p.historias = p.historias.map((h, i) => (i < 2 ? { ...h, sprintId: s.id, estado: 'todo' } : h));
  p.historias[0] = cambiarEstado(p.historias[0], 'done');

  p = cerrarSprint(p, s.id);
  assert.equal(p.sprints[0].estado, 'cerrado');
  assert.equal(p.historias[0].estado, 'backlog');
  assert.equal(p.historias[0].sprintId, null);
  assert.equal(velocidad(p), 5);
  assert.equal(nuevoSprint(p).capacidad, 5);
});

test('burndown baja cuando se terminan historias y no inventa días futuros', () => {
  const p = proyectoDeEjemplo();
  const s = nuevoSprint(p, { inicio: '2026-03-02', dias: 5 });
  p.historias = p.historias.map((h, i) => (i < 2 ? { ...h, sprintId: s.id } : h));
  p.historias[0] = cambiarEstado(p.historias[0], 'done', new Date('2026-03-03T15:00:00Z'));

  const datos = burndown(s, p.historias, new Date('2026-03-04T12:00:00Z'));
  assert.deepEqual(datos.map((d) => d.pendiente), [8, 3, 3, null, null]);
  assert.equal(datos[0].ideal, 8);
  assert.equal(datos[4].ideal, 0);
});

test('resumenSprint detecta sobrecarga e historias sin estimar', () => {
  const p = proyectoDeEjemplo();
  const s = nuevoSprint(p, { capacidad: 6 });
  p.historias = p.historias.map((h) => ({ ...h, sprintId: s.id }));
  p.historias[3].puntos = null;
  const r = resumenSprint(s, p.historias);
  assert.equal(r.puntos, 16);
  assert.equal(r.sinEstimar, 1);
  assert.equal(r.sobrecarga, true);
});

test('normalizarProyecto limpia un respaldo y rechaza archivos ajenos', () => {
  const sucio = {
    nombre: 'X', historias: [{ titulo: 'a', puntos: 4, prioridad: 'urgente', estado: 'raro', sprintId: 'nada', criterios: ['ok', 5, ''], extra: '<script>' }],
    sprints: [{ id: 's1', inicio: 'ayer', capacidad: -3 }],
  };
  const p = normalizarProyecto(sucio);
  const h = p.historias[0];
  assert.equal(h.puntos, null);
  assert.equal(h.prioridad, 'should');
  assert.equal(h.estado, 'backlog');
  assert.equal(h.sprintId, null);
  assert.deepEqual(h.criterios, ['ok']);
  assert.equal('extra' in h, false);
  assert.equal(p.sprints[0].capacidad, null);
  assert.match(p.sprints[0].inicio, /^\d{4}-\d{2}-\d{2}$/);

  assert.throws(() => normalizarProyecto({ cosas: [] }), /no es un respaldo/);
  assert.throws(() => normalizarProyecto({ version: 99, historias: [] }), /más nueva/);
});

test('el respaldo exportado se vuelve a importar igual', () => {
  const p = proyectoDeEjemplo();
  const otra = normalizarProyecto(JSON.parse(JSON.stringify(p)));
  assert.deepEqual(otra.historias.map((h) => [h.id, h.quiero, h.puntos]), p.historias.map((h) => [h.id, h.quiero, h.puntos]));
});

test('CSV escapa comillas, saltos y fórmulas', () => {
  assert.equal(celdaCsv('=SUMA(A1)'), "'=SUMA(A1)");
  assert.equal(celdaCsv('dijo "hola", y'), '"dijo ""hola"", y"');
  const csv = aCsv(proyectoDeEjemplo());
  assert.ok(csv.startsWith('﻿Título,Historia'));
  assert.equal(csv.split('\r\n').length, 5);
});

test('Jira CSV usa columnas estándar y etiqueta la épica', () => {
  const csv = aJiraCsv(proyectoDeEjemplo());
  assert.ok(csv.startsWith('Summary,Description,Issue Type,Story Points,Priority,Labels'));
  assert.ok(csv.includes(',Story,5,High,pagos'));
});

test('Markdown agrupa por épica con criterios como casillas', () => {
  const md = aMarkdown(proyectoDeEjemplo());
  assert.ok(md.startsWith('# Tienda Ñuñoa'));
  assert.ok(md.includes('## Pagos'));
  assert.ok(md.includes('- [ ] Dado que'));
});

test('nombreArchivo quita acentos y espacios', () => {
  assert.match(nombreArchivo(nuevoProyecto('Tienda Ñuñoa 2.0'), 'json'), /^tienda-nunoa-2-0-\d{4}-\d{2}-\d{2}\.json$/);
});
