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

const DIA = 86400000;
const hoy = new Date();
const dias = (n) => new Date(hoy.getTime() + n * DIA);

let p = nuevoProyecto('Pastelería de Carla');
p = aplicarPlantilla(p, 'ecommerce');
p.rolPorDefecto = 'clienta';
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

// OKR e hipótesis
p = agregarObjetivo(p, 'Vender más en línea');
p = agregarResultado(p, p.objetivos[0].id, 'Pedidos por la tienda: del 0% al 40%');
p = agregarResultado(p, p.objetivos[0].id, 'Mensajes de consulta: bajar a la mitad');
const [kr1, kr2] = p.objetivos[0].resultados.map((r) => r.id);
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
p.respaldado = new Date().toISOString();

const destino = fileURLToPath(new URL('../docs/ejemplo/', import.meta.url));
await mkdir(destino, { recursive: true });
await writeFile(`${destino}pasteleria-carla.json`, JSON.stringify(p, null, 2));
console.log('Listo: docs/ejemplo/pasteleria-carla.json');
