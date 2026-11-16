// Trabajo en equipo en tiempo real: cifrado de punta a punta y enlace de invitación.
// La clave va en el fragmento del enlace (#…), que el navegador nunca envía al servidor:
// el servidor guarda y reenvía datos que no puede leer.

const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const deB64url = (t) => Uint8Array.from(atob(t.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (t.length % 4)) % 4)), (c) => c.charCodeAt(0));

export const ID_SALA = /^[A-Za-z0-9_-]{22,64}$/;

/** Sala nueva: identificador y clave al azar. */
export function nuevaSala() {
  return { sala: b64url(crypto.getRandomValues(new Uint8Array(16))), clave: b64url(crypto.getRandomValues(new Uint8Array(32))) };
}

/** Dirección del servidor tal como la escribe la persona → https://… sin barra final. */
export function normalizarServidor(texto) {
  let t = String(texto || '').trim();
  if (!t) return '';
  if (!/^[a-z]+:\/\//i.test(t)) t = `https://${t}`;
  const u = new URL(t);
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && /^(localhost|127\.0\.0\.1)$/.test(u.hostname))) throw new Error('El servidor debe usar https.');
  return `${u.origin}${u.pathname.replace(/\/+$/, '')}`;
}

/** Enlace para invitar: la app con #equipo=servidor~sala~clave. */
export function enlaceInvitacion(urlApp, { servidor, sala, clave }) {
  const base = String(urlApp).split('#')[0];
  return `${base}#equipo=${encodeURIComponent(servidor)}~${sala}~${clave}`;
}

/** Lee una invitación desde el fragmento de la dirección. Devuelve null si no es una. */
export function leerInvitacion(hash) {
  const m = /^#?equipo=([^~]+)~([^~]+)~([A-Za-z0-9_-]{43})$/.exec(String(hash || ''));
  if (!m || !ID_SALA.test(m[2])) return null;
  try {
    return { servidor: normalizarServidor(decodeURIComponent(m[1])), sala: m[2], clave: m[3] };
  } catch {
    return null;
  }
}

/** Dirección del WebSocket de la sala. */
export const urlSocket = (servidor, sala) => `${servidor.replace(/^http/, 'ws')}/sala/${sala}`;

const importarClave = (clave) => crypto.subtle.importKey('raw', deB64url(clave), 'AES-GCM', false, ['encrypt', 'decrypt']);

async function comprimir(bytes, modo) {
  const flujo = new Blob([bytes]).stream().pipeThrough(modo === 'c' ? new CompressionStream('gzip') : new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(flujo).arrayBuffer());
}

/** Cifra cualquier dato JSON (comprimido) con AES-GCM. Devuelve texto base64url «iv.datos». */
export async function cifrar(clave, dato) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plano = await comprimir(new TextEncoder().encode(JSON.stringify(dato)), 'c');
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await importarClave(clave), plano));
  return `${b64url(iv)}.${b64urlLargo(cifrado)}`;
}

/** Descifra lo que produjo `cifrar`. Falla si la clave no es la de la sala o el dato fue alterado. */
export async function descifrar(clave, texto) {
  const [iv, datos] = String(texto).split('.');
  const plano = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deB64url(iv) }, await importarClave(clave), deB64url(datos));
  return JSON.parse(new TextDecoder().decode(await comprimir(new Uint8Array(plano), 'd')));
}

// btoa con String.fromCharCode(...x) se cae con arreglos grandes: se arma por partes
function b64urlLargo(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
