// IA opcional y del usuario: Ollama en su equipo, o su propia clave de un servicio.
// Las notas viajan solo al servicio que el usuario configuró; nosotros no tenemos servidor.
import { nuevoId, resumirTitulo, sugerirCriterios, enunciado } from './nucleo/historias.js';

export const PROVEEDORES = {
  ninguno: { nombre: 'Sin IA' },
  ollama: { nombre: 'Ollama (en tu equipo)', url: 'http://localhost:11434', modelo: 'llama3.1' },
  openai: { nombre: 'API compatible con OpenAI', url: 'https://api.openai.com/v1', modelo: 'gpt-4o-mini' },
  anthropic: { nombre: 'Anthropic (Claude)', url: 'https://api.anthropic.com', modelo: 'claude-haiku-5-5' },
};

export const iaConfigurada = (c) => Boolean(c && c.proveedor && c.proveedor !== 'ninguno' && c.modelo && (c.proveedor === 'ollama' || c.clave));
export const nombreProveedor = (c) => `${PROVEEDORES[c?.proveedor]?.nombre || 'IA'}${c?.modelo ? ` · ${c.modelo}` : ''}`;

const INSTRUCCIONES = `Eres un Product Owner senior que escribe en español de Chile.
Convierte las notas del usuario en historias de usuario de calidad (INVEST).
Reglas:
- Una historia por necesidad; divide las que piden varias cosas.
- "rol" es un rol concreto (no "usuario" si las notas permiten algo mejor).
- "quiero" empieza con verbo en infinitivo, sin "poder".
- "para" es el beneficio real; si no se deduce de las notas, déjalo vacío (no inventes).
- 1 a 3 criterios de aceptación verificables en formato "Dado…, cuando…, entonces…".
- "epica": agrupa con el título de sección de las notas si existe; si no, vacío.
- No agregues requisitos que no estén en las notas.
Responde SOLO con JSON válido, sin texto adicional, con esta forma:
{"historias":[{"rol":"","quiero":"","para":"","criterios":[""],"epica":""}]}`;

function conTiempoLimite(ms) {
  const control = new AbortController();
  const t = setTimeout(() => control.abort(), ms);
  return { signal: control.signal, listo: () => clearTimeout(t) };
}

async function llamar(config, mensajeUsuario, { maxTokens = 2500, sistema = INSTRUCCIONES } = {}) {
  const base = (config.url || PROVEEDORES[config.proveedor].url).replace(/\/+$/, '');
  const { signal, listo } = conTiempoLimite(120000);
  let respuesta;

  try {
    if (config.proveedor === 'ollama') {
      respuesta = await fetch(`${base}/api/chat`, {
        method: 'POST', signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: config.modelo, stream: false, format: 'json', messages: [{ role: 'system', content: sistema }, { role: 'user', content: mensajeUsuario }] }),
      });
    } else if (config.proveedor === 'openai') {
      respuesta = await fetch(`${base}/chat/completions`, {
        method: 'POST', signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.clave}` },
        body: JSON.stringify({ model: config.modelo, max_tokens: maxTokens, messages: [{ role: 'system', content: sistema }, { role: 'user', content: mensajeUsuario }] }),
      });
    } else if (config.proveedor === 'anthropic') {
      respuesta = await fetch(`${base}/v1/messages`, {
        method: 'POST', signal,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.clave,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({ model: config.modelo, max_tokens: maxTokens, system: sistema, messages: [{ role: 'user', content: mensajeUsuario }] }),
      });
    } else {
      throw new Error('No hay una IA configurada.');
    }
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('La IA tardó demasiado en responder.');
    throw new Error(config.proveedor === 'ollama'
      ? 'No pudimos conectar con Ollama. ¿Está abierto? Revisa también OLLAMA_ORIGINS (ver Ajustes).'
      : 'No pudimos conectar con el servicio de IA. Revisa tu conexión y la dirección.');
  } finally {
    listo();
  }

  if (!respuesta.ok) {
    const detalle = respuesta.status === 401 || respuesta.status === 403 ? 'la clave no es válida o no tiene permiso'
      : respuesta.status === 404 ? 'el modelo o la dirección no existen'
        : respuesta.status === 429 ? 'se alcanzó el límite de uso de tu cuenta'
          : `respondió con error ${respuesta.status}`;
    throw new Error(`La IA ${detalle}.`);
  }

  const datos = await respuesta.json();
  if (config.proveedor === 'ollama') return datos?.message?.content ?? '';
  if (config.proveedor === 'openai') return datos?.choices?.[0]?.message?.content ?? '';
  return (datos?.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
}

/** Extrae el primer objeto JSON de una respuesta (algunos modelos agregan texto o bloques ```). */
export function extraerJson(texto) {
  const limpio = String(texto).replace(/```(?:json)?/gi, '');
  const inicio = limpio.indexOf('{');
  const fin = limpio.lastIndexOf('}');
  if (inicio < 0 || fin <= inicio) throw new Error('La IA no devolvió historias en el formato esperado.');
  return JSON.parse(limpio.slice(inicio, fin + 1));
}

/** Convierte la respuesta de la IA en historias del copiloto, validando cada campo. */
export function historiasDesdeIa(datos, rolPorDefecto = 'usuario') {
  const lista = Array.isArray(datos?.historias) ? datos.historias : [];
  const txt = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  return lista
    .map((x) => {
      const quiero = txt(x.quiero, 1000).replace(/^poder\s+/i, '').replace(/[.\s]+$/, '');
      if (!quiero) return null;
      const criterios = (Array.isArray(x.criterios) ? x.criterios : []).map((c) => txt(c, 1000)).filter(Boolean).slice(0, 5);
      return {
        id: nuevoId('h'),
        titulo: resumirTitulo(quiero).replace(/^./, (c) => c.toUpperCase()),
        rol: txt(x.rol, 120).toLowerCase() || rolPorDefecto,
        quiero,
        para: txt(x.para, 1000).replace(/^para\s+(que\s+)?/i, '').replace(/[.\s]+$/, ''),
        criterios: criterios.length ? criterios : sugerirCriterios(quiero),
        epica: txt(x.epica, 120),
        puntos: null,
        prioridad: 'should',
        estado: 'backlog',
        sprintId: null,
        notaOriginal: '',
        creada: new Date().toISOString(),
        terminada: null,
      };
    })
    .filter(Boolean)
    .slice(0, 100);
}

export async function generarConIa(config, notas, rolPorDefecto) {
  if (!String(notas).trim()) throw new Error('Escribe algunas notas primero.');
  const texto = await llamar(config, `Rol por defecto si no se deduce otro: ${rolPorDefecto}\n\nNotas:\n${String(notas).slice(0, 20000)}`);
  const historias = historiasDesdeIa(extraerJson(texto), rolPorDefecto);
  if (!historias.length) throw new Error('La IA no propuso historias.');
  return historias;
}

/** Prueba mínima para el botón "Probar conexión". */
export async function probarConexion(config) {
  const texto = await llamar(config, 'Responde exactamente {"ok":true}', { maxTokens: 20, sistema: 'Responde solo con JSON.' });
  extraerJson(texto);
  return true;
}

const INSTRUCCIONES_CRITERIOS = `Eres un Product Owner senior que escribe en español de Chile.
Escribe de 2 a 5 criterios de aceptación verificables para la historia de usuario, en formato
"Dado…, cuando…, entonces…". Incluye al menos un caso de error o borde. No agregues alcance nuevo.
Responde SOLO con JSON válido: {"criterios":[""]}`;

/** Propone criterios de aceptación para una historia. */
export async function criteriosConIa(config, historia) {
  const texto = await llamar(config, `Historia: ${enunciado(historia)}\nCriterios actuales:\n${(historia.criterios || []).join('\n') || '(ninguno)'}`,
    { maxTokens: 1200, sistema: INSTRUCCIONES_CRITERIOS });
  const datos = extraerJson(texto);
  const criterios = (Array.isArray(datos?.criterios) ? datos.criterios : [])
    .filter((c) => typeof c === 'string' && c.trim()).map((c) => c.trim().slice(0, 1000)).slice(0, 8);
  if (!criterios.length) throw new Error('La IA no propuso criterios.');
  return criterios;
}

/** Divide una historia grande en historias más pequeñas e independientes. */
export async function dividirConIa(config, historia) {
  const texto = await llamar(config,
    `Divide esta historia en 2 a 5 historias más pequeñas, independientes y que entreguen valor por sí solas (por flujo, regla de negocio, tipo de dato o caso).\nHistoria: ${enunciado(historia)}\nCriterios: ${(historia.criterios || []).join(' | ')}`);
  const partes = historiasDesdeIa(extraerJson(texto), historia.rol)
    .map((p) => ({ ...p, epica: p.epica || historia.epica, prioridad: historia.prioridad, notaOriginal: enunciado(historia) }));
  if (partes.length < 2) throw new Error('La IA no encontró cómo dividirla.');
  return partes;
}
