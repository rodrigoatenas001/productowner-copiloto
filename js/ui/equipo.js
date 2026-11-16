// Trabajo en equipo en tiempo real: el proyecto abierto se comparte en una «sala» de un servidor que
// instala el propio PO (Cloudflare, ver servidor/README.md). Todo viaja cifrado; la clave va en el
// enlace de invitación y nunca llega al servidor. Cada cambio se mezcla historia por historia con los
// del resto (nucleo/mezcla.js), así nadie pisa el trabajo de otro.
import { h, avisar, campo, confirmar, pedirTexto } from './dom.js';
import { leerAjuste, guardarAjuste, guardarProyecto, MODO_PRUEBA } from '../almacen.js';
import { mezclar, iguales } from '../nucleo/mezcla.js';
import { nuevaSala, normalizarServidor, enlaceInvitacion, leerInvitacion, urlSocket, cifrar, descifrar } from '../nucleo/sala.js';
import { normalizarProyecto } from '../nucleo/proyecto.js';

const ID_EJEMPLO = 'ejemplo-pasteleria';
const GUIA = 'https://github.com/rodrigoatenas001/productowner-copiloto/blob/main/servidor/README.md';
const VIVO = 60_000; // sin señales en este tiempo, la persona ya no está

const est = {
  salas: {}, // id del proyecto → { servidor, sala, clave, version, base }
  servidor: '',
  nombre: '',
  yo: crypto.getRandomValues(new Uint32Array(1))[0].toString(36),
  ws: null,
  de: null, // id del proyecto conectado
  conectado: false,
  enVuelo: null, // proyecto enviado que espera respuesta
  pendiente: false,
  cola: null, // cambio remoto que espera a que la persona termine de escribir
  presentes: new Map(), // id → { nombre, ts }
  intentos: 0,
  reintento: null,
  latido: null,
  uniendo: null, // invitación que se está abriendo
};

let app = null;
if (MODO_PRUEBA) window.__equipo = est; // para las pruebas de interfaz
const guardarSalas = () => guardarAjuste('equipoSalas', est.salas);
export const salaDe = (id) => est.salas[id] || null;
export const equipoConectado = () => est.conectado;

/** Personas conectadas ahora en el proyecto abierto (sin contarme). */
export function presentes() {
  const ahora = Date.now();
  return [...new Set([...est.presentes.values()].filter((p) => ahora - p.ts < VIVO).map((p) => p.nombre))];
}

/** Texto para la barra de estado. */
export function estadoEquipo() {
  if (!est.de || est.de !== app?.proyecto?.id) return '';
  if (!est.conectado) return 'Equipo: reconectando…';
  const otros = presentes();
  return otros.length ? `En línea: ${otros.join(', ')}` : 'Equipo: conectado, nadie más en línea';
}

function pintarEstado() {
  for (const id of ['estado-equipo', 'estado-equipo-ajustes']) {
    const el = document.getElementById(id);
    if (el) el.textContent = estadoEquipo() || 'Conectando…';
  }
}

export async function iniciarEquipo(aplicacion) {
  app = aplicacion;
  est.salas = (await leerAjuste('equipoSalas')) || {};
  est.servidor = (await leerAjuste('equipoServidor')) || '';
  est.nombre = (await leerAjuste('equipoNombre')) || '';
  document.addEventListener('focusout', () => setTimeout(aplicarCola, 0));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) aplicarCola(); });
  window.addEventListener('hashchange', () => revisarInvitacion());
  if (app.vista === 'ajustes') app.render(); // ya se dibujó antes de leer estos ajustes
  if (!(await revisarInvitacion())) conectarProyectoActivo();
}

/** Al cambiar de proyecto: se conecta a su sala si tiene una. */
export function conectarProyectoActivo() {
  const id = app?.proyecto?.id;
  if (est.de === id && est.ws) return;
  desconectar();
  if (id && est.salas[id]) conectar(id);
  pintarEstado();
}

function desconectar() {
  clearTimeout(est.reintento);
  clearInterval(est.latido);
  clearInterval(est.revisarCola);
  const ws = est.ws;
  Object.assign(est, { ws: null, de: null, conectado: false, enVuelo: null, pendiente: false, cola: null, intentos: 0 });
  est.presentes.clear();
  if (ws) { ws.onclose = null; try { ws.close(); } catch { /* ya cerrado */ } }
}

function conectar(id, info = est.salas[id]) {
  est.de = id;
  let ws;
  try {
    ws = new WebSocket(urlSocket(info.servidor, info.sala));
  } catch (e) {
    avisar(`No se pudo conectar con el servidor del equipo: ${e.message}`, 'error');
    return;
  }
  est.ws = ws;
  ws.onopen = () => {
    est.intentos = 0;
    ws.send(JSON.stringify({ t: 'hola' }));
  };
  ws.onmessage = (e) => recibir(ws, e.data).catch((err) => avisar(`Equipo: ${err.message}`, 'error'));
  ws.onclose = () => {
    if (est.ws !== ws) return;
    est.conectado = false;
    est.enVuelo = null;
    clearInterval(est.latido);
    est.ws = null;
    pintarEstado();
    if (est.uniendo) { avisar('No se pudo abrir la invitación: revisa el enlace y tu conexión.', 'error'); est.uniendo = null; return; }
    // Reintento con espera creciente (1 s, 2 s, 4 s… hasta 30 s)
    est.reintento = setTimeout(() => { if (est.de === id && !est.ws) conectar(id); }, Math.min(30_000, 1000 * 2 ** est.intentos++));
  };
}

async function recibir(ws, texto) {
  if (ws !== est.ws) return;
  const m = JSON.parse(texto);
  const info = est.salas[est.de] || est.uniendo;
  if (m.t === 'estado') {
    est.conectado = true;
    if (est.uniendo) { await terminarDeUnirse(m); return; }
    if (m.datos) await aplicarRemoto(await descifrar(info.clave, m.datos), m.version);
    else if (m.version === 0) { info.version = 0; info.base = null; }
    anunciarme(false, true); // y pide a los demás que se anuncien
    clearInterval(est.latido);
    est.latido = setInterval(() => { anunciarme(); pintarEstado(); }, 25_000);
    pintarEstado();
    enviar();
  } else if (m.t === 'ok') {
    info.version = m.version;
    info.base = est.enVuelo;
    est.enVuelo = null;
    await guardarSalas();
    if (est.pendiente) enviar();
  } else if (m.t === 'rechazo') {
    // Otra persona guardó antes: se mezcla con lo suyo y se vuelve a enviar
    est.enVuelo = null;
    if (m.datos) await aplicarRemoto(await descifrar(info.clave, m.datos), m.version);
    enviar();
  } else if (m.t === 'nuevo') {
    if (est.enVuelo) return; // llegará como rechazo de lo que se envió
    await aplicarRemoto(await descifrar(info.clave, m.datos), m.version);
  } else if (m.t === 'aviso') {
    const quien = await descifrar(info.clave, m.datos).catch(() => null);
    if (!quien?.id || quien.id === est.yo) return;
    const nuevo = !est.presentes.has(quien.id);
    if (quien.chao) est.presentes.delete(quien.id);
    else est.presentes.set(quien.id, { nombre: String(quien.nombre || 'Alguien').slice(0, 40), ts: Date.now() });
    if ((nuevo || quien.pide) && !quien.chao) anunciarme(); // para que quien llega también me vea
    pintarEstado();
  } else if (m.t === 'error') {
    avisar(`El servidor del equipo respondió: ${m.motivo}`, 'error');
  }
}

async function anunciarme(chao = false, pide = false) {
  const info = est.salas[est.de];
  if (!est.conectado || !info) return;
  est.ws.send(JSON.stringify({ t: 'aviso', datos: await cifrar(info.clave, { id: est.yo, nombre: est.nombre || 'Sin nombre', chao, pide }) }));
}

const escribiendo = () => {
  const el = document.activeElement;
  return Boolean(el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !['checkbox', 'radio', 'button', 'range'].includes(el.type)) || el.isContentEditable));
};

async function aplicarRemoto(remotoCrudo, version) {
  if (escribiendo()) {
    // Se aplica cuando la persona deja el campo (se revisa cada segundo: focusout no siempre llega)
    est.cola = { remotoCrudo, version };
    clearInterval(est.revisarCola);
    est.revisarCola = setInterval(aplicarCola, 1000);
    return;
  }
  est.cola = null;
  clearInterval(est.revisarCola);
  const info = est.salas[est.de];
  const remoto = { ...normalizarProyecto(remotoCrudo), actualizado: remotoCrudo.actualizado || '' };
  const local = app.proyectos.find((p) => p.id === est.de) || remoto;
  const mezcla = mezclar(info.base || remoto, local, remoto);
  info.base = remoto;
  info.version = version;
  await guardarSalas();
  if (!iguales(mezcla, local)) {
    await guardarProyecto(mezcla, { conservarFecha: true });
    app.proyectos = app.proyectos.map((p) => (p.id === mezcla.id ? mezcla : p));
    if (app.proyecto.id === mezcla.id) { app.proyecto = mezcla; app.render(); }
  }
  if (!iguales(mezcla, remoto)) est.pendiente = true;
  pintarEstado();
}

async function aplicarCola() {
  if (!est.cola || escribiendo()) return;
  const { remotoCrudo, version } = est.cola;
  await aplicarRemoto(remotoCrudo, version);
  enviar();
}

/** Envía el proyecto si cambió desde la última versión común. Lo llama la app después de cada guardado. */
export async function enviar() {
  const info = est.salas[est.de];
  if (!info) return;
  if (!est.conectado || est.enVuelo || est.cola) { est.pendiente = true; return; }
  const local = app.proyectos.find((p) => p.id === est.de);
  est.pendiente = false;
  if (!local || (info.base && iguales(local, info.base))) return;
  est.enVuelo = structuredClone(local);
  try {
    est.ws.send(JSON.stringify({ t: 'guardar', base: info.version, datos: await cifrar(info.clave, est.enVuelo) }));
  } catch (e) {
    est.enVuelo = null;
    est.pendiente = true;
    avisar(`No se pudo enviar al equipo: ${e.message}`, 'error');
  }
}

// ── Invitaciones ──────────────────────────────────────────────────────────

async function revisarInvitacion() {
  const inv = leerInvitacion(location.hash);
  if (!inv || est.uniendo || est.preguntando) return Boolean(inv);
  history.replaceState(null, '', `${location.pathname}${location.search}`);
  const yaEsta = Object.entries(est.salas).find(([, s]) => s.sala === inv.sala);
  if (yaEsta && app.proyectos.some((p) => p.id === yaEsta[0])) {
    await app.abrir(yaEsta[0]);
    avisar('Ya estabas en este proyecto de equipo.');
    return true;
  }
  if (!est.nombre) {
    est.preguntando = true;
    const nombre = await pedirTexto('¿Con qué nombre te verá el equipo?', { aceptar: 'Entrar al proyecto', placeholder: 'Ej.: Ana' })
      .finally(() => { est.preguntando = false; });
    if (!nombre) return false;
    est.nombre = nombre.trim().slice(0, 40);
    await guardarAjuste('equipoNombre', est.nombre);
  }
  desconectar();
  est.uniendo = { ...inv, version: 0, base: null };
  avisar('Abriendo el proyecto del equipo…');
  conectar('__uniendo', est.uniendo);
  return true;
}

async function terminarDeUnirse(m) {
  const inv = est.uniendo;
  est.uniendo = null;
  if (!m.datos) { avisar('Esa sala está vacía: pide a quien te invitó que comparta el proyecto de nuevo.', 'error'); desconectar(); return; }
  let remoto;
  try {
    const crudo = await descifrar(inv.clave, m.datos);
    remoto = { ...normalizarProyecto(crudo), actualizado: crudo.actualizado || '' };
  } catch {
    avisar('No se pudo abrir el proyecto: el enlace está incompleto o es de otra sala.', 'error');
    desconectar();
    return;
  }
  est.salas[remoto.id] = { servidor: inv.servidor, sala: inv.sala, clave: inv.clave, version: m.version, base: remoto };
  await guardarSalas();
  const local = app.proyectos.find((p) => p.id === remoto.id);
  const proyecto = local ? mezclar(remoto, local, remoto) : remoto;
  await guardarProyecto(proyecto, { conservarFecha: true });
  app.proyectos = local ? app.proyectos.map((p) => (p.id === proyecto.id ? proyecto : p)) : [...app.proyectos, proyecto];
  desconectar();
  await app.abrir(proyecto.id); // abre y se conecta a su sala
  avisar(`Entraste a «${proyecto.nombre}». Los cambios de todos se ven aquí al momento.`);
}

// ── Ajustes › Trabajar en equipo ─────────────────────────────────────────

async function compartir(nuevoEnlace = false) {
  if (!est.servidor) { avisar('Primero escribe la dirección de tu servidor del equipo.', 'error'); return; }
  if (!est.nombre) { avisar('Escribe tu nombre: así te ve el equipo.', 'error'); return; }
  const id = app.proyecto.id;
  if (nuevoEnlace && !(await confirmar('¿Crear un enlace nuevo? Quienes tienen el enlace actual dejarán de ver los cambios hasta que les envíes el nuevo.', { aceptar: 'Crear enlace nuevo' }))) return;
  desconectar();
  est.salas[id] = { servidor: est.servidor, ...nuevaSala(), version: 0, base: null };
  await guardarSalas();
  conectar(id);
  app.render();
  avisar('Proyecto compartido. Copia el enlace y envíaselo a tu equipo.');
}

async function dejarDeCompartir() {
  if (!(await confirmar('¿Dejar de trabajar en equipo con este proyecto en este navegador? El proyecto queda aquí tal como está; el resto del equipo sigue con su copia.', { aceptar: 'Dejar de compartir aquí' }))) return;
  await anunciarme(true);
  desconectar();
  delete est.salas[app.proyecto.id];
  await guardarSalas();
  app.render();
}

async function copiarEnlace(enlace) {
  try {
    await navigator.clipboard.writeText(enlace);
    avisar('Enlace copiado. Envíalo por un canal privado: quien lo tenga puede ver y editar el proyecto.');
  } catch {
    avisar('No se pudo copiar: selecciona el enlace y cópialo a mano.', 'error');
  }
}

async function probarServidor() {
  try {
    const r = await fetch(`${est.servidor}/salud`);
    const datos = await r.json();
    if (!datos.ok) throw new Error('respuesta inesperada');
    avisar('El servidor responde. Ya puedes compartir proyectos.');
  } catch (e) {
    avisar(`El servidor no responde (${e.message}). Revisa la dirección o la instalación.`, 'error');
  }
}

export function seccionEquipo(aplicacion) {
  app = aplicacion;
  const info = est.salas[app.proyecto.id];
  const ejemplo = app.proyecto.id === ID_EJEMPLO;
  const enlace = info ? enlaceInvitacion(`${location.origin}${location.pathname}`, info) : '';
  return h('section', { class: 'panel', 'aria-labelledby': 'aj-equipo' },
    h('h2', { id: 'aj-equipo' }, 'Trabajar en equipo en tiempo real'),
    h('p', { class: 'ayuda' }, 'Comparte el proyecto con tu equipo aunque estén en otras ciudades: cada cambio aparece al momento en los demás y se mezcla historia por historia. Necesitas un servidor propio (gratis en Cloudflare, se instala una vez); todo viaja cifrado y el servidor no puede leer tus proyectos.'),
    campo('Tu nombre', h('input', {
      type: 'text', value: est.nombre, maxlength: 40, placeholder: 'Ej.: Rodrigo',
      onchange: async (e) => { est.nombre = e.target.value.trim(); await guardarAjuste('equipoNombre', est.nombre); anunciarme(); },
    }), 'Así te ve el resto del equipo.'),
    campo('Dirección del servidor del equipo', h('input', {
      type: 'url', value: est.servidor, placeholder: 'https://copiloto-po-salas.tu-cuenta.workers.dev',
      onchange: async (e) => {
        try {
          est.servidor = normalizarServidor(e.target.value);
          e.target.value = est.servidor;
          await guardarAjuste('equipoServidor', est.servidor);
          app.render();
        } catch (err) { avisar(err.message, 'error'); }
      },
    }), h('span', {}, 'Cómo instalarlo en tu cuenta: ', h('a', { href: GUIA, target: '_blank', rel: 'noopener' }, 'guía del servidor'), '.')),
    info
      ? [
        h('p', {}, h('strong', {}, `«${app.proyecto.nombre}» está en equipo. `), h('span', { id: 'estado-equipo-ajustes', 'aria-live': 'polite' }, estadoEquipo() || 'Conectando…')),
        campo('Enlace de invitación', h('input', { type: 'text', readonly: true, value: enlace, class: 'enlace-equipo', onfocus: (e) => e.target.select() })),
        h('div', { class: 'acciones' },
          h('button', { type: 'button', class: 'btn', onclick: () => copiarEnlace(enlace) }, 'Copiar enlace'),
          h('button', { type: 'button', class: 'btn btn--secundario', onclick: () => compartir(true) }, 'Crear enlace nuevo'),
          h('button', { type: 'button', class: 'btn-texto', onclick: dejarDeCompartir }, 'Dejar de compartir aquí')),
        h('p', { class: 'ayuda' }, 'Quien tenga el enlace puede ver y editar el proyecto: envíalo por un canal privado. Si alguien deja el equipo, crea un enlace nuevo y envíaselo solo a quienes siguen. Mientras escribes en un campo, los cambios de otros esperan a que termines.'),
      ]
      : h('div', { class: 'acciones' },
        h('button', { type: 'button', class: 'btn', disabled: ejemplo || !est.servidor, onclick: () => compartir() }, 'Compartir este proyecto'),
        h('button', { type: 'button', class: 'btn btn--secundario', disabled: !est.servidor, onclick: probarServidor }, 'Probar el servidor'),
        ejemplo ? h('span', { class: 'ayuda' }, 'El proyecto de ejemplo no se comparte: abre uno tuyo.') : null));
}

window.addEventListener('pagehide', () => { anunciarme(true); });
