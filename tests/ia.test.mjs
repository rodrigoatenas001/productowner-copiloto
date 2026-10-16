import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extraerJson, historiasDesdeIa, iaConfigurada } from '../js/ia.js';

test('extrae JSON aunque venga dentro de un bloque de código o con texto', () => {
  assert.deepEqual(extraerJson('Aquí va:\n```json\n{"historias":[]}\n```\nListo'), { historias: [] });
  assert.throws(() => extraerJson('no sé'), /formato esperado/);
});

test('valida y limpia las historias de la IA', () => {
  const hs = historiasDesdeIa({
    historias: [
      { rol: 'Contadora', quiero: 'poder descargar boletas.', para: 'para que pueda declarar', criterios: ['Dado…', 42], epica: 'Pagos' },
      { rol: 'x', quiero: '' },
      'basura',
    ],
  }, 'cliente');
  assert.equal(hs.length, 1);
  assert.equal(hs[0].rol, 'contadora');
  assert.equal(hs[0].quiero, 'descargar boletas');
  assert.equal(hs[0].para, 'pueda declarar');
  assert.deepEqual(hs[0].criterios, ['Dado…']);
  assert.equal(hs[0].titulo, 'Descargar boletas');
});

test('sin criterios propone uno y usa el rol por defecto', () => {
  const [h] = historiasDesdeIa({ historias: [{ quiero: 'exportar a PDF' }] }, 'product owner');
  assert.equal(h.rol, 'product owner');
  assert.equal(h.criterios.length, 1);
});

test('iaConfigurada exige clave salvo en Ollama', () => {
  assert.equal(iaConfigurada({ proveedor: 'ninguno' }), false);
  assert.equal(iaConfigurada({ proveedor: 'ollama', modelo: 'llama3.1' }), true);
  assert.equal(iaConfigurada({ proveedor: 'anthropic', modelo: 'x' }), false);
  assert.equal(iaConfigurada({ proveedor: 'anthropic', modelo: 'x', clave: 'k' }), true);
});
