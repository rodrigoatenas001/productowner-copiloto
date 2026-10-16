// Casos borde (escenarios no felices) por reglas, para completar los criterios de aceptación.
// Cada familia se activa según de qué trata la historia y se omite si los criterios ya la cubren.

const sinAcentos = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const FAMILIAS = [
  {
    clave: 'datos',
    activa: /\b(ingres|registr|crear|complet|formulario|rut|correo|telefono|direccion|editar|actualizar|guardar)/,
    cubierta: /(vaci|obligatori|invalid|formato)/,
    casos: [
      'Dado que dejo un campo obligatorio vacío, cuando intento guardar, entonces veo qué campo falta y no se guarda nada.',
      'Dado un dato con formato inválido (por ejemplo, un RUT o correo mal escrito), cuando intento guardar, entonces veo el error junto al campo.',
    ],
  },
  {
    clave: 'pagos',
    activa: /\b(pag|cobr|tarjeta|transfer|abon|compr)/,
    cubierta: /(rechaz|duplic|dos veces)/,
    casos: [
      'Dado que el medio de pago rechaza la operación, cuando intento pagar, entonces veo el motivo y puedo reintentar sin perder lo que llevaba.',
      'Dado que presiono pagar dos veces seguidas, cuando se procesa, entonces se cobra una sola vez.',
    ],
  },
  {
    clave: 'archivos',
    activa: /\b(descarg|export|sub(ir|a)|adjunt|import|pdf|excel|csv|zip|archivo|imagen|foto)/,
    cubierta: /(tamano|grande|no permitid|sin datos|vaci)/,
    casos: [
      'Dado un archivo demasiado grande o de un tipo no permitido, cuando lo subo, entonces veo el límite y los formatos aceptados.',
      'Dado que no hay datos para el período elegido, cuando descargo o exporto, entonces se me avisa en vez de entregar un archivo vacío.',
    ],
  },
  {
    clave: 'busqueda',
    activa: /\b(busc|filtr|list|consult|ver )/,
    cubierta: /(sin resultado|ningun resultado|no hay resultado)/,
    casos: ['Dado que la búsqueda no encuentra nada, cuando la ejecuto, entonces veo un mensaje claro y cómo ampliar la búsqueda.'],
  },
  {
    clave: 'fechas',
    activa: /\b(fecha|reserv|agend|hora|plazo|vencim|calendario)/,
    cubierta: /(pasad|ocupad|no disponible)/,
    casos: ['Dado una fecha pasada o ya ocupada, cuando intento elegirla, entonces el sistema no lo permite y me sugiere otra.'],
  },
  {
    clave: 'avisos',
    activa: /\b(correo|email|notific|aviso|avis|recordatorio|whatsapp|sms|mensaje)/,
    cubierta: /(rebot|no llega|sin correo|falla el envio)/,
    casos: ['Dado que el envío falla o el destinatario no tiene correo, cuando corresponde avisar, entonces queda registrado y se puede reintentar.'],
  },
];

const GENERALES = {
  clave: 'general',
  cubierta: /(permiso|autoriz|sesion|conexion|red )/,
  casos: [
    'Dado que no tengo permiso o mi sesión expiró, cuando intento hacerlo, entonces se me pide ingresar y no se expone información.',
    'Dado que se pierde la conexión o falla el servidor, cuando intento hacerlo, entonces veo un mensaje claro y lo que había escrito no se pierde.',
  ],
};

/**
 * Casos borde sugeridos para una historia, sin repetir los que sus criterios ya cubren.
 * @returns {{familia: string, texto: string}[]}
 */
export function casosBorde(historia) {
  const tema = ` ${sinAcentos(`${historia.quiero} ${historia.titulo}`)} `;
  const criterios = sinAcentos((historia.criterios || []).join(' \n '));
  const sugeridos = [];
  for (const f of [...FAMILIAS.filter((x) => x.activa.test(tema)), GENERALES]) {
    if (f.cubierta.test(criterios)) continue;
    for (const texto of f.casos) if (!criterios.includes(sinAcentos(texto).slice(0, 40))) sugeridos.push({ familia: f.clave, texto });
  }
  return sugeridos;
}

/** Agrega los casos borde a los criterios, sin duplicar. */
export function agregarCasosBorde(historia, casos = casosBorde(historia)) {
  const existentes = new Set((historia.criterios || []).map(sinAcentos));
  const nuevos = casos.map((c) => c.texto).filter((t) => !existentes.has(sinAcentos(t)));
  return { ...historia, criterios: [...(historia.criterios || []), ...nuevos].slice(0, 20) };
}
