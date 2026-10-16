// Backlog priorizado: el orden es la prioridad. Se reordena arrastrando o con los botones.
import { h, selector } from './dom.js';
import { mover, puntosDe, resumenEpicas, mapaHistorias, moverEnMapa } from '../nucleo/proyecto.js';
import { calidad, nuevoId, PRIORIDADES, sugerirCriterios, dividirHistoria, reemplazarPorPartes, revisarInvest, enunciado } from '../nucleo/historias.js';
import { iaConfigurada, criteriosConIa, dividirConIa, revisarConIa, redactarConIa, nombreProveedor } from '../ia.js';
import { revisarEnDosVoces, llamadasMaximas } from '../nucleo/dosvoces.js';
import { casosBorde, agregarCasosBorde } from '../nucleo/casosborde.js';
import { editorHistoria, insigniaCalidad, listaVerificacion } from './historia.js';
import { definicionesDe, marcar } from '../nucleo/definiciones.js';
import { vistaEstimar } from './estimar.js';
import { vistaPriorizar } from './priorizar.js';
import { panelObjetivos, detalleEpica } from './okr.js';
import { pronosticar, textoPronostico } from '../nucleo/pronostico.js';
import { issueDe, issueMarkdown, urlGithub, urlLinear } from '../nucleo/issues.js';
import { botonesMarkdown } from './compartir.js';
import { especificacionHistoria, especificacionEpica, reporteEpicas } from '../nucleo/reportes.js';

const filtros = { texto: '', epica: '' };
let revision = null; // { historiaId, pasos, estado: 'corriendo'|'lista'|'error', resultado, error }
let modo = 'lista'; // 'lista' | 'epicas' | 'mapa' | 'estimar' | 'priorizar'
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
        // Puntos y prioridad cambian las cifras de arriba; son listas, así que redibujar no quita el foco de un texto
        if ('puntos' in cambios || 'prioridad' in cambios) app.render();
      }, { epicas }),
      listaVerificacion(historia, definicionesDe(app.proyecto).ready, 'ready', (item, valor) => app.cambiar((x) => ({
        ...x, historias: x.historias.map((y) => (y.id === historia.id ? marcar(y, 'ready', item, valor) : y)),
      }), { redibujar: false })),
      revision?.historiaId === historia.id ? panelRevision(app, historia) : null,
      h('div', { class: 'compartir' },
        botonesMarkdown(app, 'Especificación para agente', `spec-${historia.titulo}`, () => especificacionHistoria(app.proyecto, historia.id)),
        enlacesIssue(app, historia)),
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
      Object.entries({ lista: 'Lista priorizada', priorizar: 'Priorizar', epicas: 'Épicas', mapa: 'Mapa', estimar: 'Estimar en equipo' }).map(([m, texto]) => h('button', {
        type: 'button', role: 'tab', 'aria-selected': String(modo === m), class: 'pestana',
        onclick: () => { modo = m; app.render(); },
      }, texto))),
    modo === 'epicas' ? vistaEpicas(app) : null,
    modo === 'estimar' ? vistaEstimar(app) : null,
    modo === 'mapa' ? vistaMapa(app) : null,
    modo === 'priorizar' ? vistaPriorizar(app) : null,
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

  const borde = casosBorde(historia);
  if (borde.length) {
    botones.push(h('button', {
      type: 'button', class: 'btn btn--secundario',
      title: borde.map((c) => c.texto).join(' · '),
      onclick: () => app.cambiarConDeshacer(`${borde.length} casos borde agregados a los criterios.`, (x) => ({
        ...x, historias: x.historias.map((y) => (y.id === historia.id ? agregarCasosBorde(y) : y)),
      })),
    }, `Agregar ${borde.length} casos borde`));
  }
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
    const revisora = app.configRevisor();
    botones.push(h('button', {
      type: 'button', class: 'btn btn--secundario',
      title: `Revisa ${nombreProveedor(revisora)} y corrige ${nombreProveedor(app.ia)}. Hasta ${llamadasMaximas()} llamadas.`,
      disabled: revision?.estado === 'corriendo',
      onclick: () => iniciarRevision(app, historia),
    }, 'Revisar en dos voces'));
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
  const pron = pronosticar(app.proyecto);
  const porEpica = Object.fromEntries((pron?.epicas || []).map((x) => [x.epica, x]));
  return h('div', {},
    panelObjetivos(app),
    panelPronostico(pron),
    h('div', { class: 'compartir' }, botonesMarkdown(app, 'Reporte de avance por épica', 'avance-epicas', () => reporteEpicas(app.proyecto))),
    h('ul', { class: 'lista-epicas' }, epicas.map((e) => h('li', { class: 'epica' },
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
      e.sinEstimar ? ` · ${e.sinEstimar} sin estimar` : ''),
    porEpica[e.epica] ? h('p', { class: 'pronostico-linea' }, h('span', { class: 'eyebrow' }, 'Pronóstico'), ' ', textoPronostico(porEpica[e.epica]),
      porEpica[e.epica].sinEstimar ? h('span', { class: 'chip chip--aviso' }, `${porEpica[e.epica].sinEstimar} sin estimar`) : null) : null,
    e.epica ? detalleEpica(app, e.epica) : null,
    e.historias > e.hechas ? h('div', { class: 'compartir' },
      botonesMarkdown(app, 'Especificación de la épica', `epica-${e.epica || 'sin-epica'}`, () => especificacionEpica(app.proyecto, e.epica))) : null))));
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

async function iniciarRevision(app, historia) {
  revision = { historiaId: historia.id, pasos: [], estado: 'corriendo', resultado: null, error: null };
  app.render();
  try {
    revision.resultado = await revisarEnDosVoces(historia, {
      revisar: (h) => revisarConIa(app.configRevisor(), h),
      redactar: (h, obs) => redactarConIa(app.ia, h, obs),
      alPaso: (paso) => { if (revision?.historiaId === historia.id) { revision.pasos.push(paso); app.render(); } },
    });
    if (revision?.historiaId === historia.id) revision.estado = 'lista';
  } catch (err) {
    if (revision?.historiaId === historia.id) { revision.estado = 'error'; revision.error = err.message; }
  }
  app.render();
}

const VOCES = { revisor: 'Revisor', redactor: 'Redactor', reglas: 'Reglas INVEST' };

/** Conversación entre las dos voces y, al final, la comparación para aceptar o descartar. */
function panelRevision(app, historia) {
  const r = revision;
  const cerrar = () => { revision = null; app.render(); };
  const resultado = r.resultado;

  return h('section', { class: 'revision', 'aria-label': 'Revisión en dos voces', 'aria-busy': String(r.estado === 'corriendo') },
    h('h3', {}, 'Revisión en dos voces'),
    h('ol', { class: 'revision-pasos' },
      r.pasos.map((p) => h('li', { class: `revision-paso revision-paso--${p.voz}` },
        h('span', { class: 'revision-voz' }, VOCES[p.voz]),
        h('span', {}, p.texto),
        p.detalle?.length ? h('ul', {}, p.detalle.map((d) => h('li', {}, d))) : null)),
      r.estado === 'corriendo' ? h('li', { class: 'revision-paso revision-paso--pensando' }, h('span', { class: 'revision-voz' }, '…'), 'Pensando') : null),
    r.estado === 'error' ? h('p', { class: 'error', role: 'alert' }, r.error) : null,
    r.estado === 'lista' && resultado ? h('div', {},
      resultado.cambio ? h('div', { class: 'comparacion' },
        h('div', {}, h('p', { class: 'eyebrow' }, 'Antes'), h('p', { class: 'enunciado' }, enunciado(historia)), h('ul', {}, historia.criterios.map((c) => h('li', {}, c)))),
        h('div', {}, h('p', { class: 'eyebrow' }, 'Después'), h('p', { class: 'enunciado' }, enunciado(resultado.final)), h('ul', {}, resultado.final.criterios.map((c) => h('li', {}, c)))))
        : h('p', {}, 'No hubo cambios que proponer.'),
      h('p', { class: 'ayuda' }, `${resultado.llamadas} ${resultado.llamadas === 1 ? 'llamada' : 'llamadas'} a la IA.`)) : null,
    h('div', { class: 'acciones' },
      r.estado === 'lista' && resultado?.cambio ? h('button', {
        type: 'button', class: 'btn btn--cobre',
        onclick: () => {
          const { rol, quiero, para, criterios, titulo } = resultado.final;
          revision = null;
          app.cambiarConDeshacer('Cambios de la revisión aplicados.', (x) => ({
            ...x, historias: x.historias.map((y) => (y.id === historia.id ? { ...y, rol, quiero, para, criterios, titulo } : y)),
          }));
        },
      }, 'Aceptar cambios') : null,
      r.estado !== 'corriendo' ? h('button', { type: 'button', class: 'btn-texto', onclick: cerrar }, resultado?.cambio ? 'Descartar' : 'Cerrar') : null));
}

/** Crear la issue en GitHub o Linear: abre el formulario ya lleno (la persona revisa y crea) o copia el Markdown. */
function enlacesIssue(app, historia) {
  const abrir = (generarUrl) => {
    try {
      const actual = app.proyecto.historias.find((y) => y.id === historia.id) || historia;
      window.open(generarUrl(issueDe(app.proyecto, actual)), '_blank', 'noopener');
    } catch (e) {
      app.avisar(e.message, 'error');
    }
  };
  return h('span', { class: 'compartir-md', role: 'group', 'aria-label': 'Crear issue' },
    h('span', { class: 'compartir-etiqueta' }, 'Issue'),
    h('button', {
      type: 'button', class: 'btn-texto',
      title: app.proyecto.github ? `Abre una issue nueva en ${app.proyecto.github}` : 'Configura el repositorio en Ajustes',
      onclick: () => (app.proyecto.github ? abrir((i) => urlGithub(app.proyecto.github, i)) : app.avisar('Indica el repositorio de GitHub en Ajustes → Proyecto.', 'error')),
    }, 'GitHub'),
    h('button', { type: 'button', class: 'btn-texto', onclick: () => abrir(urlLinear) }, 'Linear'),
    h('button', {
      type: 'button', class: 'btn-texto',
      onclick: async () => {
        const actual = app.proyecto.historias.find((y) => y.id === historia.id) || historia;
        try { await navigator.clipboard.writeText(issueMarkdown(issueDe(app.proyecto, actual))); app.avisar('Issue copiada en Markdown.'); } catch { app.avisar('El navegador no permitió copiar.', 'error'); }
      },
    }, 'Copiar'));
}

/** Resumen del pronóstico: escenarios de velocidad y cuándo se termina todo el backlog. */
function panelPronostico(pron) {
  if (!pron) {
    return h('p', { class: 'ayuda' }, 'El pronóstico de entrega aparece cuando cierres tu primer sprint: se calcula con la velocidad real, no con supuestos.');
  }
  const { escenarios: e, total } = pron;
  return h('section', { class: 'panel pronostico', 'aria-labelledby': 'pronostico-titulo' },
    h('h2', { id: 'pronostico-titulo' }, '¿Cuándo va a estar?'),
    h('p', {}, total.pendientes ? `Todo el backlog pendiente (${total.pendientes} pts): ${textoPronostico(total)}.` : 'No queda trabajo estimado pendiente.'),
    h('p', { class: 'ayuda' }, `Según tus últimos ${e.sprints} ${e.sprints === 1 ? 'sprint' : 'sprints'}: optimista ${e.optimista} pts por sprint, probable ${e.probable}, pesimista ${e.pesimista}. `,
      'Las épicas avanzan en el orden del backlog.',
      total.sinEstimar ? ` Hay ${total.sinEstimar} historias sin estimar que no se cuentan: el plazo real será mayor.` : ''));
}
