import { test } from 'node:test';
import assert from 'node:assert/strict';
import { notasAHistorias } from '../js/nucleo/historias.js';
import {
  nuevoProyecto, nuevoSprint, normalizarProyecto, mover, cambiarEstado, velocidad, sugerirSprint,
  burndown, resumenSprint, cerrarSprint, necesitaRespaldo, resumenEpicas, mapaHistorias, moverEnMapa,
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

test('Jira CSV: épicas como incidencias, historias enlazadas por Parent ID y sprint', () => {
  const p = proyectoDeEjemplo();
  const s = nuevoSprint(p);
  p.sprints.push(s);
  p.historias[0].sprintId = s.id;
  const filas = aJiraCsv(p).split('\r\n');
  assert.equal(filas[0], 'Issue ID,Parent ID,Summary,Description,Issue Type,Story Points,Priority,Labels,Sprint');
  assert.ok(filas[1].startsWith('1,,Pagos,'));
  assert.ok(filas[1].includes(',Epic,'));
  assert.ok(filas[2].startsWith('2,1,'), 'la primera historia apunta a la épica 1');
  assert.ok(filas[2].endsWith(',Story,5,High,pagos,Sprint 1'));
  assert.equal(filas.length, 1 + 1 + 4);
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

test('recuerda respaldar solo cuando hay trabajo sin respaldo reciente', () => {
  const p = proyectoDeEjemplo();
  assert.equal(necesitaRespaldo(p), false); // 4 historias: aún poco
  p.historias.push(...notasAHistorias('- quinta historia'));
  assert.equal(necesitaRespaldo(p), true);

  p.respaldado = '2026-03-01T10:00:00Z';
  p.actualizado = '2026-03-10T10:00:00Z';
  assert.equal(necesitaRespaldo(p, new Date('2026-03-10T12:00:00Z')), false); // respaldo de hace 9 días
  assert.equal(necesitaRespaldo(p, new Date('2026-03-20T12:00:00Z')), true);
  p.actualizado = '2026-02-28T10:00:00Z';
  assert.equal(necesitaRespaldo(p, new Date('2026-03-20T12:00:00Z')), false); // sin cambios desde el respaldo
});

test('resumenEpicas mide el avance en puntos y respeta el orden del backlog', () => {
  const p = proyectoDeEjemplo(); // Pagos: 5, 3, 8, 2
  p.historias.push(...notasAHistorias('Reportes:\n- ver ventas'));
  p.historias[0] = cambiarEstado(p.historias[0], 'done');
  const [pagos, reportes] = resumenEpicas(p);
  assert.equal(pagos.epica, 'Pagos');
  assert.equal(pagos.puntos, 18);
  assert.equal(pagos.puntosHechos, 5);
  assert.equal(pagos.avance, 28);
  assert.equal(reportes.sinEstimar, 1);
  assert.equal(reportes.avance, 0);
});

test('mapa de historias: épicas como columnas, prioridades como versiones', () => {
  const p = proyectoDeEjemplo(); // 4 historias de Pagos, todas "should"
  p.historias.push(...notasAHistorias('- sin épica'));
  p.historias[0].prioridad = 'must';
  const m = mapaHistorias(p);
  assert.deepEqual(m.epicas, ['Pagos', '']);
  assert.equal(m.filas[0].celdas.Pagos.length, 1);
  assert.equal(m.filas[0].puntos, 5);
  assert.equal(m.filas[1].celdas.Pagos.length, 3);
  assert.equal(m.filas[1].celdas[''].length, 1);

  const movidas = moverEnMapa(p.historias, p.historias[4].id, 'Pagos', 'could');
  assert.deepEqual([movidas[4].epica, movidas[4].prioridad], ['Pagos', 'could']);
});
