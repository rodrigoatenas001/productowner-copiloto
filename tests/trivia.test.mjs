import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PREGUNTAS, TEMAS } from '../js/nucleo/preguntas.js';
import {
  barajar, crearPartida, puntajeAcierto, registrarRespuestas, siguientePregunta, ranking, validarPreguntas,
} from '../js/nucleo/trivia.js';

test('el banco incluido está bien formado y cubre todos los temas', () => {
  assert.ok(PREGUNTAS.length >= 30);
  for (const p of PREGUNTAS) {
    assert.ok(p.tema in TEMAS, p.texto);
    assert.ok(p.opciones.length >= 2 && p.opciones.length <= 4, p.texto);
    assert.ok(p.correcta >= 0 && p.correcta < p.opciones.length, p.texto);
    assert.ok(p.explicacion.length > 10, p.texto);
  }
  for (const tema of Object.keys(TEMAS)) assert.ok(PREGUNTAS.some((p) => p.tema === tema), tema);
  assert.equal(new Set(PREGUNTAS.map((p) => p.texto)).size, PREGUNTAS.length, 'sin preguntas repetidas');
});

test('barajar con la misma semilla da el mismo orden y no pierde elementos', () => {
  const a = barajar([1, 2, 3, 4, 5, 6], 42);
  assert.deepEqual(a, barajar([1, 2, 3, 4, 5, 6], 42));
  assert.deepEqual([...a].sort(), [1, 2, 3, 4, 5, 6]);
});

test('crearPartida filtra por tema, limita cantidad y limpia equipos', () => {
  const p = crearPartida(PREGUNTAS, { equipos: [' Rojo ', 'Azul', 'Rojo', ''], temas: ['jira'], cantidad: 3, semilla: 1 });
  assert.deepEqual(p.equipos.map((e) => e.nombre), ['Rojo', 'Azul']);
  assert.equal(p.preguntas.length, 3);
  assert.ok(p.preguntas.every((q) => q.tema === 'jira'));
  assert.throws(() => crearPartida(PREGUNTAS, { equipos: [] }), /al menos un equipo/);
  assert.throws(() => crearPartida(PREGUNTAS, { equipos: ['A'], temas: ['nada'] }), /No hay preguntas/);
});

test('el puntaje premia la rapidez y la racha', () => {
  assert.equal(puntajeAcierto(20, 20), 1000);
  assert.equal(puntajeAcierto(0, 20), 500);
  assert.equal(puntajeAcierto(10, 20), 750);
  assert.equal(puntajeAcierto(20, 20, 3), 1300);
  assert.equal(puntajeAcierto(20, 20, 9), 1500);
});

test('una partida completa: respuestas, rachas, fases y ranking', () => {
  let p = crearPartida(PREGUNTAS, { equipos: ['Rojo', 'Azul'], cantidad: 2, segundos: 20, semilla: 7 });
  p = registrarRespuestas(p, ['Rojo'], 20);
  assert.equal(p.fase, 'respuesta');
  assert.equal(registrarRespuestas(p, ['Azul'], 20), p, 'no se puntúa dos veces la misma pregunta');
  p = siguientePregunta(p);
  assert.equal(p.fase, 'pregunta');
  p = registrarRespuestas(p, ['Rojo', 'Azul'], 10);
  p = siguientePregunta(p);
  assert.equal(p.fase, 'final');
  const [primero, segundo] = ranking(p);
  assert.equal(primero.nombre, 'Rojo');
  assert.equal(primero.puntos, 1000 + 850); // segunda con racha 1: 750 + 100
  assert.equal(segundo.puntos, 750);
  assert.equal(primero.aciertos, 2);
});

test('validarPreguntas acepta lista o {preguntas} y descarta las mal formadas', () => {
  const { preguntas, descartadas } = validarPreguntas({ preguntas: [
    { texto: '¿2+2?', opciones: ['3', '4'], correcta: 1 },
    { texto: 'sin opciones', opciones: ['a'], correcta: 0 },
    { texto: 'correcta fuera', opciones: ['a', 'b'], correcta: 5 },
  ] });
  assert.equal(preguntas.length, 1);
  assert.equal(preguntas[0].tema, 'propias');
  assert.equal(descartadas, 2);
  assert.throws(() => validarPreguntas({ x: 1 }), /lista de preguntas/);
});
