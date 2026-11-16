// Núcleo sin interfaz: de notas sueltas a historias de usuario, y revisión INVEST.
// Funciona sin IA. Todas las funciones son puras para poder probarlas con `node --test`.

const VIÑETA = /^\s*(?:[-*•·–]|\d+[.)]|\[[ x]\])\s+/i;
const TITULO = /^\s*(?:#{1,6}\s+(.+?)|(.{2,80}?):)\s*$/;

/**
 * Palabras que suelen esconder un requisito poco verificable, con una forma de medirlas.
 * Las cifras son un punto de partida para conversar, no un estándar.
 */
export const METRICAS_VAGAS = {
  rápido: 'en menos de 2 segundos (o el tiempo que acuerden con el equipo)',
  lento: 'si tarda más de N segundos',
  fácil: 'en máximo 3 pasos, sin ayuda, la primera vez (pruébalo con 5 personas)',
  intuitivo: 'que 4 de 5 personas lo logren sin ayuda la primera vez',
  amigable: 'que 4 de 5 personas lo logren sin ayuda la primera vez',
  simple: 'en máximo 3 pasos o pantallas',
  sencillo: 'en máximo 3 pasos o pantallas',
  mejor: 'de cuánto a cuánto (por ejemplo, de 10 a 5 minutos)',
  mejorar: 'de cuánto a cuánto (por ejemplo, de 10 a 5 minutos)',
  optimizar: 'de cuánto a cuánto y cómo se mide',
  eficiente: 'en cuántos pasos, minutos o recursos',
  robusto: 'cuántos usuarios simultáneos o errores por día se aceptan',
  flexible: 'qué se puede configurar y quién lo configura',
  moderno: 'según qué diseño aprobado (enlace o captura)',
  bonito: 'según qué diseño aprobado (enlace o captura)',
  etc: 'la lista completa (lo que no se nombra no se construye)',
};

const VARIANTES = { rápida: 'rápido', rapido: 'rápido', rapida: 'rápido', lenta: 'lento', facil: 'fácil', intuitiva: 'intuitivo', sencilla: 'sencillo', moderna: 'moderno', bonita: 'bonito' };

/** Palabras vagas reconocidas (incluye variantes sin tilde y femeninas). */
export const PALABRAS_VAGAS = [...Object.keys(METRICAS_VAGAS), ...Object.keys(VARIANTES)];

/** Busca palabras vagas en un texto. @returns {{palabra: string, metrica: string}[]} */
export function palabrasVagas(texto) {
  const encontradas = new Map();
  for (const p of PALABRAS_VAGAS) {
    if (new RegExp(`(^|[^\\p{L}])${p}([^\\p{L}]|$)`, 'iu').test(String(texto || ''))) {
      const base = VARIANTES[p] || p;
      if (!encontradas.has(base)) encontradas.set(base, { palabra: p, metrica: METRICAS_VAGAS[base] });
    }
  }
  return [...encontradas.values()];
}

/** Términos que indican una tarea técnica más que valor para alguien. */
const TECNICAS = /\b(refactor\w*|migra\w*|base de datos|bd|api|endpoint|servidor|deploy\w*|despliegue|librer[ií]a|framework|docker|kubernetes|cache|índice|indice|tabla)\b/i;

/** Frases de relleno al inicio de una nota que no forman parte de lo que se quiere. */
const RELLENO = /^(?:hay que|tenemos que|necesitamos(?: que)?|se necesita(?: que)?|se debe(?:ría)?|debemos|deber[ií]amos|queremos(?: que)?|quiero(?: que)?|falta(?:n)?|ojal[aá]|idea:|pendiente:|todo:)\s+/i;

// Verbos con que se anota lo que pidió alguien sin decir quién: «quiere que agenden…», «necesita saber…».
// Se quitan, pero se conserva el «que» para que la frase quede bien armada («quiero que agenden…»).
const PEDIDO = /^(?:quiere|quieren|necesita|necesitan|le gustar[ií]a|les gustar[ií]a|pide|piden|pidi[oó]|busca|espera)\s+/i;

// Lo que debe hacer el sistema o la página: «el sistema debe ser rápido» → «que el sistema sea rápido».
const SISTEMA = /^(?:el\s+|la\s+)?(sistema|app|aplicaci[oó]n|p[aá]gina|sitio(?: web)?|plataforma)\s+(?:debe|deber[ií]a|tiene que|tendr[ií]a que)\s+(.+)$/i;
const SUBJUNTIVO = { ser: 'sea', estar: 'esté', tener: 'tenga', funcionar: 'funcione', permitir: 'permita', mostrar: 'muestre', enviar: 'envíe', guardar: 'guarde', avisar: 'avise', calcular: 'calcule', cargar: 'cargue' };

// Líneas que no son una necesidad: el encabezado de la reunión, una pregunta abierta o la descripción de un problema
const CONTEXTO = /^(?:reuni[oó]n|minuta|notas? de|acta|asisten(?:tes)?|fecha|participan|llamada con|entrevista con)\b/i;
const PREGUNTA = /\?|\b(?:no est[aá] segur[oa]|no sabe|por definir|a definir|evaluar si|ver si)\b/i;
const PROBLEMA = /^(?:hoy|actualmente|ahora|a veces|siempre|nunca|el problema|se pierden?|no hay|no se puede|l[oa]s? \p{L}+ (?:llaman|reclaman|esperan|pierden))\b/iu;

/** Qué es una línea de notas cuando no es una necesidad: 'contexto', 'pregunta' o 'problema'. */
export function tipoDeNota(texto) {
  const t = String(texto || '').trim();
  if (CONTEXTO.test(t)) return 'contexto';
  if (PREGUNTA.test(t)) return 'pregunta';
  if (PROBLEMA.test(t)) return 'problema';
  return null;
}

/** El criterio de plantilla que versiones anteriores agregaban solas: no sirve para aceptar nada. */
export const esCriterioGenerico = (c) => /^Dado que tengo acceso, cuando intento .*, entonces el sistema me confirma que se realizó\.?$/.test(String(c).trim());

const PATRON_HISTORIA = /^como\s+(?:un[ao]?\s+)?(.+?),?\s+quiero\s+(?:poder\s+)?(.+?)(?:,?\s+para\s+(?:que\s+)?(.+?))?\.?$/i;

let contador = 0;
/** Identificador corto y único dentro de la sesión (más un componente aleatorio). */
export function nuevoId(prefijo = 'h') {
  contador += 1;
  return `${prefijo}-${Date.now().toString(36)}-${contador.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Separa un texto libre en ítems: una idea por viñeta o por línea.
 * Las líneas que terminan en ":" o empiezan con "#" se tratan como épica de lo que sigue.
 * Una línea sin viñeta inmediatamente después de una viñeta se considera continuación.
 * @returns {{texto: string, epica: string|null}[]}
 */
export function extraerItems(texto) {
  const items = [];
  let epica = null;
  let ultimoConViñeta = false;

  for (const cruda of String(texto ?? '').split(/\r?\n/)) {
    const linea = cruda.trim();
    if (!linea) {
      ultimoConViñeta = false;
      continue;
    }

    const titulo = linea.match(TITULO);
    if (titulo && !VIÑETA.test(linea)) {
      epica = (titulo[1] || titulo[2]).trim();
      ultimoConViñeta = false;
      continue;
    }

    const tieneViñeta = VIÑETA.test(cruda);
    const limpio = linea.replace(VIÑETA, '').trim();
    if (!limpio) continue;

    // Continuación de la viñeta anterior (texto partido en varias líneas)
    if (!tieneViñeta && ultimoConViñeta && items.length && /^[a-záéíóúñ(]/.test(limpio)) {
      items[items.length - 1].texto += ' ' + limpio;
      continue;
    }

    // Varias ideas en una línea separadas por ";"
    for (const parte of limpio.split(/\s*;\s*/)) {
      if (parte.length > 2) items.push({ texto: parte, epica });
    }
    ultimoConViñeta = tieneViñeta;
  }

  return items;
}

function capitalizar(t) {
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

function minusculaInicial(t) {
  // No toca siglas (API, QA) ni nombres propios evidentes en mayúsculas
  return t && !/^[A-ZÁÉÍÓÚÑ]{2,}/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t;
}

function quitarPuntoFinal(t) {
  return t.replace(/[\s.;]+$/, '');
}

/** Intenta reconocer quién se beneficia en una nota escrita libremente. */
function detectarRol(texto) {
  const m = texto.match(/\b(?:el|la|los|las)\s+(cliente|clientes|usuari[oa]s?|administrador(?:a|es)?|admin|vendedor(?:a|es)?|comprador(?:a|es)?|equipo(?: de \w+)?|gerente|jef[ae](?: de \w+)?|operador(?:a|es)?|socio(?:s)?|visitante(?:s)?|paciente(?:s)?|alumno(?:s)?|profesor(?:a|es)?)\b/i);
  if (!m) return null;
  return singular(m[1].toLowerCase()).replace(/^admin$/, 'administrador');
}

/** Singular simple en español para roles: "clientes" → "cliente", "administradores" → "administrador". */
export function singular(palabra) {
  return palabra
    .split(' ')
    .map((p, i) => {
      if (i > 0) return p; // solo el sustantivo principal ("jefe de ventas")
      if (/[rnld]es$/.test(p)) return p.slice(0, -2);
      if (/s$/.test(p) && p.length > 3) return p.slice(0, -1);
      return p;
    })
    .join(' ');
}

/** Separa "para ..." final como beneficio cuando la nota no usa el formato clásico. */
function separarBeneficio(texto) {
  const m = texto.match(/^(.+?),?\s+(?:para que|para poder|para)\s+(.{6,})$/i);
  return m ? [m[1], m[2]] : [texto, ''];
}

/**
 * Convierte un ítem de notas en historia de usuario.
 * @param {{texto: string, epica?: string|null}} item
 * @param {{rolPorDefecto?: string}} opciones
 */
export function aHistoria(item, opciones = {}) {
  const original = quitarPuntoFinal(String(item.texto).trim());
  const rolPorDefecto = opciones.rolPorDefecto || 'usuario';
  let rol;
  let quiero;
  let para;

  const nota = tipoDeNota(original);
  const clasica = original.match(PATRON_HISTORIA);
  const sistema = original.match(SISTEMA);
  if (clasica) {
    [, rol, quiero, para = ''] = clasica;
  } else if (sistema) {
    const [, quien, resto] = sistema;
    const [verbo, ...demas] = resto.split(/\s+/);
    const conjugado = SUBJUNTIVO[verbo.toLowerCase()];
    [quiero, para] = separarBeneficio(`que el ${quien.toLowerCase()} ${conjugado ? [conjugado, ...demas].join(' ') : `pueda ${resto}`}`);
    rol = rolPorDefecto;
  } else {
    const sinRelleno = original.replace(RELLENO, '').replace(PEDIDO, '');
    [quiero, para] = separarBeneficio(sinRelleno);
    rol = detectarRol(original) || rolPorDefecto;

    // «que el cliente pueda pagar…» o «el mecánico necesita ver…»: el rol es el sujeto y el quiero, lo que sigue
    const sujeto = quiero.match(/^(?:que\s+)?(?:el|la|los|las)\s+([\p{L}]+(?:\s+de\s+[\p{L}]+)?)\s+(?:pueda|puedan|podr[aá]n?|puede|pueden|necesita|necesitan|quiere|quieren|tiene que|tienen que|debe|deben)\s+(.+)$/iu);
    if (sujeto && !/^(?:sistema|app|aplicaci[oó]n|p[aá]gina|sitio|plataforma)$/i.test(sujeto[1])) {
      rol = singular(sujeto[1].toLowerCase());
      quiero = sujeto[2];
    }
  }

  quiero = minusculaInicial(quitarPuntoFinal(quiero.trim()));
  para = minusculaInicial(quitarPuntoFinal((para || '').trim()));
  rol = quitarPuntoFinal(rol.trim()).toLowerCase();

  return {
    id: nuevoId('h'),
    titulo: capitalizar(resumirTitulo(quiero)),
    rol,
    quiero,
    para,
    criterios: sugerirCriterios(quiero),
    epica: item.epica || '',
    puntos: null,
    prioridad: 'should',
    estado: 'backlog',
    sprintId: null,
    notaOriginal: String(item.texto).trim(),
    creada: new Date().toISOString(),
    // Solo para las candidatas: una pregunta abierta parte como spike; el contexto no se agrega
    ...(nota === 'pregunta' ? { tipo: 'spike' } : {}),
    ...(nota ? { nota } : {}),
  };
}

/** Título corto para listas: las primeras palabras de lo que se quiere. */
export function resumirTitulo(quiero, maxPalabras = 8) {
  const palabras = String(quiero).split(/\s+/).filter(Boolean);
  const corto = palabras.slice(0, maxPalabras).join(' ');
  return palabras.length > maxPalabras ? corto + '…' : corto;
}

/**
 * Criterios de partida. No se inventan: un criterio de plantilla («el sistema me confirma que se realizó»)
 * hacía ver la historia completa sin serlo. El editor muestra el formato como ejemplo.
 */
export function sugerirCriterios() {
  return [];
}

/** Texto completo en formato clásico. */
export function enunciado(h) {
  const base = `Como ${h.rol || 'usuario'}, quiero ${h.quiero}`;
  return h.para ? `${base}, para ${h.para}.` : `${base}.`;
}

/**
 * Revisión INVEST con reglas simples y explicables. Devuelve avisos, no errores:
 * la persona decide.
 * @returns {{codigo: string, nivel: 'aviso'|'sugerencia', texto: string}[]}
 */
export function revisarInvest(h) {
  const avisos = [];
  const quiero = String(h.quiero || '');
  const palabras = quiero.split(/\s+/).filter(Boolean);
  const baja = ` ${quiero.toLowerCase()} `;

  const tipo = h.tipo || 'historia';
  const esHistoria = tipo === 'historia';
  if (esHistoria && (!h.rol || h.rol === 'usuario')) {
    avisos.push({ codigo: 'rol', nivel: 'sugerencia', texto: '¿Quién se beneficia exactamente? "Usuario" es muy general: prueba con un rol concreto.' });
  }
  if (esHistoria && !h.para) {
    avisos.push({ codigo: 'valor', nivel: 'aviso', texto: 'Falta el "para qué". Sin el beneficio es difícil priorizar (V de Valiosa).' });
  }
  if (tipo === 'bug' && !/(reproduc|pasos|esperad)/i.test((h.criterios || []).join(' '))) {
    avisos.push({ codigo: 'reproducir', nivel: 'aviso', texto: 'Para un bug, indica los pasos para reproducirlo, qué pasa y qué debería pasar.' });
  }
  if (tipo === 'spike' && !/(hora|dia|día|semana|plazo|time.?box)/i.test(`${h.quiero} ${(h.criterios || []).join(' ')}`)) {
    avisos.push({ codigo: 'timebox', nivel: 'aviso', texto: 'Un spike necesita plazo (time-box) y la pregunta que debe responder al terminar.' });
  }
  if (tipo === 'deuda' && !h.para) {
    avisos.push({ codigo: 'valor', nivel: 'sugerencia', texto: 'Explica qué riesgo o costo reduce esta deuda técnica: así se puede priorizar frente a lo demás.' });
  }
  if (palabras.length > 25) {
    avisos.push({ codigo: 'larga', nivel: 'aviso', texto: 'Es larga: probablemente se puede dividir en historias más pequeñas (S de Small).' });
  }
  const conjunciones = (baja.match(/\s(?:y|además|también|e)\s/g) || []).length + (quiero.match(/,/g) || []).length;
  if (conjunciones >= 2 || (conjunciones === 1 && palabras.length > 12)) {
    avisos.push({ codigo: 'varias', nivel: 'aviso', texto: 'Parece pedir varias cosas a la vez. Una historia, un resultado (I de Independiente).' });
  }
  const vagas = palabrasVagas(quiero);
  if (vagas.length) {
    const [v] = vagas;
    avisos.push({ codigo: 'vaga', nivel: 'aviso', texto: `"${v.palabra}" no se puede verificar (T de Testeable). Por ejemplo: ${v.metrica}.` });
  }
  const vagasCriterios = palabrasVagas((h.criterios || []).join(' ')).filter((x) => !vagas.some((y) => y.metrica === x.metrica));
  if (vagasCriterios.length) {
    const [v] = vagasCriterios;
    avisos.push({ codigo: 'vaga-criterio', nivel: 'aviso', texto: `Un criterio dice "${v.palabra}": así no se puede probar. Por ejemplo: ${v.metrica}.` });
  }
  if (esHistoria && TECNICAS.test(quiero) && !h.para) {
    avisos.push({ codigo: 'tecnica', nivel: 'sugerencia', texto: 'Suena a tarea técnica. Explica a quién ayuda o márcala como habilitador técnico.' });
  }
  const criterios = (h.criterios || []).filter((c) => String(c).trim());
  if (!criterios.length) {
    avisos.push({ codigo: 'criterios', nivel: 'aviso', texto: 'Sin criterios de aceptación no se sabe cuándo está terminada.' });
  } else if (criterios.every(esCriterioGenerico)) {
    avisos.push({ codigo: 'criterios', nivel: 'aviso', texto: 'El criterio es de plantilla: escribe el caso real («Dado… cuando… entonces…») para poder aceptarla.' });
  }
  if (esHistoria) {
    const nota = tipoDeNota(h.quiero);
    if (nota === 'pregunta') avisos.push({ codigo: 'pregunta', nivel: 'aviso', texto: 'Es una pregunta abierta: resuélvela con el cliente o conviértela en un spike con plazo.' });
    if (nota === 'problema') avisos.push({ codigo: 'problema', nivel: 'aviso', texto: 'Describe un problema, no lo que alguien necesita hacer. Reescríbela: ¿qué quiere poder hacer y para qué?' });
    if (nota === 'contexto') avisos.push({ codigo: 'contexto', nivel: 'aviso', texto: 'Parece contexto de la reunión, no una necesidad.' });
  }
  if (typeof h.puntos === 'number' && h.puntos > 13) {
    avisos.push({ codigo: 'grande', nivel: 'aviso', texto: `${h.puntos} puntos es mucho para un sprint. Conviene dividirla (E de Estimable).` });
  }

  return avisos;
}

/** Puntuación 0–100 para ordenar lo que más necesita atención. */
export function calidad(h) {
  const pesos = { aviso: 20, sugerencia: 8 };
  const restar = revisarInvest(h).reduce((t, a) => t + pesos[a.nivel], 0);
  return Math.max(0, 100 - restar);
}

/** Atajo: texto de notas → historias. */
export function notasAHistorias(texto, opciones = {}) {
  return extraerItems(texto).map((item) => aHistoria(item, opciones));
}

/** Escalas de estimación admitidas. */
export const ESCALA_PUNTOS = [1, 2, 3, 5, 8, 13, 21];
/** Tipos de ítem del backlog. */
export const TIPOS = {
  historia: 'Historia',
  bug: 'Bug',
  spike: 'Spike (investigación)',
  deuda: 'Deuda técnica',
};

export const PRIORIDADES = {
  must: 'Imprescindible',
  should: 'Importante',
  could: 'Deseable',
  wont: 'Esta vez no',
};

/**
 * Propone dividir una historia que pide varias cosas: separa "lo que quiere" en
 * comas, "y", "e" y "además". Devuelve null si no hay al menos dos partes con sentido.
 * Cada parte conserva rol, beneficio, épica y prioridad de la original.
 */
export function dividirHistoria(h) {
  const partes = String(h.quiero || '')
    .split(/\s*,\s*(?:y\s+|e\s+)?|\s+y\s+además\s+|\s+además\s+|\s+y\s+también\s+|\s+y\s+|\s+e\s+/i)
    .map((p) => p.trim().replace(/^(?:que\s+)?(?:también\s+)?/i, ''))
    .filter((p) => p.split(/\s+/).length >= 2);
  if (partes.length < 2) return null;

  return partes.map((quiero) => ({
    ...h,
    id: nuevoId('h'),
    quiero,
    titulo: capitalizar(resumirTitulo(quiero)),
    criterios: sugerirCriterios(quiero),
    puntos: null,
    notaOriginal: enunciado(h),
    creada: new Date().toISOString(),
    terminada: null,
  }));
}

/** Reemplaza una historia por sus partes, en el mismo lugar del backlog. */
export function reemplazarPorPartes(historias, id, partes) {
  const i = historias.findIndex((x) => x.id === id);
  if (i < 0 || !partes?.length) return historias;
  return [...historias.slice(0, i), ...partes, ...historias.slice(i + 1)];
}
