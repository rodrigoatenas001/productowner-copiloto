// Utilidades de interfaz. Todo el DOM se construye con nodos (nunca innerHTML con datos del usuario).
import { GLOSARIO } from '../nucleo/glosario.js';

/**
 * Crea un elemento: h('button', { class: 'btn', onclick }, 'Texto', otroNodo)
 * Atributos especiales: on* (eventos), class, dataset (objeto), style no se usa.
 */
export function h(etiqueta, atributos = {}, ...hijos) {
  const el = document.createElement(etiqueta);
  for (const [clave, valor] of Object.entries(atributos || {})) {
    if (valor === null || valor === undefined || valor === false) continue;
    if (clave.startsWith('on') && typeof valor === 'function') {
      el.addEventListener(clave.slice(2).toLowerCase(), valor);
    } else if (clave === 'dataset') {
      Object.assign(el.dataset, valor);
    } else if (clave === 'value') {
      el.value = valor;
    } else if (clave === 'checked' || clave === 'selected' || clave === 'disabled') {
      el[clave] = Boolean(valor);
    } else {
      el.setAttribute(clave, valor === true ? '' : String(valor));
    }
  }
  agregar(el, hijos);
  // Botones de solo ícono (↑ ↓ × ⋮…): el mouse muestra lo mismo que oye el lector de pantalla
  if (etiqueta === 'button' && !el.title && el.getAttribute('aria-label') && el.textContent.trim().length <= 2) el.title = el.getAttribute('aria-label');
  return el;
}

function agregar(el, hijos) {
  for (const hijo of hijos.flat(Infinity)) {
    if (hijo === null || hijo === undefined || hijo === false) continue;
    el.append(hijo instanceof Node ? hijo : document.createTextNode(String(hijo)));
  }
}

export function vaciar(el, ...hijos) {
  el.replaceChildren();
  agregar(el, hijos);
  return el;
}

/** Descarga un texto como archivo, sin servidor. */
export function descargar(nombre, contenido, tipo = 'text/plain') {
  // Los .xlsx y .docx son binarios (Uint8Array): solo el texto lleva charset
  const url = URL.createObjectURL(new Blob([contenido], { type: typeof contenido === 'string' ? `${tipo};charset=utf-8` : tipo }));
  const a = h('a', { href: url, download: nombre });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Mensaje breve en pantalla, anunciado a lectores de pantalla.
 * Con `accion` agrega un botón (por ejemplo "Deshacer") y el aviso dura más.
 */
export function avisar(texto, tipo = 'ok', { accion = null, duracion = accion ? 8000 : 4000 } = {}) {
  const zona = document.getElementById('avisos');
  if (!zona) return;
  const cerrar = () => { aviso.classList.add('is-saliendo'); setTimeout(() => aviso.remove(), 400); };
  const aviso = h('div', { class: `aviso aviso--${tipo}`, role: tipo === 'error' ? 'alert' : 'status' },
    h('span', {}, texto),
    accion ? h('button', { type: 'button', class: 'aviso-accion', onclick: () => { accion.alHacer(); cerrar(); } }, accion.texto) : null);
  zona.append(aviso);
  while (zona.children.length > 3) zona.firstElementChild.remove(); // no tapar la pantalla
  setTimeout(cerrar, duracion);
}

/**
 * Botón «?» que muestra la definición de un término del glosario (toggletip).
 * Usa la Popover API nativa: se abre con clic, toque o Enter y se cierra con Escape o
 * al tocar fuera. Sin polyfills, porque la app funciona sin conexión.
 */
let secuenciaTermino = 0;
export function termino(clave) {
  const def = GLOSARIO[clave];
  if (!def) return null;
  secuenciaTermino += 1;
  const id = `termino-${clave}-${secuenciaTermino}`;
  return [
    h('button', {
      type: 'button', class: 'termino', popovertarget: id, popovertargetaction: 'show',
      'aria-label': `Qué es: ${def.termino}`, 'aria-expanded': 'false',
    }, '?'),
    // Justo después del botón, para que el lector de pantalla lo lea en orden al abrirse
    h('div', { id, popover: 'auto', role: 'tooltip', class: 'termino-definicion' },
      h('strong', {}, def.termino), ' ', def.texto),
  ];
}

/** Interruptor encendido/apagado para ajustes que se aplican al instante. */
export function interruptor(texto, encendido, alCambiar, detalle) {
  return h('label', { class: 'interruptor' },
    h('input', { type: 'checkbox', switch: true, role: 'switch', checked: encendido, onchange: (e) => alCambiar(e.target.checked) }),
    h('span', { class: 'interruptor-texto' }, texto, detalle ? h('span', { class: 'interruptor-detalle' }, detalle) : null));
}

// Un solo par de escuchas para todas las definiciones. `toggle` no burbujea: se escucha en captura.
if (typeof document !== 'undefined') {
  document.addEventListener('toggle', (e) => {
    const pop = e.target;
    if (!(pop instanceof HTMLElement) || !pop.classList.contains('termino-definicion')) return;
    const boton = document.querySelector(`[popovertarget="${CSS.escape(pop.id)}"]`);
    if (!boton) return;
    boton.setAttribute('aria-expanded', String(e.newState === 'open'));
    if (e.newState === 'open') ubicarJunto(pop, boton);
  }, true);
}

/** Ubica la definición bajo su botón (o sobre él si no cabe), sin salirse de la pantalla. */
function ubicarJunto(pop, boton) {
  const r = boton.getBoundingClientRect();
  const margen = 8;
  const ancho = pop.offsetWidth;
  const alto = pop.offsetHeight;
  const izquierda = Math.min(Math.max(margen, r.left + r.width / 2 - ancho / 2), window.innerWidth - ancho - margen);
  const abajo = r.bottom + margen;
  const arriba = abajo + alto > window.innerHeight - margen ? Math.max(margen, r.top - alto - margen) : abajo;
  pop.style.setProperty('--x', `${Math.round(izquierda)}px`);
  pop.style.setProperty('--y', `${Math.round(arriba)}px`);
}

/** Campo con etiqueta asociada. `glosario` agrega el botón «?» con la definición del término. */
let secuencia = 0;
export function campo(etiqueta, control, ayuda, glosario) {
  secuencia += 1;
  const id = control.id || `c${secuencia}`;
  control.id = id;
  const rotulo = h('label', { for: id }, etiqueta);
  // El botón va fuera del <label>: un botón dentro de la etiqueta le robaría el clic al control
  const nodos = [glosario ? h('div', { class: 'campo-rotulo' }, rotulo, termino(glosario)) : rotulo, control];
  if (ayuda) {
    const idAyuda = `${id}-ayuda`;
    control.setAttribute('aria-describedby', idAyuda);
    nodos.push(h('p', { class: 'ayuda', id: idAyuda }, ayuda));
  }
  return h('div', { class: 'campo' }, nodos);
}

export function selector(opciones, valor, atributos = {}) {
  return h('select', atributos, Object.entries(opciones).map(([v, t]) => h('option', { value: v, selected: String(v) === String(valor) }, t)));
}

/**
 * Diálogo propio (reemplaza confirm/prompt del navegador). Devuelve una promesa:
 * con `campo` resuelve el texto escrito (o null si cancela); sin `campo`, true/false.
 */
function dialogoPregunta(pregunta, { detalle = '', aceptar = 'Aceptar', cancelar = 'Cancelar', peligro = false, campo: conCampo = false, valor = '', placeholder = '' } = {}) {
  return new Promise((resolver) => {
    let respuesta = conCampo ? null : false;
    const entrada = conCampo ? h('input', { type: 'text', value: valor, placeholder, 'aria-label': pregunta, maxlength: 300 }) : null;
    const dialogo = h('dialog', { class: 'dialogo-pregunta', onclose: () => { dialogo.remove(); resolver(respuesta); } },
      h('form', {
        method: 'dialog',
        onsubmit: (e) => {
          if (conCampo && !entrada.value.trim()) { e.preventDefault(); entrada.focus(); return; }
          respuesta = conCampo ? entrada.value.trim() : true;
        },
      },
      h('p', { class: 'dialogo-pregunta-texto' }, pregunta),
      detalle ? h('p', { class: 'ayuda' }, detalle) : null,
      entrada,
      h('div', { class: 'acciones' },
        h('button', { type: 'submit', class: peligro ? 'btn btn-peligro-solido' : 'btn' }, aceptar),
        h('button', { type: 'button', class: 'btn-texto', onclick: () => dialogo.close() }, cancelar))));
    document.body.append(dialogo);
    dialogo.showModal();
    (entrada || dialogo.querySelector('[type=submit]')).focus();
  });
}

export const confirmar = (pregunta, opciones = {}) => dialogoPregunta(pregunta, opciones);
export const pedirTexto = (pregunta, opciones = {}) => dialogoPregunta(pregunta, { ...opciones, campo: true });

/** Estado vacío que invita a actuar: un título, por qué está vacío y los botones para empezar. */
export function vacio(titulo, texto, ...acciones) {
  return h('div', { class: 'vacio' },
    h('p', { class: 'vacio-titulo' }, titulo),
    texto ? h('p', { class: 'ayuda' }, texto) : null,
    acciones.length ? h('div', { class: 'acciones' }, acciones.filter(Boolean).map(([etiqueta, hacer], i) => h('button', { type: 'button', class: i === 0 ? 'btn' : 'btn btn--secundario', onclick: hacer }, etiqueta))) : null);
}
