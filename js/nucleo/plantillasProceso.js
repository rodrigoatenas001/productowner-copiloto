// Catálogo acotado de procesos por industria: un punto de partida para levantar el circuito real,
// no un modelo cerrado. Cada plantilla trae carriles, el camino feliz, sus decisiones, tiempos de trabajo
// y espera sugeridos (minutos), el para qué de cada tarea y los dolores típicos para confirmar en terreno.
//
// Formato de cada paso: [ref, tipo, texto, carril (índice), opciones]
//   opciones: { trabajo, espera, valor, dolores: [texto], reglas: [texto], a: [[ref, etiqueta]] }
// Sin «a», una tarea o un inicio va al paso siguiente de la lista.
import { nuevoId } from './historias.js';

const H = 60;
const D = 1440;

export const INDUSTRIAS = {
  agro: { nombre: 'Agroindustria y plantas', descripcion: 'Plantas de alimentos y manufactura: materia prima, líneas de proceso y mantenimiento.' },
  construccion: { nombre: 'Construcción y obras', descripcion: 'Obras e ingeniería: estados de pago, avance en terreno y bodega.' },
};

export const PLANTILLAS_PROCESO = [
  {
    clave: 'agro-recepcion',
    industria: 'agro',
    nombre: 'Recepción y control de calidad de materia prima',
    descripcion: 'Desde que llega el camión hasta que la materia prima queda disponible o se rechaza.',
    carriles: ['Transporte / proveedor', 'Recepción (romana)', 'Control de calidad', 'Sistema / ERP'],
    pasos: [
      ['inicio', 'inicio', 'Llega el camión con materia prima', 0],
      ['pesaje', 'tarea', 'Pesar en romana y registrar la guía de despacho', 1, { trabajo: 15, espera: 45, valor: 'saber cuánto llegó y de qué proveedor', dolores: ['Doble digitación de la guía: papel en la romana y luego el ERP', 'Cola de camiones en horas punta'], reglas: ['La guía debe calzar con la orden de compra'] }],
      ['muestra', 'tarea', 'Tomar muestras y registrar el análisis de calidad', 2, { trabajo: 30, espera: 4 * H, valor: 'liberar o retener el lote con datos', dolores: ['El resultado del laboratorio llega horas después y el lote espera retenido', 'Resultados en papel, sin historial por proveedor'], reglas: ['Toda partida queda retenida hasta tener el resultado'] }],
      ['cumple', 'decision', '¿Cumple la especificación?', 2, { a: [['ingreso', 'Sí'], ['rechazo', 'No']] }],
      ['ingreso', 'tarea', 'Ingresar el lote a bodega o línea con su trazabilidad', 3, { trabajo: 10, espera: 30, valor: 'que el lote pueda rastrearse hasta el producto final', dolores: ['Sin trazabilidad entre el lote del proveedor y el lote interno'], reglas: ['Cada lote interno guarda el lote y la guía de origen'], a: [['disponible', '']] }],
      ['rechazo', 'tarea', 'Retener o rechazar la partida e informar al proveedor', 2, { trabajo: 20, espera: 60, valor: 'que el proveedor corrija y quede evidencia del rechazo', dolores: ['El aviso al proveedor se hace por teléfono y no queda registro'], a: [['fin-rechazo', '']] }],
      ['disponible', 'fin', 'Materia prima disponible para producción', 1],
      ['fin-rechazo', 'fin', 'Partida rechazada con evidencia', 2],
    ],
  },
  {
    clave: 'agro-mermas',
    industria: 'agro',
    nombre: 'Control de mermas en la línea de proceso',
    descripcion: 'El registro de producción y mermas por turno, y la reacción cuando la merma supera el estándar.',
    carriles: ['Operador de línea', 'Supervisor de turno', 'Calidad', 'Sistema / ERP'],
    pasos: [
      ['inicio', 'inicio', 'Comienza el turno', 0],
      ['registro', 'tarea', 'Registrar producción y mermas por estación', 0, { trabajo: 20, espera: 0, valor: 'saber cuánto se pierde en cada estación durante el turno', dolores: ['Mermas anotadas en papel y digitadas al final del turno', 'Causas de merma sin clasificar: no se puede atacar la principal'], reglas: ['Toda merma indica estación, cantidad y causa'] }],
      ['consolida', 'tarea', 'Consolidar las planillas del turno', 1, { trabajo: 45, espera: 2 * H, valor: 'tener la merma del turno sin esperar al día siguiente', dolores: ['El supervisor se entera de la merma alta al día siguiente'] }],
      ['sobre', 'decision', '¿La merma supera el estándar?', 1, { a: [['causa', 'Sí'], ['cierre', 'No']] }],
      ['causa', 'tarea', 'Analizar la causa y definir una acción correctiva', 2, { trabajo: 60, espera: D, valor: 'que la misma merma no se repita en el próximo turno', dolores: ['Acciones correctivas sin seguimiento'], reglas: ['Toda acción correctiva tiene responsable y fecha'], a: [['cierre', '']] }],
      ['cierre', 'tarea', 'Cerrar el turno e informar producción y mermas al ERP', 3, { trabajo: 15, espera: 30, valor: 'que gerencia vea el rendimiento real de la línea', dolores: ['Cifras distintas entre la planilla y el ERP'] }],
      ['fin', 'fin', 'Turno cerrado con mermas conocidas', 1],
    ],
  },
  {
    clave: 'agro-mantenimiento',
    industria: 'agro',
    nombre: 'Mantenimiento preventivo y correctivo',
    descripcion: 'Desde la falla o la mantención programada hasta que el equipo vuelve a producir.',
    carriles: ['Operador', 'Mantenimiento', 'Bodega de repuestos', 'Jefatura de planta'],
    pasos: [
      ['inicio', 'inicio', 'Falla detectada o mantención programada', 0],
      ['aviso', 'tarea', 'Crear el aviso u orden de trabajo', 0, { trabajo: 10, espera: 0, valor: 'que ninguna falla dependa de que alguien la recuerde', dolores: ['Avisos por teléfono o de palabra que se pierden entre turnos'], reglas: ['Toda orden de trabajo indica equipo, síntoma y prioridad'] }],
      ['planifica', 'tarea', 'Priorizar y asignar la orden de trabajo', 3, { trabajo: 15, espera: 4 * H, valor: 'atender primero lo que detiene la producción', dolores: ['Prioridades definidas por quien reclama más fuerte'] }],
      ['repuesto', 'decision', '¿Requiere repuesto?', 1, { a: [['bodega', 'Sí'], ['ejecuta', 'No']] }],
      ['bodega', 'tarea', 'Solicitar y retirar el repuesto', 2, { trabajo: 20, espera: D, valor: 'tener el repuesto sin detener la línea', dolores: ['Repuesto sin stock detiene la línea', 'Stock de bodega desactualizado'], reglas: ['Los repuestos críticos tienen stock mínimo'], a: [['ejecuta', '']] }],
      ['ejecuta', 'tarea', 'Ejecutar la mantención', 1, { trabajo: 3 * H, espera: 0, valor: 'devolver el equipo a operación' }],
      ['prueba', 'tarea', 'Probar el equipo y liberarlo a producción', 0, { trabajo: 30, espera: 30, valor: 'confirmar que la falla quedó resuelta' }],
      ['cierre', 'tarea', 'Cerrar la orden con horas, repuestos y causa', 1, { trabajo: 15, espera: D, valor: 'tener el historial de cada equipo para la mantención preventiva', dolores: ['Órdenes cerradas sin horas ni causa: no hay historial del equipo'] }],
      ['fin', 'fin', 'Equipo operativo', 0],
    ],
  },
  {
    clave: 'construccion-estado-pago',
    industria: 'construccion',
    nombre: 'Ciclo del estado de pago de obra',
    descripcion: 'Desde la medición del avance del período hasta que el mandante paga.',
    carriles: ['Jefe de obra', 'Oficina técnica', 'Mandante / ITO', 'Finanzas'],
    pasos: [
      ['inicio', 'inicio', 'Cierre del período del estado de pago', 0],
      ['medir', 'tarea', 'Medir el avance por partida en terreno', 0, { trabajo: 6 * H, espera: 0, valor: 'cobrar exactamente lo ejecutado en el período', dolores: ['Cubicaciones en planillas distintas a las del presupuesto'], reglas: ['El avance se mide sobre las partidas del presupuesto contratado'] }],
      ['preparar', 'tarea', 'Preparar el estado de pago con sus respaldos', 1, { trabajo: 4 * H, espera: D, valor: 'presentar un estado de pago que la ITO apruebe a la primera', dolores: ['Respaldos (fotos, protocolos, cubicaciones) dispersos en correos'], reglas: ['Cada partida cobrada lleva su respaldo'] }],
      ['revisar', 'tarea', 'Revisar el estado de pago (ITO)', 2, { trabajo: 2 * H, espera: 3 * D, valor: 'aprobar el pago con evidencia', dolores: ['La ITO devuelve el estado de pago por diferencias menores'] }],
      ['aprueba', 'decision', '¿La ITO aprueba?', 2, { a: [['facturar', 'Sí'], ['corregir', 'No']] }],
      ['corregir', 'tarea', 'Corregir cubicaciones y respaldos observados', 1, { trabajo: 2 * H, espera: D, valor: 'volver a presentar sin perder el período', a: [['revisar', '']] }],
      ['facturar', 'tarea', 'Emitir la factura del estado de pago', 3, { trabajo: H, espera: D, valor: 'iniciar el plazo de pago del mandante' }],
      ['pago', 'tarea', 'Pagar el estado de pago', 2, { trabajo: 30, espera: 15 * D, valor: 'tener caja para seguir la obra', dolores: ['Pagos atrasados sin aviso afectan la caja de la obra'] }],
      ['fin', 'fin', 'Estado de pago cobrado', 3],
    ],
  },
  {
    clave: 'construccion-avance',
    industria: 'construccion',
    nombre: 'Control de avance diario en terreno',
    descripcion: 'El registro diario de avance, dotación y restricciones, y la reacción cuando hay desvío del programa.',
    carriles: ['Capataz / supervisor', 'Jefe de obra', 'Oficina técnica', 'Sistema'],
    pasos: [
      ['inicio', 'inicio', 'Comienza la jornada', 0],
      ['registrar', 'tarea', 'Registrar avance, dotación y fotos por partida', 0, { trabajo: 30, espera: 0, valor: 'evitar duplicar planillas al final del turno', dolores: ['Doble digitación entre la planilla de terreno y el Excel de oficina', 'Sin conexión en la obra: se anota en papel'], reglas: ['El avance se registra contra las partidas del programa'] }],
      ['restricciones', 'tarea', 'Informar restricciones del día (material, permisos, clima)', 0, { trabajo: 10, espera: 0, valor: 'que una restricción no detenga a la cuadrilla sin que nadie lo sepa', dolores: ['Las restricciones se conocen tarde y paran cuadrillas'] }],
      ['revisa', 'tarea', 'Revisar el avance del día', 1, { trabajo: 30, espera: 12 * H, valor: 'detectar el atraso el mismo día' }],
      ['desvio', 'decision', '¿Hay desvío respecto del programa?', 1, { a: [['ajustar', 'Sí'], ['informe', 'No']] }],
      ['ajustar', 'tarea', 'Ajustar el programa y gestionar la restricción', 2, { trabajo: 2 * H, espera: D, valor: 'recuperar el atraso antes de que crezca', reglas: ['Toda restricción tiene responsable y fecha de liberación'], a: [['informe', '']] }],
      ['informe', 'tarea', 'Consolidar el informe semanal de avance', 2, { trabajo: 3 * H, espera: 4 * D, valor: 'que el mandante y la gerencia vean el avance real', dolores: ['El informe semanal se arma a mano copiando de varias planillas'] }],
      ['fin', 'fin', 'Avance del día conocido', 1],
    ],
  },
  {
    clave: 'construccion-bodega',
    industria: 'construccion',
    nombre: 'Abastecimiento y bodega de obra',
    descripcion: 'Desde que la obra necesita un material hasta que llega a terreno.',
    carriles: ['Jefe de obra', 'Bodega de obra', 'Adquisiciones', 'Proveedor'],
    pasos: [
      ['inicio', 'inicio', 'Se necesita un material en terreno', 0],
      ['solicitar', 'tarea', 'Solicitar el material con un vale de pedido', 0, { trabajo: 10, espera: 0, valor: 'que bodega sepa qué se necesita y para qué partida', reglas: ['Todo vale indica partida y fecha requerida'] }],
      ['stock', 'decision', '¿Hay stock en bodega?', 1, { a: [['entregar', 'Sí'], ['comprar', 'No']] }],
      ['comprar', 'tarea', 'Cotizar y emitir la orden de compra', 2, { trabajo: 2 * H, espera: 2 * D, valor: 'comprar a tiempo y al precio acordado', dolores: ['Compras urgentes a mayor precio por no planificar'], reglas: ['Sobre cierto monto se requieren tres cotizaciones'] }],
      ['despachar', 'tarea', 'Despachar el material a la obra', 3, { trabajo: 2 * H, espera: 3 * D, valor: 'tener el material el día requerido' }],
      ['recepcionar', 'tarea', 'Recepcionar el material y registrar la guía', 1, { trabajo: 30, espera: 2 * H, valor: 'pagar solo lo que llegó', dolores: ['Guías de despacho sin conciliar con la orden de compra'], reglas: ['La guía se concilia con la orden de compra antes de pagar'], a: [['entregar', '']] }],
      ['entregar', 'tarea', 'Entregar el material y descontar el stock', 1, { trabajo: 15, espera: 30, valor: 'saber cuánto material queda y dónde se usó', dolores: ['Stock de bodega desactualizado'] }],
      ['fin', 'fin', 'Material en terreno', 0],
    ],
  },
];

export const plantillasDe = (industria) => PLANTILLAS_PROCESO.filter((p) => p.industria === industria);

/**
 * Convierte una plantilla en un proceso del modelo propio (con ids nuevos). Los dolores parten sin
 * confirmar: son sospechas típicas hasta que se vean en terreno.
 */
export function procesoDesdePlantilla(plantilla) {
  const carriles = plantilla.carriles.map((nombre) => ({ id: nuevoId('ca'), nombre }));
  const ids = new Map(plantilla.pasos.map(([ref]) => [ref, nuevoId('pa')]));
  const pasos = plantilla.pasos.map(([ref, tipo, texto, carril, o = {}], i) => {
    const siguiente = plantilla.pasos[i + 1];
    let siguientes = (o.a || []).map(([a, etiqueta]) => ({ a: ids.get(a), etiqueta }));
    if (!o.a && tipo !== 'fin' && tipo !== 'decision' && siguiente) siguientes = [{ a: ids.get(siguiente[0]), etiqueta: '' }];
    return {
      id: ids.get(ref), tipo, texto, carril: carriles[carril].id, siguientes, historiaIds: [],
      trabajo: Number.isFinite(o.trabajo) ? o.trabajo : null,
      espera: Number.isFinite(o.espera) ? o.espera : null,
      dolores: (o.dolores || []).map((t) => ({ texto: t, confirmado: false })),
      valor: o.valor || '',
      reglas: o.reglas || [],
    };
  });
  return { carriles, pasos };
}
