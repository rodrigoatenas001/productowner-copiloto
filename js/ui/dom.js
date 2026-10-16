// Utilidades de interfaz. Todo el DOM se construye con nodos (nunca innerHTML con datos del usuario).

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
  const url = URL.createObjectURL(new Blob([contenido], { type: `${tipo};charset=utf-8` }));
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

/** Campo con etiqueta asociada. */
let secuencia = 0;
export function campo(etiqueta, control, ayuda) {
  secuencia += 1;
  const id = control.id || `c${secuencia}`;
  control.id = id;
  const nodos = [h('label', { for: id }, etiqueta), control];
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
