// Notas: se escribe libremente y se convierte en historias candidatas, que se revisan antes de pasar al backlog.
import { h } from './dom.js';
import { notasAHistorias } from '../nucleo/historias.js';
import { editorHistoria, insigniaCalidad } from './historia.js';
import { generarConIa, iaConfigurada, nombreProveedor } from '../ia.js';

const EJEMPLO = `Pagos:
- que el cliente pueda pagar con tarjeta para no tener que transferir
- enviar la boleta por correo automáticamente
- Como contadora, quiero descargar las ventas del mes en Excel, para declarar a tiempo

Reportes:
- ver ventas por día; comparar con el mes anterior`;

export function vistaNotas(app) {
  const p = app.proyecto;
  const area = h('textarea', {
    id: 'notas',
    rows: 12,
    spellcheck: 'true',
    placeholder: 'Escribe o pega tus notas: una idea por línea o viñeta. Las líneas que terminan en ":" agrupan en una épica.',
    oninput: (e) => app.cambiar((x) => ({ ...x, notas: e.target.value }), { redibujar: false }),
  }, p.notas || '');

  const convertir = (historias, origen) => {
    if (!historias.length) {
      app.avisar('No encontramos ideas en las notas. Escribe una por línea.', 'error');
      return;
    }
    app.candidatos = historias.map((x) => ({ ...x, incluir: true }));
    app.render();
    app.avisar(`${historias.length} historias propuestas ${origen}. Revísalas antes de agregarlas.`);
    document.getElementById('candidatas')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const botonIa = h('button', {
    type: 'button',
    class: 'btn btn--secundario',
    disabled: !iaConfigurada(app.ia),
    title: iaConfigurada(app.ia) ? null : 'Configura una IA en Ajustes (opcional)',
    onclick: async (e) => {
      const boton = e.currentTarget;
      boton.disabled = true;
      boton.textContent = 'Pensando…';
      try {
        convertir(await generarConIa(app.ia, area.value, p.rolPorDefecto), `con ${nombreProveedor(app.ia)}`);
      } catch (err) {
        app.avisar(`${err.message} Usamos las reglas sin IA.`, 'error');
        convertir(notasAHistorias(area.value, { rolPorDefecto: p.rolPorDefecto }), 'con reglas');
      } finally {
        boton.disabled = false;
        boton.textContent = 'Convertir con IA';
      }
    },
  }, 'Convertir con IA');

  return h('div', { class: 'vista' },
    h('header', { class: 'vista-cabecera' },
      h('p', { class: 'eyebrow' }, p.nombre),
      h('h1', {}, 'De tus notas a historias de usuario'),
      h('p', { class: 'bajada' }, 'Pega lo que anotaste en una reunión o lo que te pidió el cliente. Lo convertimos en historias con el formato "Como… quiero… para…", y te decimos cuáles necesitan más trabajo.')),
    h('section', { class: 'panel', 'aria-labelledby': 'notas-titulo' },
      h('h2', { id: 'notas-titulo', class: 'sr-only' }, 'Notas'),
      h('label', { for: 'notas', class: 'etiqueta' }, 'Tus notas'),
      area,
      h('div', { class: 'acciones' },
        h('button', {
          type: 'button', class: 'btn',
          onclick: () => convertir(notasAHistorias(area.value, { rolPorDefecto: p.rolPorDefecto }), 'con reglas'),
        }, 'Convertir en historias'),
        botonIa,
        !area.value ? h('button', {
          type: 'button', class: 'btn-texto',
          onclick: () => { area.value = EJEMPLO; app.cambiar((x) => ({ ...x, notas: EJEMPLO })); },
        }, 'Probar con un ejemplo') : null),
      h('p', { class: 'ayuda' }, iaConfigurada(app.ia)
        ? `IA conectada: ${nombreProveedor(app.ia)}. Tus notas se envían solo a ese servicio.`
        : 'Funciona sin internet y sin IA. Si quieres, conecta tu propia IA en Ajustes.')),
    app.candidatos.length ? candidatas(app) : null);
}

function candidatas(app) {
  const epicas = [...new Set(app.proyecto.historias.map((x) => x.epica).filter(Boolean))];
  const seleccionadas = () => app.candidatos.filter((c) => c.incluir).length;
  const botonAgregar = h('button', { type: 'button', class: 'btn btn--cobre', onclick: agregar }, '');
  const pintarBoton = () => { botonAgregar.textContent = `Agregar ${seleccionadas()} al backlog`; botonAgregar.disabled = !seleccionadas(); };
  pintarBoton();

  function agregar() {
    const nuevas = app.candidatos.filter((c) => c.incluir).map(({ incluir, ...resto }) => resto);
    app.candidatos = [];
    app.cambiar((x) => ({ ...x, historias: [...x.historias, ...nuevas] }), { redibujar: false });
    app.avisar(`${nuevas.length} historias agregadas al backlog.`);
    app.ir('backlog');
  }

  return h('section', { class: 'candidatas', id: 'candidatas', 'aria-labelledby': 'candidatas-titulo' },
    h('div', { class: 'candidatas-cabecera' },
      h('h2', { id: 'candidatas-titulo' }, `Historias propuestas (${app.candidatos.length})`),
      h('div', { class: 'acciones' },
        h('button', { type: 'button', class: 'btn-texto', onclick: () => { app.candidatos = []; app.render(); } }, 'Descartar todas'),
        botonAgregar)),
    h('ol', { class: 'lista-candidatas' }, app.candidatos.map((c, i) => {
      const titulo = h('span', { class: 'candidata-titulo' }, c.titulo || '(sin título)');
      const insignia = h('span', {}, insigniaCalidad(c));
      return h('li', { class: 'candidata' },
        h('details', { open: i < 3 },
          h('summary', {},
            h('input', {
              type: 'checkbox', checked: c.incluir, 'aria-label': `Incluir: ${c.titulo}`,
              onclick: (e) => e.stopPropagation(),
              onchange: (e) => { c.incluir = e.target.checked; pintarBoton(); },
            }),
            titulo,
            c.epica ? h('span', { class: 'chip' }, c.epica) : null,
            insignia),
          editorHistoria(c, (cambios) => {
            Object.assign(c, cambios);
            titulo.textContent = c.titulo || '(sin título)';
            insignia.replaceChildren(insigniaCalidad(c));
          }, { epicas })));
    })));
}
