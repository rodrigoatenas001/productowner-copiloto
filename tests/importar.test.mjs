import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leerCsv, mapearColumnas, importarCsv } from '../js/nucleo/importar.js';
import { aCsv, aJiraCsv } from '../js/nucleo/exportar.js';
import { nuevoProyecto } from '../js/nucleo/proyecto.js';
import { notasAHistorias } from '../js/nucleo/historias.js';

test('leerCsv entiende comillas, saltos dentro de celdas, BOM y punto y coma', () => {
  assert.deepEqual(leerCsv('\uFEFFa,b\n"x, y","línea 1\nlínea 2"\r\n'), [['a', 'b'], ['x, y', 'línea 1\nlínea 2']]);
  assert.deepEqual(leerCsv('Título;Puntos\n"dijo ""hola""";3\n\n'), [['Título', 'Puntos'], ['dijo "hola"', '3']]);
});

test('mapearColumnas reconoce Jira y español sin importar acentos', () => {
  assert.deepEqual(mapearColumnas(['Summary', 'Status', 'Story Points', 'Priority']), { titulo: 0, puntos: 2, prioridad: 3, estado: 1 });
  assert.deepEqual(mapearColumnas(['Título', 'Épica', 'Criterios de aceptación']), { titulo: 0, criterios: 2, epica: 1 });
});

test('importa un CSV de Jira: prioridad, puntos a la escala, omite lo terminado', () => {
  const csv = [
    'Summary,Description,Status,Story Points,Priority,Labels',
    '"Pagar con tarjeta","Como cliente, quiero pagar con tarjeta, para no transferir\n\nCriterios de aceptación:\n* Acepta Visa\n* Rechaza tarjetas vencidas",To Do,4,Highest,pagos',
    'Ver historial,,Done,2,Low,',
    'Exportar a Excel,,In Progress,0.5,Medium,reportes;admin',
  ].join('\n');
  const r = importarCsv(csv);
  assert.equal(r.omitidas, 1);
  assert.equal(r.historias.length, 2);
  const [a, b] = r.historias;
  assert.equal(a.rol, 'cliente');
  assert.equal(a.quiero, 'pagar con tarjeta');
  assert.deepEqual(a.criterios, ['Acepta Visa', 'Rechaza tarjetas vencidas']);
  assert.equal(a.puntos, 5);
  assert.equal(a.prioridad, 'must');
  assert.equal(a.epica, 'pagos');
  assert.equal(b.puntos, 1);
  assert.equal(b.prioridad, 'could');
  assert.equal(b.epica, 'reportes');
  assert.equal(b.estado, 'backlog');
});

test('lo exportado por el copiloto se vuelve a importar', () => {
  const p = nuevoProyecto('X');
  p.historias = notasAHistorias('Pagos:\n- Como contadora, quiero bajar boletas, para declarar');
  p.historias[0].puntos = 3;
  for (const csv of [aCsv(p), aJiraCsv(p)]) {
    const [h] = importarCsv(csv).historias;
    assert.equal(h.quiero, 'bajar boletas');
    assert.equal(h.rol, 'contadora');
    assert.equal(h.puntos, 3);
  }
});

test('rechaza archivos sin columnas útiles o vacíos', () => {
  assert.throws(() => importarCsv('A,B\n1,2'), /columna de título/);
  assert.throws(() => importarCsv('Summary'), /no tiene filas/);
});
