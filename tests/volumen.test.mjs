// Volumen: con 1000 historias, lo que se calcula en cada vista y las exportaciones deben seguir siendo rápidos.
// Los límites son holgados (unas 10 veces lo medido) para no fallar en equipos lentos; avisan si algo se dispara.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nuevoProyecto, normalizarProyecto, resumenEpicas } from '../js/nucleo/proyecto.js';
import { aHistoria, calidad } from '../js/nucleo/historias.js';
import { pronosticar } from '../js/nucleo/pronostico.js';
import { roadmap } from '../js/nucleo/roadmap.js';
import { excelBacklog, excelProyecto, documentoProyecto } from '../js/nucleo/informe.js';
import { documentoWord } from '../js/nucleo/docx.js';

function proyectoGrande(n) {
  const p = nuevoProyecto(`Grande ${n}`);
  p.historias = Array.from({ length: n }, (_, i) => ({
    ...aHistoria({ texto: `Como cliente, quiero ver el pedido ${i + 1} con su estado, para saber cuándo llega`, epica: `Épica ${i % 12}` }),
    criterios: ['Dado un pedido, cuando lo abro, entonces veo su estado.', 'Dado un pedido atrasado, cuando lo abro, entonces veo el aviso.'],
    reglas: i % 3 ? [] : ['Solo la dueña del pedido lo ve'],
    puntos: [1, 2, 3, 5, 8][i % 5],
    priorizacion: { valor: 5, urgencia: 3, riesgo: 2 },
  }));
  return normalizarProyecto(p);
}

const tiempo = (f) => { const t0 = performance.now(); const r = f(); return [performance.now() - t0, r]; };

test('1000 historias: revisión de calidad, épicas, pronóstico y roadmap en menos de medio segundo', () => {
  const p = proyectoGrande(1000);
  const [ms] = tiempo(() => { p.historias.forEach(calidad); resumenEpicas(p); pronosticar(p); roadmap(p); });
  assert.ok(ms < 500, `tardó ${ms.toFixed(0)} ms`);
});

test('1000 historias: Excel y Word se arman en menos de un segundo cada uno', () => {
  const p = proyectoGrande(1000);
  for (const [nombre, f] of [['Excel del backlog', () => excelBacklog(p)], ['Excel del proyecto', () => excelProyecto(p)], ['Word', () => documentoWord(documentoProyecto(p))]]) {
    const [ms, bytes] = tiempo(f);
    assert.ok(ms < 1000, `${nombre}: ${ms.toFixed(0)} ms`);
    assert.ok(bytes.length > 100_000, `${nombre}: trae el contenido`);
  }
});
