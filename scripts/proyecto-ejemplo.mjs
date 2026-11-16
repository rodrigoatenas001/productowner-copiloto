// Genera un proyecto de ejemplo realista (docs/ejemplo/pasteleria-carla.json), con fechas relativas a hoy.
// Sirve para las capturas del README y para probar la app importándolo como respaldo.
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { nuevoProyecto, cambiarEstado, fechaISO } from '../js/nucleo/proyecto.js';
import { aplicarPlantilla, sugerirHitos, registrarCambio, comercialDe } from '../js/nucleo/comercial.js';
import { agregarObjetivo, agregarResultado, editarEpica } from '../js/nucleo/okr.js';
import { nuevaRetro, agregarNota, votar, agregarAccion } from '../js/nucleo/retro.js';
import { bloquear } from '../js/nucleo/flujo.js';
import { agregarDependencia } from '../js/nucleo/dependencias.js';
import { notasAHistorias } from '../js/nucleo/historias.js';
import { PROCESO_VACIO, agregarCarril, agregarPaso, conectar } from '../js/nucleo/proceso.js';

const DIA = 86400000;
const hoy = new Date();
const dias = (n) => new Date(hoy.getTime() + n * DIA);

let p = nuevoProyecto('Pastelería de Carla (ejemplo)');
p.id = 'ejemplo-pasteleria';
p = aplicarPlantilla(p, 'ecommerce');
p.rolPorDefecto = 'clienta';
p.notas = `Reunión con Carla (pastelería, Ñuñoa)
- Hoy todo llega por Instagram y WhatsApp, se le pierden pedidos
- Quiere que vean las tortas con precio y si quedan
- Que paguen en línea, con tarjeta, y si se puede en cuotas para eventos
- Despacho solo en Ñuñoa y Providencia, o retiro en tienda
- Le gustaría premiar a las clientas frecuentes
- Necesita saber qué se vende más para hornear mejor
- Pregunta por boletas electrónicas automáticas (no sabe cómo)
- Presupuesto acotado, quiere partir antes de fiestas patrias`;
p.vision = { vision: 'Que la pastelería venda en línea sin depender de los mensajes de Instagram.', objetivoProducto: 'Que el 40% de los pedidos llegue por la tienda antes de diciembre.' };
p.comercial = { ...comercialDe(p), moneda: 'UF', valorHora: 0.6, horasPorPunto: 3, margen: 15, valorUF: 39800, horasSemana: 20 };
[3, 5, 5, 8, 3, 5, 3].forEach((pts, i) => { p.historias[i].puntos = pts; });
p.historias.push(...[
  { ...p.historias[0], id: 'h-extra-1', titulo: 'Pagar en cuotas', quiero: 'pagar en cuotas sin interés', para: 'comprar tortas para eventos grandes', epica: 'Compra', puntos: 5, prioridad: 'must', criterios: ['Dado un total mayor a $30.000, cuando pago, entonces puedo elegir 3 cuotas.'] },
]);
const mas = notasAHistorias(`Fidelización:
- Como clienta frecuente, quiero acumular puntos por cada compra, para obtener descuentos
- Como dueña, quiero crear cupones de descuento, para atraer clientas en fechas especiales
Reportes:
- Como dueña, quiero ver las ventas del mes por producto, para saber qué hornear más
- Como dueña, quiero comparar las ventas con el mes anterior, para medir si la tienda funciona
Boletas:
- Investigar en 2 días cómo emitir boletas electrónicas automáticamente`);
[8, 5, 5, 3, 2].forEach((pts, i) => { mas[i].puntos = pts; });
mas[1].prioridad = 'could';
mas[4].tipo = 'spike';
mas[4].criterios = ['Al terminar el plazo, sabemos qué proveedor usar, su costo mensual y el esfuerzo de integrarlo.'];
p.historias.push(...mas);

// El proceso operativo de la pastelería: del pedido a la producción y la entrega
const operacion = notasAHistorias(`Pedidos y producción:
- Como dueña, quiero ver cuánto hornear mañana según los pedidos confirmados, para no producir de más ni de menos
- Como dueña, quiero marcar un producto como agotado cuando se acaba, para no vender lo que no hay
- Como dueña, quiero registrar las mermas del día con su motivo, para saber cuánto pierdo y por qué
Entrega:
- Como clienta, quiero elegir el día y el bloque horario de entrega, para recibir la torta cuando estoy en casa`, { rolPorDefecto: 'clienta' });
[5, 3, 3, 5].forEach((pts, i) => { operacion[i].puntos = pts; });
p.historias.push(...operacion);

// Criterios verificables (Dado/Cuando/Entonces), reglas de negocio y prioridad con su razón (MoSCoW + WSJF).
// Se buscan por el inicio del "quiero" para no depender del orden de la plantilla.
const DETALLE = [
  ['ver el detalle', 'must', [8, 8, 3], [
    'Dado un producto publicado, cuando la clienta abre su ficha, entonces ve foto, precio con IVA, porciones e ingredientes.',
    'Dado un producto agotado, cuando la clienta abre su ficha, entonces ve «Agotado» y no puede agregarlo al carro.',
    'Dado un producto con alérgenos (nueces, gluten, lactosa), cuando se muestra la ficha, entonces los alérgenos aparecen destacados.',
  ], ['Todo producto debe declarar sus alérgenos antes de publicarse.', 'El precio se muestra siempre con IVA incluido.']],
  ['buscar y filtrar', 'should', [5, 3, 1], [
    'Dado el catálogo, cuando la clienta elige «Tortas», entonces solo ve tortas y el total de resultados.',
    'Dada una búsqueda sin resultados, cuando termina, entonces se sugieren las categorías disponibles.',
  ], []],
  ['agregar productos al carro', 'must', [13, 8, 5], [
    'Dado un carro con productos, cuando la clienta ingresa una comuna con despacho, entonces ve el costo de envío y el total.',
    'Dada una comuna fuera de Ñuñoa y Providencia, cuando la ingresa, entonces se le ofrece solo retiro en tienda.',
    'Dado un carro bajo $15.000 con despacho, cuando intenta continuar, entonces se le informa el monto mínimo.',
  ], ['Despacho solo a Ñuñoa y Providencia; el resto, retiro en tienda.', 'Monto mínimo con despacho: $15.000.', 'Despacho gratis sobre $40.000.']],
  ['pagar con tarjeta', 'must', [20, 13, 8], [
    'Dado un carro válido, cuando la clienta paga con tarjeta y la pasarela aprueba, entonces el pedido queda «Confirmado» y se descuenta el stock.',
    'Dado un pago rechazado, cuando vuelve a la tienda, entonces ve el motivo y el carro se mantiene.',
    'Dada una transferencia, cuando no se confirma en 24 horas, entonces el pedido se anula y el stock se libera.',
  ], ['Un pedido no se produce hasta tener el pago confirmado.', 'Las transferencias se confirman a mano y vencen a las 24 horas.']],
  ['recibir un correo', 'should', [5, 5, 2], [
    'Dado un pedido confirmado, cuando se confirma el pago, entonces la clienta recibe en menos de 5 minutos un correo con número de pedido, productos, total y fecha de entrega.',
  ], ['El correo nunca incluye datos de la tarjeta.']],
  ['cargar y editar productos', 'must', [8, 8, 5], [
    'Dado el panel de la dueña, cuando crea un producto sin foto o sin precio, entonces no puede publicarlo.',
    'Dado un producto publicado, cuando cambia el precio, entonces los pedidos ya confirmados mantienen el precio anterior.',
  ], ['Un cambio de precio no afecta pedidos ya pagados.']],
  ['ver los pedidos del día', 'must', [13, 13, 3], [
    'Dado el día de hoy, cuando la dueña abre Pedidos, entonces ve los pedidos ordenados por bloque de entrega con su estado.',
    'Dado un pedido listo, cuando lo marca «En camino», entonces la clienta recibe un aviso.',
  ], ['Estados posibles: Confirmado → En producción → Listo → En camino o Retirado → Entregado.']],
  ['pagar en cuotas', 'could', [5, 2, 1], [
    'Dado un total sobre $30.000, cuando la clienta paga con tarjeta de crédito, entonces puede elegir hasta 3 cuotas sin interés.',
    'Dado un total menor, cuando paga, entonces no se muestra la opción de cuotas.',
  ], ['Las cuotas sin interés las asume la pastelería: solo sobre $30.000 y hasta 3 cuotas.']],
  ['acumular puntos', 'could', [5, 1, 2], [
    'Dado un pedido entregado, cuando se marca «Entregado», entonces la clienta suma 1 punto por cada $1.000 pagados.',
    'Dado un pedido anulado, cuando se anula, entonces se descuentan los puntos que había sumado.',
  ], ['Los puntos vencen a los 12 meses.', 'No se suman puntos por el costo de despacho.']],
  ['crear cupones', 'wont', [3, 1, 1], [
    'Dado un cupón vigente, cuando la clienta lo ingresa, entonces el descuento se aplica antes del despacho.',
  ], ['Un solo cupón por pedido.', 'Queda fuera de esta versión: Carla prefiere partir con puntos.']],
  ['ver las ventas del mes', 'should', [8, 3, 2], [
    'Dado un mes con pedidos entregados, cuando la dueña abre Reportes, entonces ve unidades y monto por producto, de mayor a menor.',
  ], ['Solo cuentan pedidos entregados; los anulados no.']],
  ['comparar las ventas', 'could', [3, 1, 1], [
    'Dados dos meses con ventas, cuando la dueña los compara, entonces ve la variación en porcentaje por producto.',
  ], []],
  ['investigar en 2 días', 'should', [3, 5, 8], null, ['El plazo es fijo: 2 días, aunque no haya respuesta definitiva.']],
  ['ver cuánto hornear', 'must', [13, 13, 5], [
    'Dados los pedidos confirmados para mañana, cuando la dueña abre Producción a las 18:00, entonces ve las unidades por producto y por bloque.',
    'Dado un pedido confirmado después de las 18:00 para mañana, cuando se confirma, entonces la lista de producción se actualiza y avisa del cambio.',
  ], ['Tortas por encargo: mínimo 48 horas de anticipación.', 'Productos del día (queques, galletas): se confirman hasta las 18:00 del día anterior.', 'Capacidad del horno: hasta 12 tortas por día; sobre eso no se aceptan pedidos.']],
  ['marcar un producto como agotado', 'must', [8, 13, 8], [
    'Dado un producto en el catálogo, cuando la dueña lo marca «Agotado», entonces deja de poder agregarse al carro de inmediato.',
    'Dado un producto en un carro abierto, cuando se agota, entonces la clienta recibe un aviso al pagar y no se cobra.',
  ], ['Nunca se cobra un producto agotado.']],
  ['registrar las mermas', 'should', [5, 2, 3], [
    'Dado el cierre del día, cuando la dueña registra una merma, entonces debe indicar producto, cantidad y motivo (vencido, dañado, error de producción).',
    'Dado un mes con mermas, cuando abre Reportes, entonces ve el costo total de mermas por motivo.',
  ], ['Una merma sin motivo no se puede guardar.', 'Los productos del día que no se venden se registran como merma a las 20:00.']],
  ['elegir el día y el bloque', 'must', [13, 8, 5], [
    'Dado un carro con despacho, cuando la clienta elige la fecha, entonces solo ve días con al menos 48 horas de anticipación y cupo disponible.',
    'Dado un bloque con 6 entregas, cuando se llena, entonces deja de ofrecerse.',
    'Dado un domingo, cuando la clienta elige fecha, entonces no aparece como opción.',
  ], ['Bloques de entrega: 10–13 h y 15–19 h, de lunes a sábado.', 'Máximo 6 entregas por bloque.']],
];
for (const [inicio, prioridad, [valor, urgencia, riesgo], criterios, reglas] of DETALLE) {
  const x = p.historias.find((y) => y.quiero.startsWith(inicio));
  if (!x) throw new Error(`No encontré la historia que empieza con «${inicio}»`);
  Object.assign(x, { prioridad, priorizacion: { valor, urgencia, riesgo }, reglas, ...(criterios ? { criterios } : {}) });
}

// El circuito del pedido, levantado con Carla: de «quiero una torta» a la entrega
{
  const id = (inicio) => p.historias.find((y) => y.quiero.startsWith(inicio)).id;
  let pr = ['Clienta', 'Tienda en línea', 'Carla (dueña)'].reduce(agregarCarril, PROCESO_VACIO);
  const [clienta, tienda, duena] = pr.carriles.map((c) => c.id);
  const pasos = [
    ['inicio', 'Quiere una torta', clienta, []],
    ['tarea', 'Elige productos y ve el detalle', clienta, ['ver el detalle', 'buscar y filtrar']],
    ['tarea', 'Arma el carro y elige día y bloque de entrega', clienta, ['agregar productos al carro', 'elegir el día y el bloque']],
    ['decision', '¿Hay cupo y stock?', tienda, []],
    ['tarea', 'Paga con tarjeta o transferencia', clienta, ['pagar con tarjeta', 'pagar en cuotas']],
    ['decision', '¿Pago aprobado?', tienda, []],
    ['tarea', 'Confirma el pedido por correo', tienda, ['recibir un correo']],
    ['tarea', 'Planifica la producción del día', duena, ['ver cuánto hornear', 'marcar un producto como agotado']],
    ['tarea', 'Hornea y registra mermas', duena, ['registrar las mermas']],
    ['tarea', 'Despacha o entrega en tienda', duena, ['ver los pedidos del día']],
    ['fin', 'Recibe su pedido', clienta, []],
  ];
  for (const [tipo, texto, carril, historias] of pasos) {
    pr = agregarPaso(pr, { tipo, texto, carril });
    pr.pasos[pr.pasos.length - 1].historiaIds = historias.map(id);
  }
  const [, elegir, carro, cupo, pagar, aprobado, correo] = pr.pasos.map((x) => x.id);
  pr = conectar(conectar(pr, cupo, pagar, 'Sí'), cupo, carro, 'No: otra fecha');
  pr = conectar(conectar(pr, aprobado, correo, 'Sí'), aprobado, pagar, 'No: reintenta');
  // Flujo de valor medido con Carla (minutos): el pedido espera casi un día al bloque de despacho
  const TIEMPOS = {
    'Elige productos y ve el detalle': [15, 0],
    'Arma el carro y elige día y bloque de entrega': [5, 0],
    'Paga con tarjeta o transferencia': [5, 0],
    'Confirma el pedido por correo': [1, 0],
    'Planifica la producción del día': [30, 720],
    'Hornea y registra mermas': [240, 120],
    'Despacha o entrega en tienda': [60, 1320],
  };
  pr.pasos = pr.pasos.map((x) => (TIEMPOS[x.texto] ? { ...x, trabajo: TIEMPOS[x.texto][0], espera: TIEMPOS[x.texto][1] } : x));
  p.proceso = pr;
  // Quiénes participan, según su poder y su interés
  const [clientaC, tiendaC, duenaC] = pr.carriles.map((c) => c.id);
  p.stakeholders = [
    { id: 'st-carla', nombre: 'Carla Rojas', cargo: 'Dueña de la pastelería', rol: 'aprueba', poder: 'alto', interes: 'alto', carril: duenaC, notas: '' },
    { id: 'st-valentina', nombre: 'Valentina', cargo: 'Clienta frecuente', rol: 'usa', poder: 'bajo', interes: 'alto', carril: clientaC, notas: 'Probó el prototipo del carro.' },
    { id: 'st-matias', nombre: 'Matías', cargo: 'Repartidor', rol: 'opera', poder: 'bajo', interes: 'alto', carril: null, notas: '' },
    { id: 'st-ignacio', nombre: 'Ignacio', cargo: 'Sobrino; administra la tienda en línea', rol: 'mantiene', poder: 'bajo', interes: 'bajo', carril: tiendaC, notas: '' },
    { id: 'st-rosa', nombre: 'Rosa', cargo: 'Contadora externa', rol: 'otro', poder: 'alto', interes: 'bajo', carril: null, notas: 'Decide cómo se emiten las boletas.' },
  ];
  void elegir;
}

// OKR e hipótesis
p = agregarObjetivo(p, 'Vender más en línea');
p = agregarResultado(p, p.objetivos[0].id, 'Pedidos por la tienda: del 0% al 40%');
p = agregarResultado(p, p.objetivos[0].id, 'Mensajes de consulta: bajar a la mitad');
const [kr1, kr2] = p.objetivos[0].resultados.map((r) => r.id);
// Los resultados clave se miden: adopción de la tienda y consultas por mensaje
p.objetivos[0].resultados = p.objetivos[0].resultados.map((r) => (r.id === kr1
  ? { ...r, unidad: '%', base: 0, meta: 40, mediciones: [[-28, 6], [-14, 15], [-1, 24]].map(([d, valor]) => ({ fecha: fechaISO(dias(d)), valor })) }
  : { ...r, unidad: 'por semana', base: 200, meta: 100, mediciones: [[-28, 180], [-14, 130], [-1, 95]].map(([d, valor]) => ({ fecha: fechaISO(dias(d)), valor })) }));
p = editarEpica(p, 'Catálogo', { creemos: 'mostrar precio y stock', lograremos: 'menos consultas por mensaje', veremos: 'los mensajes bajen a la mitad', resultados: [kr2], resultadoHipotesis: 'cumplida', datoReal: 'de 200 a 95 mensajes por semana' });
p = editarEpica(p, 'Boletas', { horizonte: 'despues' });
p = editarEpica(p, 'Compra', { creemos: 'permitir pagar en línea', lograremos: 'que más visitas terminen comprando', veremos: 'el 40% de los pedidos llegue por la tienda', resultados: [kr1] });

// Dos sprints cerrados y uno en curso
const s1 = { id: 's1', nombre: 'Sprint 1', objetivo: 'Que las clientas vean el catálogo con precios', inicio: fechaISO(dias(-28)), fin: fechaISO(dias(-15)), capacidad: 10, estado: 'cerrado', feedback: '' };
const s2 = { id: 's2', nombre: 'Sprint 2', objetivo: 'Que las clientas armen su carro', inicio: fechaISO(dias(-14)), fin: fechaISO(dias(-1)), capacidad: 10, estado: 'cerrado', feedback: '' };
const s3 = { id: 's3', nombre: 'Sprint 3', objetivo: 'Que las clientas puedan pagar en línea', inicio: fechaISO(dias(0)), fin: fechaISO(dias(13)), capacidad: 13, estado: 'activo', feedback: '' };
p.sprints = [s1, s2, s3];
const h = p.historias;
const terminar = (i, sprint, inicio, fin) => { h[i] = cambiarEstado(cambiarEstado({ ...h[i], sprintId: sprint }, 'doing', dias(inicio)), 'done', dias(fin)); };
terminar(0, 's1', -27, -24);
terminar(1, 's1', -24, -17);
terminar(2, 's2', -13, -9);
terminar(6, 's2', -9, -3);
h[3] = cambiarEstado({ ...h[3], sprintId: 's3' }, 'doing', dias(0));
h[4] = bloquear(cambiarEstado({ ...h[4], sprintId: 's3' }, 'doing', dias(0)), 'Falta la cuenta de la pasarela de pago a nombre de Carla', dias(-1));
h[5] = { ...h[5], sprintId: 's3', estado: 'todo' };
p.flujo = { revision: true, wip: { doing: 2, review: 2 } };
p = agregarDependencia(p, 'h-extra-1', h[3].id);

// Retro del sprint 2
let r = nuevaRetro(p);
r = agregarNota(r, 'bien', 'Carla respondió las dudas el mismo día');
r = agregarNota(r, 'mejorar', 'Las fotos llegaron tarde y atrasaron el catálogo');
r = agregarNota(r, 'ideas', 'Pedir fotos y textos con una semana de anticipación');
r = votar(votar(r, r.notas[1].id), r.notas[1].id);
r = agregarAccion(r, 'Pedir los materiales del siguiente sprint en la Review', 'Rodrigo');
p.retros = [r];

// Hitos de pago y una solicitud de cambio
p.hitos = sugerirHitos(p, 3).map((x, i) => ({ ...x, fecha: fechaISO(dias(14 * (i + 1) - 1)) }));
p.hitos[0] = { ...p.hitos[0], estado: 'aceptado', aceptacion: { nombre: 'Carla Rojas', fecha: fechaISO(dias(-1)) } };
p = registrarCambio(p, 'Agregar un blog de recetas en la tienda', 12);
// Las historias se levantaron antes del primer sprint (para que los tiempos de entrega tengan sentido)
for (const x of p.historias) x.creada = dias(-35).toISOString();
p.respaldado = new Date().toISOString();

const destino = fileURLToPath(new URL('../docs/ejemplo/', import.meta.url));
await mkdir(destino, { recursive: true });
await writeFile(`${destino}pasteleria-carla.json`, JSON.stringify(p, null, 2));
console.log('Listo: docs/ejemplo/pasteleria-carla.json');
