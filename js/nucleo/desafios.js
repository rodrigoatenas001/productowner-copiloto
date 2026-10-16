// Desafíos del taller: pronosticar, clasificar ítems y validar hipótesis. Con semilla para repetirlos.
import { barajar } from './trivia.js';

function azar(semilla) {
  let s = semilla % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Pronóstico: con tres velocidades y lo que queda, ¿cuántos sprints faltan? */
export function desafioPronostico(semilla = Date.now()) {
  const r = azar(semilla);
  const velocidades = [0, 0, 0].map(() => 12 + Math.floor(r() * 14)); // entre 12 y 25 puntos
  const restante = 40 + Math.floor(r() * 80); // entre 40 y 119 puntos
  const promedio = velocidades.reduce((a, b) => a + b, 0) / 3;
  return {
    velocidades,
    restante,
    respuesta: {
      probable: Math.ceil(restante / promedio),
      optimista: Math.ceil(restante / Math.max(...velocidades)),
      pesimista: Math.ceil(restante / Math.min(...velocidades)),
    },
    explicacion: `Promedio ${Math.round(promedio * 10) / 10} pts por sprint: ${restante} ÷ ${Math.round(promedio * 10) / 10} = ${(restante / promedio).toFixed(1)}, y se redondea hacia arriba porque un sprint a medias igual es un sprint.`,
  };
}

/** Evalúa la respuesta del pronóstico: acierto exacto o dentro del rango. */
export function evaluarPronostico(desafio, sprints) {
  const n = Number(sprints);
  const { probable, optimista, pesimista } = desafio.respuesta;
  if (n === probable) return { nivel: 'exacto', texto: `¡Exacto! ${probable} sprints es lo probable. Rango: entre ${optimista} y ${pesimista}.` };
  if (n >= optimista && n <= pesimista) return { nivel: 'rango', texto: `Está dentro del rango (${optimista} a ${pesimista}), pero lo probable es ${probable}.` };
  return { nivel: 'fuera', texto: `Lo probable es ${probable} sprints (rango ${optimista} a ${pesimista}).` };
}

export const ITEMS_CLASIFICAR = [
  { texto: 'Al pagar con tarjeta Visa aparece un error 500 y no se cobra.', tipo: 'bug', porque: 'Algo que debería funcionar no funciona: es un bug.' },
  { texto: 'Como clienta, quiero guardar mi dirección, para no escribirla en cada compra.', tipo: 'historia', porque: 'Entrega valor nuevo a una persona usuaria.' },
  { texto: 'Investigar en 2 días si la pasarela X permite pagos en cuotas.', tipo: 'spike', porque: 'Su resultado es conocimiento, con un plazo acotado.' },
  { texto: 'Actualizar el framework que dejará de tener soporte de seguridad en marzo.', tipo: 'deuda', porque: 'No agrega funcionalidad, pero reduce un riesgo que crece con el tiempo.' },
  { texto: 'El total del carrito no suma el despacho cuando hay un cupón.', tipo: 'bug', porque: 'El cálculo es incorrecto respecto de lo esperado.' },
  { texto: 'Probar con 5 clientas si entienden el nuevo flujo de checkout antes de construirlo.', tipo: 'spike', porque: 'Es investigación para decidir, no construcción.' },
  { texto: 'Separar el módulo de reportes que tarda 40 segundos y nadie se atreve a tocar.', tipo: 'deuda', porque: 'Es código difícil de mantener que frena el trabajo futuro.' },
  { texto: 'Como contadora, quiero exportar las ventas del mes en Excel, para declarar a tiempo.', tipo: 'historia', porque: 'Es una necesidad de una persona, con beneficio claro.' },
];

export function desafioClasificar(semilla = Date.now(), cantidad = 6) {
  return barajar(ITEMS_CLASIFICAR, semilla).slice(0, cantidad);
}

/** @param {string[]} respuestas tipos elegidos, en el mismo orden */
export function evaluarClasificacion(items, respuestas) {
  const detalle = items.map((it, i) => ({ ...it, elegido: respuestas[i] || null, correcto: respuestas[i] === it.tipo }));
  return { aciertos: detalle.filter((d) => d.correcto).length, total: items.length, detalle };
}

export const HIPOTESIS = [
  {
    hipotesis: 'Creemos que al mostrar los precios en el catálogo, lograremos menos consultas por mensaje; lo sabremos cuando los mensajes bajen al menos 30% en un mes.',
    dato: 'Un mes después, los mensajes bajaron de 200 a 120 por semana.',
    respuesta: 'cumplida',
    porque: 'Bajaron 40%, más que el 30% esperado.',
  },
  {
    hipotesis: 'Creemos que al permitir pagar en cuotas, lograremos más compras grandes; lo sabremos cuando las compras sobre $50.000 suban 25% en dos meses.',
    dato: 'En dos meses subieron 10%.',
    respuesta: 'parcial',
    porque: 'Hubo efecto, pero menor al esperado: conviene investigar por qué antes de invertir más.',
  },
  {
    hipotesis: 'Creemos que al enviar recordatorios por WhatsApp, lograremos menos inasistencias; lo sabremos cuando bajen del 20% al 10%.',
    dato: 'Las inasistencias se mantuvieron en 19%.',
    respuesta: 'no',
    porque: 'Prácticamente no cambió. No es un fracaso: aprendimos que el problema está en otra parte.',
  },
  {
    hipotesis: 'Creemos que al simplificar el registro a 2 pasos, lograremos más cuentas nuevas; lo sabremos cuando la conversión del registro pase de 30% a 45%.',
    dato: 'La conversión llegó a 47%.',
    respuesta: 'cumplida',
    porque: 'Superó la meta de 45%.',
  },
];

export const OPCIONES_HIPOTESIS = { cumplida: 'Se cumplió', parcial: 'Se cumplió en parte', no: 'No se cumplió' };

export function desafioHipotesis(semilla = Date.now()) {
  return barajar(HIPOTESIS, semilla)[0];
}
