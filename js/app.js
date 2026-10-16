// Arranque y estado de la aplicación. Cada vista vive en js/ui/*.js y recibe `app`.
import { listarProyectos, guardarProyecto, borrarProyecto, leerAjuste, guardarAjuste, pedirPersistencia } from './almacen.js';
import { nuevoProyecto } from './nucleo/proyecto.js';
import { h, vaciar, avisar } from './ui/dom.js';
import { vistaNotas } from './ui/notas.js';
import { vistaBacklog } from './ui/backlog.js';
import { vistaSprint } from './ui/sprint.js';
import { vistaAjustes } from './ui/ajustes.js';

const VISTAS = {
  notas: { titulo: 'Notas', render: vistaNotas },
  backlog: { titulo: 'Backlog', render: vistaBacklog },
  sprint: { titulo: 'Sprint', render: vistaSprint },
  ajustes: { titulo: 'Ajustes', render: vistaAjustes },
};

const app = {
  proyectos: [],
  proyecto: null,
  vista: 'notas',
  candidatos: [],
  ia: { proveedor: 'ninguno' },
  avisar,

  /** Aplica un cambio al proyecto actual, guarda (con pausa) y vuelve a dibujar. */
  cambiar(transformar, { redibujar = true } = {}) {
    const nuevo = transformar(structuredClone(this.proyecto));
    this.proyecto = nuevo;
    this.proyectos = this.proyectos.map((p) => (p.id === nuevo.id ? nuevo : p));
    programarGuardado();
    if (redibujar) this.render();
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

  async guardarIa(config) {
    this.ia = config;
    await guardarAjuste('ia', config);
  },

  ir(vista) {
    if (!VISTAS[vista]) return;
    this.vista = vista;
    history.replaceState(null, '', `#${vista}`);
    this.render();
    document.getElementById('principal')?.focus({ preventScroll: true });
  },

  render() {
    renderNavegacion();
    const principal = document.getElementById('principal');
    vaciar(principal, VISTAS[this.vista].render(this));
    document.title = `${VISTAS[this.vista].titulo} · ${this.proyecto.nombre} · Copiloto PO`;
  },
};

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

  const enSprint = app.proyecto.sprints.some((s) => s.estado === 'activo');
  const conteos = {
    backlog: app.proyecto.historias.filter((x) => x.estado === 'backlog').length,
    sprint: enSprint ? '●' : '',
  };

  vaciar(document.getElementById('navegacion'),
    h('div', { class: 'nav-proyecto' }, selectorProyecto),
    h('nav', { 'aria-label': 'Secciones' },
      h('ul', {}, Object.entries(VISTAS).map(([clave, v]) => h('li', {},
        h('a', {
          href: `#${clave}`,
          'aria-current': app.vista === clave ? 'page' : null,
          onclick: (e) => { e.preventDefault(); app.ir(clave); },
        }, v.titulo, conteos[clave] ? h('span', { class: 'nav-conteo' }, String(conteos[clave])) : null))))),
    h('p', { class: 'nav-estado', id: 'estado-guardado', 'aria-live': 'polite' }, 'Guardado en este navegador'));
}

function pedirNuevoProyecto(select) {
  const nombre = prompt('Nombre del nuevo proyecto');
  if (nombre && nombre.trim()) {
    app.crearProyecto(nombre.trim());
  } else {
    select.value = app.proyecto.id;
  }
}

async function iniciar() {
  try {
    app.proyectos = await listarProyectos();
    app.ia = (await leerAjuste('ia')) || { proveedor: 'ninguno' };
    if (!app.proyectos.length) {
      const p = nuevoProyecto('Mi proyecto');
      await guardarProyecto(p);
      app.proyectos = [p];
    }
    const activo = await leerAjuste('proyectoActivo');
    app.proyecto = app.proyectos.find((p) => p.id === activo) || app.proyectos[0];
    const desdeUrl = location.hash.slice(1);
    if (VISTAS[desdeUrl]) app.vista = desdeUrl;
    else if (app.proyecto.historias.length) app.vista = 'backlog';
    app.render();
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

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

iniciar();
