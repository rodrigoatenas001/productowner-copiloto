import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  desafioPronostico, evaluarPronostico, desafioClasificar, evaluarClasificacion, ITEMS_CLASIFICAR, HIPOTESIS, OPCIONES_HIPOTESIS, desafioHipotesis,
} from '../js/nucleo/desafios.js';
import { TIPOS } from '../js/nucleo/historias.js';

test('el pronóstico se repite con la misma semilla y sus respuestas son coherentes', () => {
  const a = desafioPronostico(7);
  assert.deepEqual(a, desafioPronostico(7));
  for (let s = 1; s < 50; s++) {
    const d = desafioPronostico(s);
    assert.ok(d.respuesta.optimista <= d.respuesta.probable && d.respuesta.probable <= d.respuesta.pesimista, `semilla ${s}`);
    assert.ok(d.velocidades.every((v) => v >= 12 && v <= 25));
  }
});

test('evaluar el pronóstico: exacto, dentro del rango o fuera', () => {
  const d = { respuesta: { optimista: 3, probable: 4, pesimista: 6 } };
  assert.equal(evaluarPronostico(d, 4).nivel, 'exacto');
  assert.equal(evaluarPronostico(d, '5').nivel, 'rango');
  assert.equal(evaluarPronostico(d, 9).nivel, 'fuera');
});

test('clasificar: ítems válidos y conteo de aciertos', () => {
  assert.ok(ITEMS_CLASIFICAR.every((i) => i.tipo in TIPOS && i.porque));
  const items = desafioClasificar(3, 4);
  assert.equal(items.length, 4);
  const r = evaluarClasificacion(items, [items[0].tipo, 'historia' === items[1].tipo ? 'bug' : 'historia', items[2].tipo]);
  assert.equal(r.aciertos, 2);
  assert.equal(r.detalle[3].elegido, null);
});

test('hipótesis: respuestas válidas y cubren los tres resultados', () => {
  assert.ok(HIPOTESIS.every((x) => x.respuesta in OPCIONES_HIPOTESIS));
  assert.deepEqual(new Set(HIPOTESIS.map((x) => x.respuesta)), new Set(Object.keys(OPCIONES_HIPOTESIS)));
  assert.ok(HIPOTESIS.includes(desafioHipotesis(5)));
});
