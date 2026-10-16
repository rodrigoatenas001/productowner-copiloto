import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CASOS, evaluarEjercicio } from '../js/nucleo/ejercicios.js';

test('los casos están completos y su ejemplo de solución cubre todo con buena calidad', () => {
  for (const caso of CASOS) {
    assert.ok(caso.contexto.length > 80 && caso.necesidades.length >= 3, caso.id);
    const r = evaluarEjercicio(caso, caso.ejemplo.join('\n'));
    const faltan = r.cobertura.filter((c) => !c.cubierta).map((c) => c.nombre);
    // El ejemplo debe ser un modelo a seguir: alta calidad y casi toda la cobertura
    assert.ok(r.calidadPromedio >= 80, `${caso.id}: calidad ${r.calidadPromedio}`);
    assert.ok(faltan.length <= 1, `${caso.id}: faltan ${faltan.join(', ')}`);
  }
});

test('una respuesta floja recibe puntaje bajo y comentarios concretos', () => {
  const caso = CASOS.find((c) => c.id === 'pasteleria');
  const r = evaluarEjercicio(caso, 'hacer una app rápida y bonita\nque tenga de todo');
  assert.ok(r.puntaje < 50, `puntaje ${r.puntaje}`);
  assert.ok(r.comentarios.some((c) => c.includes('para qué')));
  assert.ok(r.comentarios.some((c) => c.includes('sin cubrir')));
});

test('sin texto no hay puntaje', () => {
  const r = evaluarEjercicio(CASOS[0], '   ');
  assert.equal(r.puntaje, 0);
  assert.match(r.comentarios[0], /al menos una historia/);
});

test('la cobertura no depende de acentos ni mayúsculas', () => {
  const caso = CASOS.find((c) => c.id === 'clinica');
  const r = evaluarEjercicio(caso, 'Como paciente quiero recibir un RECORDATORIO para no faltar');
  assert.ok(r.cobertura.find((c) => c.nombre === 'Recordatorio o confirmación').cubierta);
});
