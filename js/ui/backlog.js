// Backlog priorizado: el orden es la prioridad. Se reordena arrastrando o con los botones.
import { h, selector } from './dom.js';
import { mover, puntosDe, resumenEpicas, mapaHistorias, moverEnMapa } from '../nucleo/proyecto.js';
import { calidad, nuevoId, PRIORIDADES, sugerirCriterios, dividirHistoria, reemplazarPorPartes, revisarInvest } from '../nucleo/historias.js';
import { iaConfigurada, criteriosConIa, dividirConIa } from '../ia.js';
import { editorHistoria, insigniaCalidad, listaVerificacion } from './historia.js';
import { definicionesDe, marcar } from '../nucleo/definiciones.js';
import { vistaEstimar } from './estimar.js';

const filtros = { texto: '', epica: '' };
let modo = 'lista'; // 'lista' | 'epicas' | 'mapa' | 'estimar'
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
    const zonaIa = h('span', { class: 'acciones-ia' }, esAbierta ? accionesInteligentes(app, historia) : null);

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
        zonaIa.replaceChildren(...accionesInteligentes(app, actual));
      }, { epicas }),
      listaVerificacion(historia, definicionesDe(app.proyecto).ready, 'ready', (item, valor) => app.cambiar((x) => ({
        ...x, historias: x.historias.map((y) => (y.id === historia.id ? marcar(y, 'ready', item, valor) : y)),
      }), { redibujar: false })),
      h('div', { class: 'acciones' },
        zonaIa,
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
            abierta = null;
            app.cambiarConDeshacer(`"${historia.titulo}" eliminada.`, (x) => ({ ...x, historias: x.historias.filter((y) => y.id !== historia.id) }));
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
    h('div', { class: 'pestanas', role: 'tablist', 'aria-label': 'Vista del backlog' },
      Object.entries({ lista: 'Lista priorizada', epicas: 'Épicas', mapa: 'Mapa', estimar: 'Estimar en equipo' }).map(([m, texto]) => h('button', {
        type: 'button', role: 'tab', 'aria-selected': String(modo === m), class: 'pestana',
        onclick: () => { modo = m; app.render(); },
      }, texto))),
    modo === 'epicas' ? vistaEpicas(app) : null,
    modo === 'estimar' ? vistaEstimar(app) : null,
    modo === 'mapa' ? vistaMapa(app) : null,
    modo !== 'lista' ? null : h('dl', { class: 'cifras' },
      cifra('Historias', backlog.length),
      cifra('Puntos estimados', puntosDe(backlog)),
      cifra('Sin estimar', sinEstimar),
      cifra('Por mejorar', porMejorar)),
    modo !== 'lista' ? null : h('div', { class: 'barra-filtros', role: 'search' },
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
    modo !== 'lista' ? null : filtrando ? h('p', { class: 'ayuda' }, 'Con filtros activos no se puede reordenar.') : null,
    modo !== 'lista' ? null : backlog.length
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

/** Dividir (con reglas o IA) y mejorar criterios con IA. Solo aparecen cuando sirven. */
function accionesInteligentes(app, historia) {
  const conIa = iaConfigurada(app.ia);
  const codigos = revisarInvest(historia).map((a) => a.codigo);
  const pideDividir = codigos.includes('varias') || codigos.includes('larga') || codigos.includes('grande');
  const porReglas = dividirHistoria(historia);
  const botones = [];

  const dividir = (partes, origen) => {
    abierta = null;
    app.cambiarConDeshacer(`Dividida en ${partes.length} historias ${origen}.`, (x) => ({ ...x, historias: reemplazarPorPartes(x.historias, historia.id, partes) }));
  };
  const ocupado = async (boton, texto, tarea) => {
    const original = boton.textContent;
    boton.disabled = true;
    boton.textContent = texto;
    try {
      await tarea();
    } catch (err) {
      app.avisar(err.message, 'error');
    } finally {
      boton.disabled = false;
      boton.textContent = original;
    }
  };

  if (pideDividir && conIa) {
    botones.push(h('button', {
      type: 'button', class: 'btn btn--secundario',
      onclick: (e) => ocupado(e.currentTarget, 'Dividiendo…', async () => dividir(await dividirConIa(app.ia, historia), 'con IA')),
    }, 'Dividir con IA'));
  }
  if (porReglas && (pideDividir || !conIa)) {
    botones.push(h('button', { type: 'button', class: 'btn btn--secundario', onclick: () => dividir(porReglas, 'por sus partes') },
      `Dividir en ${porReglas.length}`));
  }
  if (conIa) {
    botones.push(h('button', {
      type: 'button', class: 'btn btn--secundario',
      onclick: (e) => ocupado(e.currentTarget, 'Escribiendo…', async () => {
        const criterios = await criteriosConIa(app.ia, historia);
        app.cambiarConDeshacer('Criterios de aceptación actualizados.', (x) => ({ ...x, historias: x.historias.map((y) => (y.id === historia.id ? { ...y, criterios } : y)) }));
      }),
    }, 'Mejorar criterios con IA'));
  }
  return botones;
}

/** Épicas con su avance; al elegir una se vuelve a la lista filtrada por ella. */
function vistaEpicas(app) {
  const epicas = resumenEpicas(app.proyecto);
  if (!epicas.length) return h('p', { class: 'vacio' }, 'Aún no hay historias.');
  return h('ul', { class: 'lista-epicas' }, epicas.map((e) => h('li', { class: 'epica' },
    h('div', { class: 'epica-cabecera' },
      h('button', {
        type: 'button', class: 'epica-nombre',
        onclick: () => { filtros.epica = e.epica; modo = 'lista'; app.render(); },
        disabled: !e.epica,
      }, e.epica || 'Sin épica'),
      h('span', { class: 'epica-avance' }, `${e.avance}%`)),
    h('div', { class: 'capacidad-barra', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': e.avance, 'aria-label': `Avance de ${e.epica || 'sin épica'}` },
      h('span', { class: `relleno-${Math.round(e.avance / 5) * 5}` })),
    h('p', { class: 'tarjeta-meta' },
      `${e.hechas} de ${e.historias} historias · ${e.puntosHechos} de ${e.puntos} pts`,
      e.sinEstimar ? ` · ${e.sinEstimar} sin estimar` : ''))));
}

/** Mapa de historias: arrastra una tarjeta a otra celda para cambiar su épica o su versión. */
function vistaMapa(app) {
  const { epicas, filas } = mapaHistorias(app.proyecto);
  if (!app.proyecto.historias.length) return h('p', { class: 'vacio' }, 'Aún no hay historias.');
  let arrastrada = null;

  const celda = (fila, epica) => h('td', {
    class: 'mapa-celda',
    ondragover: (e) => { if (arrastrada) { e.preventDefault(); e.currentTarget.classList.add('is-destino'); } },
    ondragleave: (e) => e.currentTarget.classList.remove('is-destino'),
    ondrop: (e) => {
      e.preventDefault();
      const id = arrastrada;
      arrastrada = null;
      if (id) app.cambiar((x) => ({ ...x, historias: moverEnMapa(x.historias, id, epica, fila.prioridad) }));
    },
  }, fila.celdas[epica].map((x) => h('button', {
    type: 'button', draggable: 'true',
    class: `mapa-tarjeta${x.estado === 'done' ? ' is-hecha' : ''}`,
    title: 'Arrastra para cambiar épica o versión; clic para editar',
    ondragstart: (e) => { arrastrada = x.id; e.dataTransfer.effectAllowed = 'move'; },
    onclick: () => { abierta = x.id; modo = 'lista'; filtros.texto = ''; filtros.epica = ''; app.render(); },
  }, x.titulo, x.puntos ? h('span', { class: 'tarjeta-meta' }, ` · ${x.puntos}`) : null)));

  return h('div', { class: 'mapa-contenedor' },
    h('p', { class: 'ayuda' }, 'Cada columna es una épica y cada fila una versión. La primera fila es lo mínimo para salir: si no cabe en un sprint o dos, recórtala. Arrastra tarjetas para mover; clic para editar.'),
    h('div', { class: 'mapa-scroll' },
      h('table', { class: 'mapa' },
        h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, ''), epicas.map((e) => h('th', { scope: 'col' }, e || 'Sin épica')))),
        h('tbody', {}, filas.map((fila) => h('tr', { class: `mapa-fila mapa-fila--${fila.prioridad}` },
          h('th', { scope: 'row' }, fila.nombre, h('span', { class: 'tarjeta-meta' }, `${fila.puntos} pts pendientes`)),
          epicas.map((e) => celda(fila, e))))))));
}
