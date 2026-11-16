import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  extraerItems, aHistoria, notasAHistorias, revisarInvest, calidad, enunciado, singular, resumirTitulo,
  dividirHistoria, reemplazarPorPartes, esCriterioGenerico,
} from '../js/nucleo/historias.js';

test('separa viñetas, numeración, punto y coma y toma títulos como épica', () => {
  const items = extraerItems(`Pagos:
- que el cliente pague con tarjeta
- enviar boleta por correo; guardar historial
1. exportar a Excel

# Reportes
* ver ventas del mes`);
  assert.deepEqual(items.map((i) => [i.texto, i.epica]), [
    ['que el cliente pague con tarjeta', 'Pagos'],
    ['enviar boleta por correo', 'Pagos'],
    ['guardar historial', 'Pagos'],
    ['exportar a Excel', 'Pagos'],
    ['ver ventas del mes', 'Reportes'],
  ]);
});

test('une líneas de continuación de una misma viñeta', () => {
  const items = extraerItems('- que el admin pueda bloquear usuarios\n  cuando reportan abuso\n- otra cosa');
  assert.equal(items.length, 2);
  assert.equal(items[0].texto, 'que el admin pueda bloquear usuarios cuando reportan abuso');
});

test('reconoce el formato clásico "Como… quiero… para…"', () => {
  const h = aHistoria({ texto: 'Como vendedora, quiero ver mis comisiones del mes, para saber cuánto voy a ganar.' });
  assert.equal(h.rol, 'vendedora');
  assert.equal(h.quiero, 'ver mis comisiones del mes');
  assert.equal(h.para, 'saber cuánto voy a ganar');
  assert.equal(enunciado(h), 'Como vendedora, quiero ver mis comisiones del mes, para saber cuánto voy a ganar.');
});

test('convierte notas libres: quita relleno, detecta rol y beneficio', () => {
  const h = aHistoria({ texto: 'Hay que permitir que los clientes descarguen su factura para no tener que pedirla por correo' });
  assert.equal(h.rol, 'cliente');
  assert.equal(h.quiero, 'permitir que los clientes descarguen su factura');
  assert.equal(h.para, 'no tener que pedirla por correo');
});

test('"que el X pueda…" se convierte en rol + acción', () => {
  const h = aHistoria({ texto: 'que el cliente pueda pagar con tarjeta para no tener que transferir' });
  assert.equal(h.rol, 'cliente');
  assert.equal(h.quiero, 'pagar con tarjeta');
  assert.equal(h.para, 'no tener que transferir');
  const h2 = aHistoria({ texto: 'los jefes de venta puedan aprobar descuentos' });
  assert.equal(h2.rol, 'jefe de venta');
  assert.equal(h2.quiero, 'aprobar descuentos');
});

test('usa el rol por defecto del proyecto cuando la nota no lo dice', () => {
  const h = aHistoria({ texto: 'Exportar el backlog a CSV' }, { rolPorDefecto: 'product owner' });
  assert.equal(h.rol, 'product owner');
  assert.equal(h.quiero, 'exportar el backlog a CSV');
  assert.equal(h.titulo, 'Exportar el backlog a CSV');
  assert.deepEqual(h.criterios, [], 'no inventa criterios');
});

test('mantiene siglas al inicio', () => {
  const h = aHistoria({ texto: 'API pública para socios comerciales' });
  assert.equal(h.quiero, 'API pública');
  assert.equal(h.para, 'socios comerciales');
});

test('singulariza roles comunes', () => {
  assert.equal(singular('clientes'), 'cliente');
  assert.equal(singular('administradores'), 'administrador');
  assert.equal(singular('jefes de ventas'), 'jefe de ventas');
  assert.equal(singular('usuarias'), 'usuaria');
});

test('INVEST: avisa falta de valor, palabras vagas y varias metas', () => {
  const h = aHistoria({ texto: 'que la búsqueda sea rápida y además filtre por fecha y exporte resultados' });
  const codigos = revisarInvest(h).map((a) => a.codigo);
  assert.ok(codigos.includes('valor'));
  assert.ok(codigos.includes('varias'));
  // "rápida" no está en la lista; "rápido" sí: la búsqueda por palabra completa no debe fallar con variantes
  const h2 = aHistoria({ texto: 'Como cliente quiero un checkout más fácil para comprar' });
  assert.ok(revisarInvest(h2).some((a) => a.codigo === 'vaga'));
});

test('INVEST: una buena historia no tiene avisos y puntúa 100', () => {
  const h = aHistoria({ texto: 'Como contadora, quiero descargar las boletas del mes en un ZIP, para declarar a tiempo' });
  assert.ok(revisarInvest(h).some((a) => a.codigo === 'criterios'), 'sin criterios no está lista');
  h.criterios = ['Dado un mes con boletas, cuando descargo el ZIP, entonces trae una boleta por archivo.'];
  assert.deepEqual(revisarInvest(h), []);
  assert.equal(calidad(h), 100);
});

test('INVEST: avisa historias técnicas sin beneficio y estimaciones grandes', () => {
  const h = aHistoria({ texto: 'migrar la base de datos a PostgreSQL' });
  assert.ok(revisarInvest(h).some((a) => a.codigo === 'tecnica'));
  h.para = 'soportar más clientes';
  h.puntos = 21;
  assert.ok(revisarInvest(h).some((a) => a.codigo === 'grande'));
});

test('notasAHistorias genera ids únicos', () => {
  const hs = notasAHistorias('- uno uno\n- dos dos\n- tres tres');
  assert.equal(new Set(hs.map((h) => h.id)).size, 3);
});

test('resumirTitulo corta con puntos suspensivos', () => {
  assert.equal(resumirTitulo('a b c d e f g h i j', 3), 'a b c…');
});

test('divide una historia con varias metas y conserva rol, beneficio y épica', () => {
  const h = aHistoria({ texto: 'Como vendedor, quiero buscar clientes por RUT, filtrar por comuna y exportar el listado, para preparar visitas', epica: 'CRM' });
  const partes = dividirHistoria(h);
  assert.deepEqual(partes.map((p) => p.quiero), ['buscar clientes por RUT', 'filtrar por comuna', 'exportar el listado']);
  assert.ok(partes.every((p) => p.rol === 'vendedor' && p.para === 'preparar visitas' && p.epica === 'CRM'));
  assert.equal(new Set(partes.map((p) => p.id)).size, 3);
  assert.ok(partes[0].notaOriginal.startsWith('Como vendedor'));
});

test('no divide lo que no tiene varias partes con sentido', () => {
  assert.equal(dividirHistoria(aHistoria({ texto: 'Como cliente quiero pagar con tarjeta para comprar' })), null);
  assert.equal(dividirHistoria(aHistoria({ texto: 'ver blanco y negro' })), null);
});

test('reemplazarPorPartes deja las partes en el mismo lugar', () => {
  const hs = notasAHistorias('- primera cosa\n- buscar productos y comparar precios\n- última cosa');
  const partes = dividirHistoria(hs[1]);
  const nuevas = reemplazarPorPartes(hs, hs[1].id, partes);
  assert.deepEqual(nuevas.map((x) => x.quiero), ['primera cosa', 'buscar productos', 'comparar precios', 'última cosa']);
});

test('palabras vagas: sugiere cómo medirlas, también en los criterios', () => {
  const h = aHistoria({ texto: 'Como cliente, quiero un checkout rápido, para comprar' });
  const vaga = revisarInvest(h).find((a) => a.codigo === 'vaga');
  assert.match(vaga.texto, /"rápido".*menos de 2 segundos/);

  const h2 = aHistoria({ texto: 'Como contadora, quiero descargar boletas, para declarar' });
  h2.criterios = ['Dado que descargo, entonces la descarga es fácil e intuitiva'];
  const enCriterio = revisarInvest(h2).find((a) => a.codigo === 'vaga-criterio');
  assert.match(enCriterio.texto, /Un criterio dice "fácil"/);
});

test('notas reales: el sujeto es el rol y la frase queda bien armada', () => {
  const [mecanico, pedido, sistema, saber] = notasAHistorias('el mecánico necesita ver la agenda del día en el celular\nquiere que agenden solos por internet\nsistema debe ser rápido\nquiere saber cuántos autos atiende por semana');
  assert.equal(enunciado(mecanico), 'Como mecánico, quiero ver la agenda del día en el celular.');
  assert.equal(pedido.quiero, 'que agenden solos por internet');
  assert.equal(sistema.quiero, 'que el sistema sea rápido');
  assert.ok(revisarInvest(sistema).some((a) => a.codigo === 'vaga'), '«rápido» pide una métrica');
  assert.equal(saber.quiero, 'saber cuántos autos atiende por semana');
});

test('notas reales: contexto, preguntas abiertas y problemas no quedan como historias listas', () => {
  const [contexto, problema, pregunta] = notasAHistorias('reunión con don Jorge Soto, taller en Maipú\nhoy los clientes llaman por teléfono y se pierden llamadas\ncobrar un abono para reservar? no está seguro');
  assert.equal(contexto.nota, 'contexto');
  assert.equal(problema.nota, 'problema');
  assert.ok(revisarInvest(problema).some((a) => a.codigo === 'problema'));
  assert.equal(pregunta.nota, 'pregunta');
  assert.equal(pregunta.tipo, 'spike');
  for (const h of [contexto, problema, pregunta]) assert.ok(calidad(h) < 90, `«${h.quiero}» no debe verse lista`);
});

test('el criterio de plantilla de versiones anteriores se avisa como si faltara', () => {
  const h = aHistoria({ texto: 'Como contadora, quiero descargar las boletas, para declarar' });
  h.criterios = ['Dado que tengo acceso, cuando intento descargar las boletas, entonces el sistema me confirma que se realizó.'];
  assert.ok(esCriterioGenerico(h.criterios[0]));
  assert.ok(revisarInvest(h).some((a) => a.codigo === 'criterios' && /plantilla/.test(a.texto)));
});
