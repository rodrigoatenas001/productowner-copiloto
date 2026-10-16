import { test } from 'node:test';
import assert from 'node:assert/strict';
import { notasAHistorias } from '../js/nucleo/historias.js';
import { nuevoProyecto, cambiarEstado } from '../js/nucleo/proyecto.js';
import { editarEpica } from '../js/nucleo/okr.js';
import { bloquear } from '../js/nucleo/flujo.js';
import { informeCliente } from '../js/nucleo/reportes.js';

function proyecto() {
  let p = nuevoProyecto('Tienda de Carla');
  p.vision = { vision: 'Que la pastelería venda sin depender de Instagram.', objetivoProducto: 'Pedidos en línea antes de diciembre.' };
  p.sprints.push({ id: 's1', nombre: 'Sprint 1', inicio: '2026-03-02', fin: '2026-03-15', capacidad: 10, estado: 'cerrado', objetivo: 'Que las clientas vean el catálogo', feedback: '' });
  p.sprints.push({ id: 's2', nombre: 'Sprint 2', inicio: '2026-03-16', fin: '2026-03-29', capacidad: 10, estado: 'activo', objetivo: 'Que las clientas puedan encargar', feedback: '' });
  p.historias = notasAHistorias('Catálogo:\n- Como clienta, quiero ver las tortas con su precio, para decidir\nPedidos:\n- Como clienta, quiero encargar una torta, para tenerla a tiempo\n- Como Carla, quiero ver los pedidos, para no olvidar ninguno\n- pagar en cuotas');
  p.historias[0] = { ...cambiarEstado({ ...p.historias[0], sprintId: 's1', puntos: 5 }, 'done') };
  p.historias[1] = bloquear({ ...p.historias[1], sprintId: 's2', estado: 'doing', puntos: 5 }, 'Falta definir el horario de retiro');
  p.historias[2].puntos = 3;
  p.historias[3].prioridad = 'must';
  p = editarEpica(p, 'Catálogo', { creemos: 'mostrar precios', lograremos: 'menos consultas', veremos: 'bajen los mensajes', resultadoHipotesis: 'cumplida', datoReal: 'mensajes -40%' });
  return p;
}

test('el informe habla claro: resumen, visión, entregas, lo que viene y resultados', () => {
  const md = informeCliente(proyecto(), new Date('2026-03-20T12:00:00Z'));
  assert.ok(md.startsWith('# Tienda de Carla · Informe de avance'));
  assert.ok(md.includes('**Avance general:** 38% del trabajo planificado está terminado.'));
  assert.ok(md.includes('**Último ciclo (Sprint 1):** 1 entrega, con el objetivo "Que las clientas vean el catálogo".'));
  assert.ok(md.includes('**Ahora estamos en:** Sprint 2, hasta el 29-03-2026'));
  assert.ok(md.includes('**Próxima meta:** Pedidos en línea antes de diciembre.'));
  assert.ok(md.includes('- **Ver las tortas con su precio.** Como clienta, ahora puedes ver las tortas con su precio, para decidir.'));
  assert.ok(md.includes('**Catálogo:** se cumplió (mensajes -40%).'));
  assert.ok(!/velocidad|WIP|sprint backlog|story points/i.test(md), 'sin jerga');
});

test('"Necesitamos de ti" junta bloqueos y lo prioritario por aclarar', () => {
  const md = informeCliente(proyecto(), new Date('2026-03-20T12:00:00Z'));
  const seccion = md.slice(md.indexOf('## Necesitamos de ti'));
  assert.ok(seccion.includes('**Destrabar "Encargar una torta":** Falta definir el horario de retiro.'));
  assert.ok(seccion.includes('**Aclarar "Pagar en cuotas":**'));
});

test('sin nada pendiente, agradece', () => {
  const p = nuevoProyecto('Vacío');
  const md = informeCliente(p);
  assert.ok(md.includes('_Nada por ahora. ¡Gracias!_'));
  assert.ok(md.includes('_Por definir en conjunto._'));
});
