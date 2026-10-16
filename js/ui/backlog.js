// Backlog priorizado: el orden es la prioridad. Se reordena arrastrando o con los botones.
import { h, selector } from './dom.js';
import { mover, puntosDe } from '../nucleo/proyecto.js';
import { calidad, nuevoId, PRIORIDADES, sugerirCriterios } from '../nucleo/historias.js';
import { editorHistoria, insigniaCalidad } from './historia.js';

const filtros = { texto: '', epica: '' };
let abierta = null;
let arrastrando = null;

export function vistaBacklog(app) {
  const p = app.proyecto;
  const backlog = p.historias.filter((x) => x.estado === 'backlog');
  const epicas = [...new Set(p.historias.map((x) => x.epica).filter(Boolean))].sort();
  const sprintAbierto = p.sprints.find((s) => s.estado === 'activo') || p.sprints.find((s) => s.estado === 'planificado');

  const visibles = backlog.filter((x) => (!filtros.epica || x.epica === filtros.epica)
    && (!filtros.texto || `${x.titulo} ${x.quiero} ${x.para} ${x.rol}`.toLowerCase().includes(filtros.texto.toLowerCase())));
  const filtrando = Boolean(filtros.texto || filtros.epica);

  const indiceGlobal = (id) => p.historias.findIndex((x) => x.id === id);
  const reordenar = (id, delta) => app.cambiar((x) => ({ ...x, historias: mover(x.historias, id, indiceGlobal(id) + delta) }));

  const tarjeta = (historia, posicion) => {
    const esAbierta = abierta === historia.id;
    const titulo = h('span', { class: 'tarjeta-titulo' }, historia.titulo || '(sin título)');
    const insignia = h('span', {}, insigniaCalidad(historia));
    const meta = h('span', { class: 'tarjeta-meta' }, metaTexto(historia));

    const li = h('li', {
      class: `tarjeta${esAbierta ? ' is-abierta' : ''}`,
      draggable: filtrando ? null : 'true',
      dataset: { id: historia.id },
      ondragstart: (e) => { arrastrando = historia.id; e.dataTransfer.effectAllowed = 'move'; li.classList.add('is-arrastrando'); },
      ondragend: () => li.classList.remove('is-arrastrando'),
      ondragover: (e) => { if (arrastrando && arrastrando !== historia.id) { e.preventDefault(); li.classList.add('is-destino'); } },
      ondragleave: () => li.classList.remove('is-destino'),
      ondrop: (e) => {
        e.preventDefault();
        const id = arrastrando;
        arrastrando = null;
        if (id && id !== historia.id) app.cambiar((x) => ({ ...x, historias: mover(x.historias, id, indiceGlobal(historia.id)) }));
      },
    },
    h('div', { class: 'tarjeta-cabecera' },
      h('span', { class: 'tarjeta-orden', 'aria-hidden': 'true' }, String(posicion + 1)),
      h('button', {
        type: 'button', class: 'tarjeta-abrir', 'aria-expanded': String(esAbierta),
        onclick: () => { abierta = esAbierta ? null : historia.id; app.render(); },
      }, titulo, meta),
      insignia,
      filtrando ? null : h('span', { class: 'tarjeta-mover' },
        h('button', { type: 'button', class: 'icono', 'aria-label': `Subir: ${historia.titulo}`, disabled: posicion === 0, onclick: () => reordenar(historia.id, -1) }, '↑'),
        h('button', { type: 'button', class: 'icono', 'aria-label': `Bajar: ${historia.titulo}`, disabled: posicion === visibles.length - 1, onclick: () => reordenar(historia.id, 1) }, '↓'))),
    esAbierta ? h('div', { class: 'tarjeta-cuerpo' },
      editorHistoria(historia, (cambios) => {
        app.cambiar((x) => ({ ...x, historias: x.historias.map((y) => (y.id === historia.id ? { ...y, ...cambios } : y)) }), { redibujar: false });
        const actual = app.proyecto.historias.find((y) => y.id === historia.id);
        titulo.textContent = actual.titulo || '(sin título)';
        meta.textContent = metaTexto(actual);
        insignia.replaceChildren(insigniaCalidad(actual));
      }, { epicas }),
      h('div', { class: 'acciones' },
        sprintAbierto ? h('button', {
          type: 'button', class: 'btn btn--secundario',
          onclick: () => {
            abierta = null;
            app.cambiar((x) => ({ ...x, historias: x.historias.map((y) => (y.id === historia.id ? { ...y, sprintId: sprintAbierto.id, estado: 'todo' } : y)) }));
            app.avisar(`Agregada a ${sprintAbierto.nombre}.`);
          },
        }, `Pasar a ${sprintAbierto.nombre}`) : null,
        h('button', {
          type: 'button', class: 'btn-texto btn-peligro',
          onclick: () => {
            if (!confirm(`¿Eliminar "${historia.titulo}"? No se puede deshacer (salvo desde un respaldo).`)) return;
            abierta = null;
            app.cambiar((x) => ({ ...x, historias: x.historias.filter((y) => y.id !== historia.id) }));
          },
        }, 'Eliminar'))) : null);
    return li;
  };

  const sinEstimar = backlog.filter((x) => !x.puntos).length;
  const porMejorar = backlog.filter((x) => calidad(x) < 60).length;

  return h('div', { class: 'vista' },
    h('header', { class: 'vista-cabecera' },
      h('p', { class: 'eyebrow' }, p.nombre),
      h('h1', {}, 'Backlog'),
      h('p', { class: 'bajada' }, 'Arriba lo más importante. Arrastra para reordenar o usa las flechas.')),
    h('dl', { class: 'cifras' },
      cifra('Historias', backlog.length),
      cifra('Puntos estimados', puntosDe(backlog)),
      cifra('Sin estimar', sinEstimar),
      cifra('Por mejorar', porMejorar)),
    h('div', { class: 'barra-filtros', role: 'search' },
      h('input', {
        type: 'search', placeholder: 'Buscar historias', 'aria-label': 'Buscar historias', value: filtros.texto,
        oninput: (e) => { filtros.texto = e.target.value; app.render(); document.querySelector('.barra-filtros input')?.focus(); },
      }),
      epicas.length ? selector({ '': 'Todas las épicas', ...Object.fromEntries(epicas.map((e) => [e, e])) }, filtros.epica, {
        'aria-label': 'Filtrar por épica', onchange: (e) => { filtros.epica = e.target.value; app.render(); },
      }) : null,
      h('button', {
        type: 'button', class: 'btn btn--secundario',
        onclick: () => {
          const nueva = {
            id: nuevoId('h'), titulo: 'Nueva historia', rol: p.rolPorDefecto, quiero: '', para: '',
            criterios: sugerirCriterios(''), epica: filtros.epica, puntos: null, prioridad: 'should',
            estado: 'backlog', sprintId: null, notaOriginal: '', creada: new Date().toISOString(), terminada: null,
          };
          abierta = nueva.id;
          app.cambiar((x) => ({ ...x, historias: [nueva, ...x.historias] }));
        },
      }, '+ Historia')),
    filtrando ? h('p', { class: 'ayuda' }, 'Con filtros activos no se puede reordenar.') : null,
    backlog.length
      ? (visibles.length ? h('ol', { class: 'lista-tarjetas' }, visibles.map(tarjeta)) : h('p', { class: 'vacio' }, 'Ninguna historia coincide con el filtro.'))
      : h('div', { class: 'vacio' },
        h('p', {}, 'El backlog está vacío.'),
        h('button', { type: 'button', class: 'btn', onclick: () => app.ir('notas') }, 'Convertir notas en historias')));
}

function metaTexto(x) {
  return [x.epica, x.puntos ? `${x.puntos} pts` : 'sin estimar', PRIORIDADES[x.prioridad]].filter(Boolean).join(' · ');
}

function cifra(etiqueta, valor) {
  return h('div', { class: 'cifra' }, h('dt', {}, etiqueta), h('dd', {}, String(valor)));
}
