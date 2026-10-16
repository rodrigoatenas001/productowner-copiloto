// Ejercicios de bootcamp: un caso de negocio, el alumno escribe historias y recibe retroalimentación
// inmediata (calidad INVEST + qué necesidades del caso cubrió). Sin IA.
import { notasAHistorias, revisarInvest, calidad } from './historias.js';

const sinAcentos = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const CASOS = [
  {
    id: 'pasteleria',
    titulo: 'Pastelería que vende por Instagram',
    nivel: 'Inicial',
    contexto: 'Carla tiene una pastelería en Ñuñoa. Recibe pedidos por mensajes de Instagram, los anota en un cuaderno y a veces se le olvidan. Los clientes preguntan una y otra vez el precio y si hay disponibilidad para el fin de semana. Cobra por transferencia y revisa a mano si llegó el pago.',
    consigna: 'Escribe entre 3 y 6 historias de usuario para una primera versión de su sistema de pedidos.',
    necesidades: [
      { nombre: 'Ver productos y precios', claves: ['precio', 'catalogo', 'menu', 'carta', 'productos', 'torta'] },
      { nombre: 'Reservar o pedir para una fecha', claves: ['fecha', 'reserv', 'agend', 'pedido', 'pedir', 'encarg'] },
      { nombre: 'Saber si hay disponibilidad', claves: ['disponib', 'cupo', 'capacidad'] },
      { nombre: 'Confirmar el pago', claves: ['pago', 'pagar', 'transfer', 'abono'] },
      { nombre: 'Que Carla vea sus pedidos ordenados', claves: ['listado', 'lista de pedidos', 'ver los pedidos', 'ver mis pedidos', 'pedidos del', 'agenda', 'calendario', 'organiz'] },
    ],
    ejemplo: [
      'Como clienta, quiero ver las tortas con su precio, para decidir sin tener que preguntar.',
      'Como clienta, quiero encargar una torta para una fecha, para tenerla el día de mi celebración.',
      'Como Carla, quiero ver los pedidos de la semana ordenados por fecha, para no olvidar ninguno.',
      'Como Carla, quiero marcar un pedido como pagado al recibir la transferencia, para saber qué está confirmado.',
    ],
  },
  {
    id: 'clinica',
    titulo: 'Agenda de una clínica dental',
    nivel: 'Intermedio',
    contexto: 'Una clínica con 4 dentistas agenda horas por teléfono. Los pacientes faltan sin avisar (un 20% de las horas), la recepcionista pasa la mañana confirmando por WhatsApp y los dentistas no saben con anticipación qué tratamiento viene.',
    consigna: 'Escribe historias para reducir las inasistencias y ordenar la agenda. Piensa en pacientes, recepción y dentistas.',
    necesidades: [
      { nombre: 'Pedir hora sin llamar', claves: ['pedir hora', 'agendar', 'reservar', 'tomar hora', 'agenda'] },
      { nombre: 'Recordatorio o confirmación', claves: ['recordatorio', 'record', 'confirm', 'aviso', 'notific'] },
      { nombre: 'Cancelar o cambiar la hora', claves: ['cancel', 'reagend', 'cambiar la hora', 'cambiar mi hora', 'anular'] },
      { nombre: 'Dentista ve el tratamiento antes', claves: ['tratamiento', 'ficha', 'motivo', 'antecedente'] },
      { nombre: 'Medir inasistencias', claves: ['inasist', 'falta', 'no asist', 'ausen', 'reporte'] },
    ],
    ejemplo: [
      'Como paciente, quiero recibir un recordatorio el día anterior con opción de confirmar, para no olvidar mi hora.',
      'Como paciente, quiero cancelar mi hora desde el recordatorio, para liberar el cupo sin llamar.',
      'Como dentista, quiero ver el motivo de la consulta al abrir la agenda del día, para prepararme.',
      'Como administradora, quiero ver el porcentaje de inasistencias por mes, para saber si las medidas funcionan.',
    ],
  },
  {
    id: 'ferreteria',
    titulo: 'Inventario de una ferretería',
    nivel: 'Intermedio',
    contexto: 'Una ferretería de barrio con dos sucursales lleva el stock en planillas Excel distintas. Se quedan sin productos que se venden mucho, compran de más lo que no rota y no saben qué hay en la otra sucursal cuando un cliente pregunta.',
    consigna: 'Escribe historias para un sistema de inventario simple. Evita historias técnicas sin beneficio claro.',
    necesidades: [
      { nombre: 'Ver stock de ambas sucursales', claves: ['sucursal', 'otra tienda', 'stock', 'existencia', 'inventario'] },
      { nombre: 'Alerta de stock bajo', claves: ['bajo', 'minimo', 'alerta', 'quiebre', 'agot'] },
      { nombre: 'Registrar ventas o salidas', claves: ['venta', 'vender', 'salida', 'descontar'] },
      { nombre: 'Registrar compras o entradas', claves: ['compra', 'recep', 'entrada', 'proveedor', 'ingres'] },
      { nombre: 'Saber qué no rota', claves: ['rota', 'rotacion', 'no se vende', 'mas vendido', 'menos vendido', 'reporte'] },
    ],
    ejemplo: [
      'Como vendedor, quiero ver el stock de un producto en ambas sucursales, para ofrecerlo aunque no esté aquí.',
      'Como encargado de compras, quiero recibir una alerta cuando un producto baja del mínimo, para reponerlo a tiempo.',
      'Como dueño, quiero ver los productos sin ventas en los últimos 90 días, para no volver a comprarlos.',
    ],
  },
  {
    id: 'municipio',
    titulo: 'Reclamos vecinales de un municipio',
    nivel: 'Avanzado',
    contexto: 'Un municipio recibe reclamos (baches, luminarias, basura) por teléfono, correo y en persona. No hay número de seguimiento, los vecinos no saben si su reclamo avanzó y las direcciones municipales se culpan entre sí. El alcalde quiere un tablero con tiempos de respuesta por tipo de reclamo.',
    consigna: 'Escribe historias para vecinos, funcionarios y autoridades. Cuida que cada historia sea pequeña y testeable.',
    necesidades: [
      { nombre: 'Ingresar un reclamo', claves: ['ingres', 'reportar', 'crear un reclamo', 'registrar', 'denunci'] },
      { nombre: 'Seguimiento para el vecino', claves: ['seguimiento', 'estado', 'avance', 'numero', 'codigo'] },
      { nombre: 'Derivar a la dirección correcta', claves: ['deriv', 'asign', 'direccion', 'departamento', 'responsable'] },
      { nombre: 'Adjuntar ubicación o foto', claves: ['foto', 'ubicacion', 'mapa', 'direccion exacta', 'imagen'] },
      { nombre: 'Tiempos de respuesta', claves: ['tiempo', 'plazo', 'demora', 'tablero', 'indicador', 'metric'] },
    ],
    ejemplo: [
      'Como vecina, quiero reportar un bache con una foto y su ubicación, para que lo encuentren sin llamarme.',
      'Como vecina, quiero consultar el estado de mi reclamo con su número, para saber si avanzó.',
      'Como funcionario de operaciones, quiero derivar un reclamo a la dirección que corresponde, para que no se pierda.',
      'Como alcalde, quiero ver el tiempo promedio de respuesta por tipo de reclamo, para priorizar recursos.',
    ],
  },
];

/**
 * Evalúa lo que escribió el alumno.
 * @returns {{historias: object[], cobertura: {nombre: string, cubierta: boolean}[], calidadPromedio: number, puntaje: number, comentarios: string[]}}
 */
export function evaluarEjercicio(caso, texto, { rolPorDefecto = 'usuario' } = {}) {
  const historias = notasAHistorias(texto, { rolPorDefecto });
  const unido = sinAcentos(historias.map((x) => `${x.rol} ${x.quiero} ${x.para}`).join(' \n '));
  const cobertura = caso.necesidades.map((n) => ({ nombre: n.nombre, cubierta: n.claves.some((c) => unido.includes(sinAcentos(c))) }));
  const calidades = historias.map(calidad);
  const calidadPromedio = calidades.length ? Math.round(calidades.reduce((a, b) => a + b, 0) / calidades.length) : 0;
  const cubiertas = cobertura.filter((c) => c.cubierta).length;
  const porcentajeCobertura = Math.round((cubiertas / caso.necesidades.length) * 100);
  const puntaje = historias.length ? Math.round(calidadPromedio * 0.6 + porcentajeCobertura * 0.4) : 0;

  const comentarios = [];
  if (!historias.length) comentarios.push('Escribe al menos una historia: una por línea.');
  if (historias.length > 8) comentarios.push('Son muchas historias para una primera versión: ¿cuáles son imprescindibles?');
  const avisos = historias.flatMap((x) => revisarInvest(x).map((a) => a.codigo));
  const cuenta = (c) => avisos.filter((a) => a === c).length;
  if (cuenta('valor')) comentarios.push(`A ${cuenta('valor')} historia(s) les falta el "para qué".`);
  if (cuenta('rol')) comentarios.push('Usa roles concretos del caso (clienta, recepcionista, dueño…) en vez de "usuario".');
  if (cuenta('varias')) comentarios.push('Hay historias que piden varias cosas a la vez: divídelas.');
  if (cuenta('vaga')) comentarios.push('Hay palabras que no se pueden verificar ("rápido", "fácil"…): di cómo se mide.');
  const faltantes = cobertura.filter((c) => !c.cubierta).map((c) => c.nombre.charAt(0).toLowerCase() + c.nombre.slice(1));
  if (historias.length && faltantes.length) comentarios.push(`Necesidades del caso sin cubrir: ${faltantes.join(', ')}.`);
  if (historias.length && !comentarios.length) comentarios.push('¡Muy bien! Historias claras que cubren lo principal del caso.');

  return { historias, cobertura, calidadPromedio, puntaje, comentarios };
}
