// Reglas de la sala, sin nada propio de Cloudflare (así se prueban con node --test).
// El servidor no entiende los datos: solo guarda la última versión cifrada y su número.
// Mensajes del navegador:
//   {t:'hola'}                       → responde {t:'estado', version, datos}
//   {t:'guardar', base, datos}       → si base es la versión actual: guarda, responde {t:'ok', version}
//                                      y avisa a los demás {t:'nuevo', version, datos}; si no, {t:'rechazo', version, datos}
//   {t:'aviso', datos}               → se reenvía tal cual a los demás (quién está conectado; también cifrado)

export const MAX_DATOS = 8 * 1024 * 1024; // 8 MB cifrados: sobra para miles de historias

/**
 * @param {{version:number, datos:string|null}} estado
 * @param {string} texto  mensaje recibido
 * @returns {{estado?: object, responder?: object, difundir?: object}}
 */
export function procesar(estado, texto) {
  let m;
  try { m = JSON.parse(texto); } catch { return { responder: { t: 'error', motivo: 'mensaje inválido' } }; }
  if (m?.t === 'hola') return { responder: { t: 'estado', version: estado.version, datos: estado.datos } };
  if (m?.t === 'aviso') {
    if (typeof m.datos !== 'string' || m.datos.length > 4096) return {};
    return { difundir: { t: 'aviso', datos: m.datos } };
  }
  if (m?.t === 'guardar') {
    if (typeof m.datos !== 'string' || !m.datos.includes('.') || !Number.isInteger(m.base)) return { responder: { t: 'error', motivo: 'mensaje inválido' } };
    if (m.datos.length > MAX_DATOS) return { responder: { t: 'error', motivo: 'El proyecto supera el tamaño máximo de la sala.' } };
    if (m.base !== estado.version) return { responder: { t: 'rechazo', version: estado.version, datos: estado.datos } };
    const nuevo = { version: estado.version + 1, datos: m.datos };
    return { estado: nuevo, responder: { t: 'ok', version: nuevo.version }, difundir: { t: 'nuevo', version: nuevo.version, datos: nuevo.datos } };
  }
  return { responder: { t: 'error', motivo: 'mensaje desconocido' } };
}

/** Partes de a 100 KB: el almacenamiento de un Durable Object acepta hasta 128 KB por valor. */
export function partir(texto, tam = 100_000) {
  const partes = [];
  for (let i = 0; i < texto.length; i += tam) partes.push(texto.slice(i, i + tam));
  return partes;
}

export const ID_SALA = /^[A-Za-z0-9_-]{22,64}$/;
