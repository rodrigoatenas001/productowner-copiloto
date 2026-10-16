// Arranque y estado de la aplicación. Cada vista vive en js/ui/*.js y recibe `app`.
import { listarProyectos, guardarProyecto, borrarProyecto, leerAjuste, guardarAjuste, pedirPersistencia, MODO_PRUEBA } from './almacen.js';
import { nuevoProyecto, necesitaRespaldo } from './nucleo/proyecto.js';
import { nombreArchivo } from './nucleo/exportar.js';
import { h, vaciar, avisar, descargar, pedirTexto } from './ui/dom.js';
import { vistaNotas } from './ui/notas.js';
import { vistaBacklog } from './ui/backlog.js';
import { vistaSprint } from './ui/sprint.js';
import { vistaAjustes } from './ui/ajustes.js';
import { vistaTaller } from './ui/taller.js';
import { vistaRetro } from './ui/retro.js';
import { vistaCliente } from './ui/cliente.js';
import { vistaBienvenida } from './ui/bienvenida.js';
import { vistaComentar } from './ui/comentar.js';
import { cajaRecorrido, avisoEjemplo, cajaInfo, PASOS_RECORRIDO } from './ui/ayuda.js';
import { normalizarProyecto, resumenSprint } from './nucleo/proyecto.js';
import { activarAtajos, abrirBuscador } from './ui/buscador.js';

const VISTAS = {
  inicio: { titulo: 'Inicio', render: vistaBienvenida },
  notas: { titulo: 'Notas', render: vistaNotas },
  backlog: { titulo: 'Backlog', render: vistaBacklog },
  cliente: { titulo: 'Cliente', render: vistaCliente },
  sprint: { titulo: 'Sprint', render: vistaSprint },
  retro: { titulo: 'Retro', render: vistaRetro },
  taller: { titulo: 'Taller', render: vistaTaller },
  ajustes: { titulo: 'Ajustes', render: vistaAjustes },
  comentar: { titulo: 'Comentar', render: vistaComentar },
};
// Con el modo simple se ocultan del menú (siguen accesibles por enlace)
const AVANZADAS = new Set(['retro', 'taller']);
export const ID_EJEMPLO = 'ejemplo-pasteleria';

// Para qué sirve cada sección: tooltip del menú y caja informativa (se puede cerrar)
const AYUDAS = {
  notas: 'Pega lo que te pidió el cliente y conviértelo en historias de usuario.',
  backlog: 'La lista ordenada de lo que hay que hacer: arriba lo más importante. Arrastra para reordenar y abre una historia con clic en su título o doble clic. Aquí priorizas, estimas y ves el roadmap.',
  cliente: 'Lo que acuerdas con tu cliente: qué incluye y qué no, cuánto cuesta, cuándo se paga y qué cambios pidió.',
  sprint: 'El trabajo de las próximas semanas en un tablero, con el avance y el informe para el cliente. Arrastra las tarjetas o usa las flechas ← →; doble clic o Enter abre la ficha.',
  retro: 'Al cerrar un sprint: qué salió bien, qué mejorar y qué acciones tomar.',
  taller: 'Para aprender o enseñar: trivia en grupo, ejercicios y desafíos de Scrum e historias.',
  ajustes: 'Respaldos, importar y exportar, la IA opcional y tus preguntas propias.',
  comentar: 'Una encuesta de 2 minutos para mejorar el copiloto.',
};
const EXTRA_AYUDA = {
  cliente: () => [' Si aún no tienes cliente, o buscas a alguien que te ayude en el proyecto, ', h('a', { href: 'https://productowner.cl', target: '_blank', rel: 'noopener' }, 'ProductOwner.cl'), ' conecta a profesionales TI independientes con clientes en Chile.'],
};

const app = {
  proyectos: [],
  proyecto: null,
  vista: 'notas',
  candidatos: [],
  ia: { proveedor: 'ninguno' },
  iaRevisor: { proveedor: 'misma' },
  preguntasPropias: [],
  cajasCerradas: new Set(),
  modoSimple: false,
  recorrido: null,
  avisar,

  async cerrarCaja(clave) {
    this.cajasCerradas.add(clave);
    await guardarAjuste('cajasCerradas', [...this.cajasCerradas]);
    this.render();
  },

  async reabrirCajas() {
    this.cajasCerradas = new Set();
    await guardarAjuste('cajasCerradas', []);
    avisar('Las cajas de ayuda vuelven a aparecer en cada sección.');
    this.render();
  },

  async cambiarModoSimple(activo) {
    this.modoSimple = activo;
    await guardarAjuste('modoSimple', activo);
    this.render();
  },

  iniciarRecorrido() {
    this.recorrido = 0;
    this.ir(PASOS_RECORRIDO[0].vista);
  },

  terminarRecorrido() {
    this.recorrido = null;
    this.render();
  },

  /** Abre el proyecto de ejemplo; si no está, lo descarga de docs/ejemplo. */
  async cargarEjemplo() {
    if (this.proyectos.some((p) => p.id === ID_EJEMPLO)) return this.abrir(ID_EJEMPLO);
    try {
      const resp = await fetch('./docs/ejemplo/pasteleria-carla.json');
      if (!resp.ok) throw new Error(`respuesta ${resp.status}`);
      const p = normalizarProyecto({ ...(await resp.json()), id: ID_EJEMPLO });
      await this.importarProyecto(p);
    } catch (e) {
      avisar(`No se pudo cargar el ejemplo (${e.message}). Revisa tu conexión e inténtalo de nuevo.`, 'error');
    }
  },

  /** Aplica un cambio al proyecto actual, guarda (con pausa) y vuelve a dibujar. */
  cambiar(transformar, { redibujar = true } = {}) {
    const nuevo = transformar(structuredClone(this.proyecto));
    this.proyecto = nuevo;
    this.proyectos = this.proyectos.map((p) => (p.id === nuevo.id ? nuevo : p));
    programarGuardado();
    if (redibujar) this.render();
  },

  /** Como `cambiar`, pero ofrece deshacer durante unos segundos. */
  cambiarConDeshacer(texto, transformar) {
    const antes = structuredClone(this.proyecto);
    this.cambiar(transformar);
    avisar(texto, 'ok', {
      accion: {
        texto: 'Deshacer',
        alHacer: () => {
          if (this.proyecto.id !== antes.id) return; // cambió de proyecto entretanto
          this.cambiar(() => antes);
          avisar('Cambio deshecho.');
        },
      },
    });
  },

  async crearProyecto(nombre) {
    const p = nuevoProyecto(nombre);
    await guardarProyecto(p);
    this.proyectos.push(p);
    await this.abrir(p.id);
  },

  async importarProyecto(p) {
    if (this.proyectos.some((x) => x.id === p.id)) p.id = `${p.id}-${Date.now().toString(36)}`;
    await guardarProyecto(p);
    this.proyectos.push(p);
    await this.abrir(p.id);
  },

  async borrarProyectoActual() {
    await borrarProyecto(this.proyecto.id);
    this.proyectos = this.proyectos.filter((p) => p.id !== this.proyecto.id);
    if (!this.proyectos.length) {
      await this.crearProyecto('Mi proyecto');
      return;
    }
    await this.abrir(this.proyectos[0].id);
  },

  async abrir(id) {
    await guardarAhora();
    this.proyecto = this.proyectos.find((p) => p.id === id) || this.proyectos[0];
    this.candidatos = [];
    await guardarAjuste('proyectoActivo', this.proyecto.id);
    this.render();
  },

  async guardarPreguntas(lista) {
    this.preguntasPropias = lista;
    await guardarAjuste('preguntasPropias', lista);
  },

  /** Guarda la configuración de la IA principal ('ia') o de la revisora ('iaRevisor'). */
  async guardarIa(config, clave = 'ia') {
    this[clave] = config;
    await guardarAjuste(clave, config);
  },

  /** IA que hace de revisora: la propia si está configurada, si no la principal. */
  configRevisor() {
    return this.iaRevisor?.proveedor && this.iaRevisor.proveedor !== 'misma' ? this.iaRevisor : this.ia;
  },


  ir(vista) {
    if (!VISTAS[vista]) return;
    this.vista = vista;
    history.replaceState(null, '', `#${vista}`);
    this.render();
    document.getElementById('principal')?.focus({ preventScroll: true });
  },

  /** Descarga el respaldo del proyecto actual y anota la fecha. */
  descargarRespaldo() {
    const p = { ...this.proyecto, respaldado: new Date().toISOString() };
    descargar(nombreArchivo(p, 'json'), JSON.stringify(p, null, 2), 'application/json');
    this.cambiar(() => p);
  },

  render() {
    renderNavegacion();
    renderBarraInferior();
    const principal = document.getElementById('principal');
    const v = this.vista;
    const caja = AYUDAS[v] && v !== 'comentar' && this.recorrido === null ? cajaInfo(this, v, `Para qué sirve ${VISTAS[v].titulo}`, AYUDAS[v], EXTRA_AYUDA[v]?.()) : null;
    vaciar(principal, avisoEjemplo(this), cajaRecorrido(this), caja, this.proyecto.id === ID_EJEMPLO ? null : avisoRespaldo(this), VISTAS[this.vista].render(this));
    document.title = `${VISTAS[this.vista].titulo} · ${this.proyecto.nombre} · Copiloto PO`;
  },
};

const postergados = new Set();
function avisoRespaldo(app) {
  const p = app.proyecto;
  if (postergados.has(p.id) || !necesitaRespaldo(p)) return null;
  return h('aside', { class: 'recordatorio', 'aria-label': 'Recordatorio de respaldo' },
    h('p', {}, h('strong', {}, 'Tus datos están solo en este navegador. '),
      p.respaldado ? 'Hiciste cambios desde tu último respaldo.' : 'Aún no descargas un respaldo de este proyecto.'),
    h('div', { class: 'acciones' },
      h('button', { type: 'button', class: 'btn', onclick: () => { app.descargarRespaldo(); avisar('Respaldo descargado. Guárdalo en una carpeta segura.'); } }, 'Descargar respaldo'),
      h('button', { type: 'button', class: 'btn-texto', onclick: () => { postergados.add(p.id); app.render(); } }, 'Más tarde')));
}

let temporizador = null;
let pendiente = false;
function programarGuardado() {
  pendiente = true;
  clearTimeout(temporizador);
  temporizador = setTimeout(guardarAhora, 400);
  marcarEstadoGuardado('Guardando…');
}

async function guardarAhora() {
  clearTimeout(temporizador);
  if (!pendiente || !app.proyecto) return;
  pendiente = false;
  try {
    await guardarProyecto(app.proyecto);
    marcarEstadoGuardado('Guardado en este navegador');
  } catch (e) {
    marcarEstadoGuardado('No se pudo guardar');
    avisar(`No se pudo guardar: ${e.message}. Descarga un respaldo desde Ajustes.`, 'error');
  }
}

function marcarEstadoGuardado(texto) {
  const el = document.getElementById('estado-guardado');
  if (el) el.textContent = texto;
}

function renderNavegacion() {
  const selectorProyecto = h('select', {
    id: 'proyecto-activo',
    'aria-label': 'Proyecto',
    onchange: (e) => (e.target.value === '__nuevo' ? pedirNuevoProyecto(e.target) : app.abrir(e.target.value)),
  },
  app.proyectos.map((p) => h('option', { value: p.id, selected: p.id === app.proyecto.id }, p.nombre)),
  h('option', { value: '__nuevo' }, '+ Nuevo proyecto…'));

  const activo = app.proyecto.sprints.find((s) => s.estado === 'activo');
  const r = activo ? resumenSprint(activo, app.proyecto.historias) : null;
  const avanceSprint = r ? Math.round((r.hechos / (r.puntos || 1)) * 100) : null;
  const conteos = {
    backlog: app.proyecto.historias.filter((x) => x.estado === 'backlog').length,
    sprint: r ? `${avanceSprint}%` : '',
  };

  vaciar(document.getElementById('navegacion'),
    h('div', { class: 'nav-proyecto' }, selectorProyecto),
    h('button', { type: 'button', class: 'nav-buscar', onclick: () => abrirBuscador(app, VISTAS), title: 'Buscar (Ctrl + K)' }, 'Buscar…', h('kbd', {}, 'Ctrl K')),
    h('nav', { 'aria-label': 'Secciones' },
      h('ul', {}, Object.entries(VISTAS).filter(([clave]) => clave === app.vista || !(app.modoSimple && AVANZADAS.has(clave))).map(([clave, v]) => h('li', { class: clave === 'comentar' ? 'nav-comentar' : null },
        h('a', {
          href: `#${clave}`,
          title: AYUDAS[clave] || null,
          'aria-current': app.vista === clave ? 'page' : null,
          onclick: (e) => { e.preventDefault(); app.ir(clave); },
        }, v.titulo, conteos[clave] ? h('span', { class: 'nav-conteo', title: clave === 'sprint' ? `${activo.nombre}: ${r.hechos} de ${r.puntos} puntos terminados` : null }, String(conteos[clave])) : null,
        clave === 'sprint' && r ? h('span', { class: 'nav-avance', 'aria-hidden': 'true' }, h('span', { class: `nav-avance-${Math.min(10, Math.round(avanceSprint / 10))}` })) : null))))),
    h('p', { class: 'nav-estado', id: 'estado-guardado', 'aria-live': 'polite' }, 'Guardado en este navegador'));
}

// Barra inferior para el pulgar (solo se ve en pantallas angostas)
function renderBarraInferior() {
  let barra = document.getElementById('barra-inferior');
  if (!barra) { barra = h('nav', { id: 'barra-inferior', 'aria-label': 'Secciones principales' }); document.body.append(barra); }
  const enlace = (clave, icono) => h('a', {
    href: `#${clave}`, 'aria-current': app.vista === clave ? 'page' : null,
    onclick: (e) => { e.preventDefault(); app.ir(clave); },
  }, h('span', { class: 'barra-icono', 'aria-hidden': 'true' }, icono), VISTAS[clave].titulo);
  barra.replaceChildren(enlace('notas', '✎'), enlace('backlog', '☰'), enlace('cliente', '◈'), enlace('sprint', '▦'),
    h('button', { type: 'button', onclick: () => abrirBuscador(app, VISTAS) }, h('span', { class: 'barra-icono', 'aria-hidden': 'true' }, '⌕'), 'Buscar'));
}

async function pedirNuevoProyecto(select) {
  const nombre = await pedirTexto('Nombre del nuevo proyecto', { aceptar: 'Crear proyecto', placeholder: 'Ej.: Tienda de Carla' });
  if (nombre) {
    app.crearProyecto(nombre);
  } else {
    select.value = app.proyecto.id;
  }
}

async function iniciar() {
  try {
    app.proyectos = await listarProyectos();
    app.ia = (await leerAjuste('ia')) || { proveedor: 'ninguno' };
    app.iaRevisor = (await leerAjuste('iaRevisor')) || { proveedor: 'misma' };
    app.preguntasPropias = (await leerAjuste('preguntasPropias')) || [];
    app.cajasCerradas = new Set((await leerAjuste('cajasCerradas')) || []);
    app.modoSimple = Boolean(await leerAjuste('modoSimple'));
    const primeraVez = !(await leerAjuste('bienvenidaVista'));
    if (!app.proyectos.length) {
      const p = nuevoProyecto('Mi proyecto');
      await guardarProyecto(p);
      app.proyectos = [p];
    }
    const activo = await leerAjuste('proyectoActivo');
    app.proyecto = app.proyectos.find((p) => p.id === activo) || app.proyectos[0];
    const desdeUrl = location.hash.slice(1);
    if (VISTAS[desdeUrl]) app.vista = desdeUrl;
    else if (primeraVez) app.vista = 'inicio';
    else if (app.proyecto.historias.length) app.vista = 'backlog';
    app.render();
    if (primeraVez) await guardarAjuste('bienvenidaVista', true);
    pedirPersistencia();
  } catch (e) {
    vaciar(document.getElementById('principal'),
      h('div', { class: 'vacio' },
        h('h1', {}, 'No se pudo abrir el almacenamiento local'),
        h('p', {}, `El navegador respondió: ${e.message}. En modo privado algunos navegadores no permiten guardar datos; abre el copiloto en una ventana normal.`)));
  }
}

window.addEventListener('beforeunload', (e) => {
  if (pendiente) {
    guardarAhora();
    e.preventDefault();
  }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) guardarAhora(); });
// Enlaces con #vista (el logo, atrás/adelante del navegador)
window.addEventListener('hashchange', () => {
  const vista = location.hash.slice(1);
  if (app.proyecto && VISTAS[vista] && vista !== app.vista) app.ir(vista);
});

if ('serviceWorker' in navigator && location.protocol !== 'file:' && !MODO_PRUEBA) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

activarAtajos(app, VISTAS);
iniciar();
