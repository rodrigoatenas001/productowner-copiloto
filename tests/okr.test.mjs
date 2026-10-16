import { test } from 'node:test';
import assert from 'node:assert/strict';
import { notasAHistorias } from '../js/nucleo/historias.js';
import { nuevoProyecto, normalizarProyecto } from '../js/nucleo/proyecto.js';
import {
  agregarObjetivo, agregarResultado, quitarResultado, quitarObjetivo, editarEpica, infoEpica, hipotesis, cobertura, resultadosDeEpica,
} from '../js/nucleo/okr.js';
import { especificacionEpica, reporteEpicas } from '../js/nucleo/reportes.js';

function proyecto() {
  let p = nuevoProyecto('Tienda');
  p.historias = notasAHistorias('Pagos:\n- Como clienta, quiero pagar con tarjeta, para no transferir\nCatálogo:\n- Como clienta, quiero ver precios, para decidir');
  p = agregarObjetivo(p, 'Vender más en línea');
  p = agregarResultado(p, p.objetivos[0].id, 'Subir la conversión del 2% al 4%');
  p = agregarResultado(p, p.objetivos[0].id, 'Bajar los carritos abandonados a la mitad');
  return p;
}

test('objetivos y resultados: ignora textos vacíos', () => {
  const p = proyecto();
  assert.equal(p.objetivos.length, 1);
  assert.equal(p.objetivos[0].resultados.length, 2);
  assert.equal(agregarObjetivo(p, '   ').objetivos.length, 1);
});

test('hipótesis completa en una frase; incompleta da null', () => {
  let p = editarEpica(proyecto(), 'Pagos', { creemos: 'al aceptar tarjetas', lograremos: 'más compras', veremos: 'la conversión suba al 4%' });
  assert.equal(hipotesis(infoEpica(p, 'Pagos')), 'Creemos que al aceptar tarjetas, lograremos más compras; lo sabremos cuando la conversión suba al 4%.');
  assert.match(hipotesis(infoEpica(editarEpica(p, 'Pagos', { creemos: 'implementar cuotas' }), 'Pagos')), /^Creemos que al implementar cuotas,/);
  p = editarEpica(p, 'Pagos', { veremos: '' });
  assert.equal(hipotesis(infoEpica(p, 'Pagos')), null);
});

test('cobertura: resultados sin épica y épicas sin objetivo', () => {
  let p = proyecto();
  const [kr1] = p.objetivos[0].resultados;
  p = editarEpica(p, 'Pagos', { resultados: [kr1.id] });
  const c = cobertura(p);
  assert.deepEqual(c.resultadosSinEpica.map((r) => r.texto), ['Bajar los carritos abandonados a la mitad']);
  assert.deepEqual(c.epicasSinResultado, ['Catálogo']);
  assert.deepEqual(resultadosDeEpica(p, 'Pagos').map((r) => r.texto), ['Subir la conversión del 2% al 4%']);
});

test('quitar un resultado u objetivo limpia los vínculos de las épicas', () => {
  let p = proyecto();
  const [kr1] = p.objetivos[0].resultados;
  p = editarEpica(p, 'Pagos', { resultados: [kr1.id] });
  assert.deepEqual(infoEpica(quitarResultado(p, kr1.id), 'Pagos').resultados, []);
  assert.deepEqual(infoEpica(quitarObjetivo(p, p.objetivos[0].id), 'Pagos').resultados, []);
});

test('OKR e hipótesis aparecen en el reporte de épicas y en la especificación', () => {
  let p = proyecto();
  p = editarEpica(p, 'Pagos', { creemos: 'al aceptar tarjetas', lograremos: 'más compras', veremos: 'la conversión suba', resultados: [p.objetivos[0].resultados[0].id] });
  const spec = especificacionEpica(p, 'Pagos');
  assert.ok(spec.includes('**Hipótesis:** Creemos que al aceptar tarjetas'));
  assert.ok(spec.includes('Subir la conversión del 2% al 4% (Vender más en línea)'));
  const rep = reporteEpicas(p);
  assert.ok(rep.includes('## Objetivos y resultados clave'));
  assert.ok(rep.includes('- Bajar los carritos abandonados a la mitad · **sin épicas trabajando en esto**'));
});

test('OKR sobreviven al respaldo y se limpian vínculos rotos', () => {
  let p = proyecto();
  p = editarEpica(p, 'Pagos', { creemos: 'x', resultados: [p.objetivos[0].resultados[0].id, 'kr-inexistente'] });
  p.objetivos.push({ objetivo: '', resultados: [] });
  const n = normalizarProyecto(JSON.parse(JSON.stringify(p)));
  assert.equal(n.objetivos.length, 1);
  assert.deepEqual(n.epicasInfo.Pagos.resultados, [p.objetivos[0].resultados[0].id]);
});
