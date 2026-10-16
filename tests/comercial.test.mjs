import { test } from 'node:test';
import assert from 'node:assert/strict';
import { notasAHistorias, revisarInvest } from '../js/nucleo/historias.js';
import { nuevoProyecto, normalizarProyecto, cambiarEstado } from '../js/nucleo/proyecto.js';
import { PLANTILLAS } from '../js/nucleo/plantillas.js';
import {
  aplicarPlantilla, alcanceDe, historiasEnAlcance, horasDe, cotizacion, formatoMonto, sugerirHitos, revisarHitos, montoHito,
  hitoListo, aceptarHito, registrarCambio, impactoCambio, aprobarCambio, rechazarCambio, comercialDe,
} from '../js/nucleo/comercial.js';
import { propuestaAlcance, actaAceptacion, respuestaCambio } from '../js/nucleo/documentos.js';

function proyecto() {
  const p = nuevoProyecto('Pastelería de Carla');
  p.historias = notasAHistorias('Catálogo:\n- Como clienta, quiero ver las tortas con precio, para decidir\n- Como clienta, quiero filtrar por ocasión, para encontrar rápido\nPedidos:\n- Como clienta, quiero encargar para una fecha, para tenerla a tiempo\n- Como Carla, quiero ver los pedidos, para no olvidar ninguno');
  [3, 2, 5, 2].forEach((x, i) => { p.historias[i].puntos = x; });
  p.comercial = { ...comercialDe(p), moneda: 'UF', valorHora: 0.5, horasPorPunto: 4, margen: 20, valorUF: 40000 };
  return p;
}

test('las plantillas están bien escritas: historias sin avisos graves salvo spikes', () => {
  for (const [clave, pl] of Object.entries(PLANTILLAS)) {
    const hs = notasAHistorias(pl.notas);
    assert.ok(hs.length >= 4, clave);
    assert.ok(pl.noIncluye.length && pl.supuestos.length && pl.cliente.length, clave);
    for (const h of hs.filter((x) => !/^investigar/i.test(x.quiero))) {
      const graves = revisarInvest(h).filter((a) => a.nivel === 'aviso' && a.codigo !== 'criterios');
      assert.deepEqual(graves.map((a) => a.texto), [], `${clave}: ${h.quiero}`);
    }
  }
});

test('aplicar una plantilla suma historias y alcance sin duplicar', () => {
  let p = aplicarPlantilla(nuevoProyecto(), 'web');
  const n = p.historias.length;
  p = aplicarPlantilla(p, 'web');
  assert.equal(p.historias.length, n * 2, 'las historias se agregan (se pueden borrar)');
  assert.equal(alcanceDe(p).noIncluye.length, PLANTILLAS.web.noIncluye.length, 'el alcance no se repite');
  assert.throws(() => aplicarPlantilla(p, 'nada'), /no existe/);
});

test('horas: manuales o puntos × horas por punto; cotización con margen y CLP', () => {
  const p = proyecto();
  p.historias[3].horas = 10; // manual en vez de 2 pts × 4
  assert.equal(horasDe(p.historias[0], comercialDe(p)), 12);
  const c = cotizacion(p);
  assert.equal(c.horas, 12 + 8 + 20 + 10);
  assert.equal(c.subtotal, 25);
  assert.equal(c.margen, 5);
  assert.equal(c.total, 30);
  assert.equal(c.totalCLP, 1200000);
  assert.equal(formatoMonto(1234.5, 'CLP'), '$1.235');
  assert.equal(formatoMonto(12.5, 'UF'), '12,5 UF');
});

test('lo descartado y los cambios no aprobados quedan fuera del alcance', () => {
  let p = proyecto();
  p.historias[1].prioridad = 'wont';
  p = registrarCambio(p, '- Como clienta, quiero pagar en cuotas, para comprar tortas grandes', 6);
  assert.equal(historiasEnAlcance(p).length, 3);
  p = aprobarCambio(p, p.cambios[0].id);
  assert.equal(historiasEnAlcance(p).length, 4);
  assert.equal(p.historias.at(-1).horas, 6, 'el cambio de una sola historia hereda sus horas');
});

test('hitos sugeridos: reparten el esfuerzo en orden, suman 100% y montos coherentes', () => {
  const p = proyecto();
  p.hitos = sugerirHitos(p, 2);
  assert.deepEqual(p.hitos.map((x) => x.porcentaje), [50, 50]);
  assert.deepEqual(p.hitos.map((x) => x.historiaIds.length), [2, 2]);
  assert.equal(p.hitos[0].nombre, 'Hito 1: Catálogo');
  assert.deepEqual(revisarHitos(p), []);
  assert.equal(montoHito(p, p.hitos[0]), 14.4);
  p.hitos[1].porcentaje = 40;
  p.hitos[1].historiaIds = p.hitos[1].historiaIds.slice(1);
  assert.equal(revisarHitos(p).length, 2);
  assert.throws(() => sugerirHitos(nuevoProyecto()), /define el alcance/);
});

test('hito listo y aceptación con nombre', () => {
  let p = proyecto();
  p.hitos = sugerirHitos(p, 2);
  assert.equal(hitoListo(p, p.hitos[0]), false);
  p.historias = p.historias.map((h) => (p.hitos[0].historiaIds.includes(h.id) ? cambiarEstado(h, 'done') : h));
  assert.equal(hitoListo(p, p.hitos[0]), true);
  assert.throws(() => aceptarHito(p, p.hitos[0].id, { nombre: ' ' }), /quién acepta/);
  p = aceptarHito(p, p.hitos[0].id, { nombre: 'Carla Rojas', fecha: new Date('2026-04-02T12:00:00Z') });
  assert.deepEqual(p.hitos[0].aceptacion, { nombre: 'Carla Rojas', fecha: '2026-04-02' });
});

test('impacto de un cambio: valor con margen y días según horas por semana', () => {
  let p = proyecto();
  p = registrarCambio(p, 'Agregar un blog de recetas', 10);
  const im = impactoCambio(p, p.cambios[0]);
  assert.deepEqual(im, { horas: 10, valor: 6, dias: 4, moneda: 'UF' });
  assert.equal(impactoCambio(p, { horas: null }).valor, null);
  assert.equal(rechazarCambio(p, p.cambios[0].id).cambios[0].estado, 'rechazado');
  assert.throws(() => registrarCambio(p, '  ', 3), /Describe/);
});

test('documentos: propuesta, acta y respuesta a un cambio', () => {
  let p = proyecto();
  p.alcance = { incluye: [], noIncluye: ['Fotografía de productos'], supuestos: ['Hasta 50 productos'], cliente: ['Fotos y precios'] };
  p.hitos = sugerirHitos(p, 2);
  const prop = propuestaAlcance(p, { hoy: '2026-03-01' });
  assert.ok(prop.startsWith('# Propuesta: Pastelería de Carla'));
  assert.ok(prop.includes('_01-03-2026 · válida por 15 días_'));
  assert.ok(prop.includes('**Catálogo**') && prop.includes('- Ver las tortas con precio, para decidir.'));
  assert.ok(prop.includes('## Qué NO incluye\n\n- Fotografía de productos'));
  assert.ok(prop.includes('| **Total** | **28,8 UF** (≈ $1.152.000 con UF a $40.000) |'));
  assert.ok(prop.includes('| Hito 1: Catálogo | por acordar | 50% | 14,4 UF |'));
  assert.ok(prop.includes('no reemplaza un contrato'));

  const acta = actaAceptacion(p, p.hitos[0].id);
  assert.ok(acta.startsWith('# Acta de aceptación · Hito 1: Catálogo'));
  assert.ok(acta.includes('- [ ] Dado que'));
  assert.ok(acta.includes('liberando el pago de **14,4 UF** (50% del total)'));

  p = registrarCambio(p, 'Agregar un blog de recetas', 10);
  const resp = respuestaCambio(p, p.cambios[0].id);
  assert.ok(resp.includes('"Agregar un blog de recetas"'));
  assert.ok(resp.includes('Valor adicional: 6 UF'));
  assert.ok(resp.includes('se mueve unos 4 días'));
});

test('todo lo comercial sobrevive al respaldo, limpio', () => {
  let p = proyecto();
  p.alcance = { incluye: ['Capacitación de 1 hora'], noIncluye: ['Logo', 'Logo', 3], supuestos: [], cliente: [] };
  p.hitos = sugerirHitos(p, 2);
  p.hitos[0].historiaIds.push('no-existe');
  p = registrarCambio(p, 'Blog', 5);
  p.comercial.valorHora = -3;
  const n = normalizarProyecto(JSON.parse(JSON.stringify(p)));
  assert.deepEqual(n.alcance.noIncluye, ['Logo']);
  assert.equal(n.hitos[0].historiaIds.includes('no-existe'), false);
  assert.equal(n.cambios[0].horas, 5);
  assert.equal(n.comercial.valorHora, null);
  assert.equal(n.comercial.margen, 20);
});
