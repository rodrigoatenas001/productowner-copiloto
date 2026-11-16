// Pestaña «Proceso» del backlog: el circuito del cliente en carriles (BPMN liviano),
// enlazado a las historias, con revisión de cobertura y exportación a BPMN 2.0.
import { h, campo, selector, descargar, vacio, termino, pedirTexto, avisar, confirmar } from './dom.js';
import {
  TIPOS_PASO, procesoDe, flujoDeValor, leerDuracion, formatoDuracion, agregarCarril, quitarCarril, renombrarCarril, moverCarril, agregarPaso, insertarPasoDespues,
  editarPaso, eliminarPaso, moverPaso, conectar, desconectar, revisarProceso, disposicion, aBpmn, lineas,
} from '../nucleo/proceso.js';
import { nombreArchivo } from '../nucleo/exportar.js';
import { INDUSTRIAS, plantillasDe, procesoDesdePlantilla, adaptarPlantilla, plantillaParaIa } from '../nucleo/plantillasProceso.js';
import { historiasDesdeProceso, mejorarConIa, contextoParaIa } from '../nucleo/derivar.js';
import { iaConfigurada, historiasDelProcesoConIa, adaptarPlantillaConIa, nombreProveedor } from '../ia.js';

let abierto = null; // paso con el editor desplegado
let verPlantillas = false; // selector de plantillas por industria abierto
let industria = 'agro';
let contextoEmpresa = ''; // para adaptar la plantilla con IA
let ocupado = ''; // texto del botón mientras la IA trabaja
// Qué muestra el diagrama (se recuerda en este navegador)
const VISTA_INICIAL = { tiempos: true, dolores: true, cuello: true, ajustar: false };
let vista = (() => { try { return { ...VISTA_INICIAL, ...JSON.parse(localStorage.getItem('proceso-vista') || '{}') }; } catch { return { ...VISTA_INICIAL }; } })();
let verActores = false; // bloque «Editar actores» desplegado
let enfocar = null; // tras redibujar: 'actor' (el campo para agregar otro) o el id de un paso nuevo

/** Cada cambio redibuja la vista: devuelve el foco donde la persona seguía escribiendo. */
function devolverFoco() {
  if (!enfocar) return;
  const destino = enfocar;
  enfocar = null;
  requestAnimationFrame(() => {
    const el = destino === 'actor'
      ? document.getElementById('proceso-nuevo-actor')
      : document.querySelector(`#paso-${CSS.escape(destino)} .proceso-editor input[type="text"]`);
    if (!el) return;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  });
}

const NS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs = {}, ...hijos) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined) el.setAttribute(k, v);
  for (const hijo of hijos.flat()) if (hijo) el.append(hijo instanceof Node ? hijo : document.createTextNode(String(hijo)));
  return el;
};

export function vistaProceso(app) {
  const proyecto = app.proyecto;
  const proceso = procesoDe(proyecto);
  const cambiar = (f) => app.cambiar((x) => ({ ...x, proceso: f(procesoDe(x)) }));
  const { avisos, historiasFuera } = revisarProceso(proceso, proyecto.historias);

  if (!proceso.carriles.length && !proceso.pasos.length) {
    return h('div', { class: 'proceso' },
      vacio('Dibuja el circuito antes de escribir historias.',
        'Anota quién hace qué y en qué orden, con sus decisiones. Valídalo con tu cliente: si el circuito está bien, las historias salen solas, y verás qué pasos no tienen historias.',
        ['Partir de una plantilla por industria', () => { verPlantillas = true; app.render(); }],
        ['Partir con Cliente, Negocio y Sistema', () => cambiar((p) => ['Cliente', 'Negocio', 'Sistema'].reduce(agregarCarril, p))]),
      verPlantillas ? selectorPlantillas(app, proceso) : null);
  }

  devolverFoco();
  return h('div', { class: 'proceso' },
    h('p', { class: 'ayuda' }, 'El circuito real del cliente, con un subconjunto de BPMN: inicio, tarea, decisión y fin, en carriles por actor. Enlaza cada tarea con sus historias para ver qué falta levantar. ', termino('bpmn')),
    h('div', { class: 'acciones proceso-barra' },
      h('button', { type: 'button', class: 'btn btn--secundario', 'aria-expanded': String(verPlantillas), onclick: () => { verPlantillas = !verPlantillas; app.render(); } }, 'Plantilla por industria'),
      h('button', { type: 'button', class: 'btn', disabled: !proceso.pasos.some((x) => x.tipo === 'tarea') || Boolean(ocupado), onclick: () => generarHistorias(app) }, 'Generar historias del flujo'),
      iaConfigurada(app.ia) ? h('button', {
        type: 'button', class: 'btn btn--secundario', disabled: !proceso.pasos.some((x) => x.tipo === 'tarea') || Boolean(ocupado),
        title: `Redacta con ${nombreProveedor(app.ia)} a partir del borrador por reglas`,
        onclick: () => generarHistorias(app, { conIa: true }),
      }, ocupado === 'historias' ? 'Generando con IA…' : 'Generar con IA') : null),
    verPlantillas ? selectorPlantillas(app, proceso) : null,
    proceso.pasos.length ? resumenRevision(avisos, historiasFuera) : null,
    proceso.pasos.length ? diagrama(app, proceso) : null,
    proceso.pasos.length ? panelFlujo(proceso) : null,
    seccionCarriles(proceso, cambiar, !proceso.pasos.length),
    h('section', { class: 'panel', 'aria-labelledby': 'proceso-pasos' },
      h('h2', { id: 'proceso-pasos' }, 'Pasos'),
      proceso.pasos.length
        ? h('ol', { class: 'proceso-pasos' }, proceso.pasos.map((paso, i) => filaPaso(app, proceso, paso, i, cambiar)))
        : h('p', { class: 'ayuda' }, 'Empieza con un inicio: lo que dispara el proceso (por ejemplo, «La clienta quiere una torta»).'),
      h('div', { class: 'acciones' }, Object.entries(TIPOS_PASO).map(([tipo, nombre]) => h('button', {
        type: 'button', class: 'btn btn--secundario btn--chico',
        onclick: () => cambiar((p) => {
          const nuevo = agregarPaso(p, { tipo, carril: p.pasos[p.pasos.length - 1]?.carril });
          abierto = nuevo.pasos[nuevo.pasos.length - 1].id;
          enfocar = abierto;
          return nuevo;
        }),
      }, `+ ${nombre}`)))),
    seccionRevision(app, avisos, historiasFuera, proceso.pasos.length),
    h('div', { class: 'acciones' },
      h('button', {
        type: 'button', class: 'btn btn--secundario', disabled: !proceso.pasos.length,
        onclick: () => descargar(nombreArchivo(proyecto, 'bpmn'), aBpmn(proceso, proyecto.nombre, proyecto.historias), 'application/xml'),
      }, 'Descargar BPMN 2.0 (.bpmn)'),
      h('p', { class: 'ayuda' }, 'Se abre ya dibujado en bpmn.io, Camunda Modeler o Bizagi.')));
}

/**
 * Del proceso al backlog: propone una historia por cada tarea sin historias y las lleva a revisión
 * (en Notas, como cualquier propuesta). Al agregarlas quedan enlazadas a su paso.
 */
async function generarHistorias(app, { conIa = false } = {}) {
  let candidatas = historiasDesdeProceso(app.proyecto);
  if (!candidatas.length) { app.avisar('Todas las tareas del proceso ya tienen historias.'); return; }
  let origen = 'desde el proceso';
  if (conIa) {
    // La IA mejora la redacción del borrador por reglas; si falla, se sigue con las reglas
    ocupado = 'historias';
    app.render();
    try {
      candidatas = mejorarConIa(candidatas, await historiasDelProcesoConIa(app.ia, contextoParaIa(app.proyecto, candidatas)));
      origen = `desde el proceso, redactadas con ${nombreProveedor(app.ia)}`;
    } catch (e) {
      app.avisar(`La IA no respondió (${e.message}). Te muestro el borrador por reglas.`, 'error');
    } finally {
      ocupado = '';
    }
  }
  app.candidatos = candidatas.map((x) => ({ ...x, incluir: true }));
  app.ir('notas');
  app.avisar(`${candidatas.length} historias propuestas ${origen}. Revísalas antes de agregarlas: quedarán enlazadas a sus pasos.`);
}

/** Selector en dos pasos: industria y proceso, con vista previa de carriles, pasos y dolores típicos. */
function selectorPlantillas(app, proceso) {
  const usar = async (pl) => {
    if (proceso.pasos.length && !(await confirmar('¿Reemplazar el proceso actual por la plantilla?', {
      detalle: 'Los carriles y pasos de ahora se reemplazan. Las historias del backlog no se tocan, pero dejan de estar enlazadas a los pasos.',
      aceptar: 'Usar la plantilla',
    }))) return;
    verPlantillas = false;
    app.cambiarConDeshacer(`Plantilla «${pl.nombre}» aplicada. Ajusta carriles y pasos a tu cliente, y confirma los dolores que veas en terreno.`, (x) => ({ ...x, proceso: procesoDesdePlantilla(pl) }));
  };
  return h('section', { class: 'panel plantillas-proceso', 'aria-labelledby': 'pl-titulo' },
    h('h2', { id: 'pl-titulo' }, 'Partir de una plantilla'),
    h('p', { class: 'ayuda' }, 'Un punto de partida, no un modelo cerrado: el camino feliz, sus decisiones, tiempos sugeridos y dolores típicos para confirmar con el cliente.'),
    h('div', { class: 'pestanas pestanas--chicas', role: 'tablist', 'aria-label': 'Industria' },
      Object.entries(INDUSTRIAS).map(([clave, ind]) => h('button', {
        type: 'button', role: 'tab', class: 'pestana', 'aria-selected': String(industria === clave),
        onclick: () => { industria = clave; app.render(); },
      }, ind.nombre))),
    h('p', { class: 'ayuda' }, INDUSTRIAS[industria].descripcion),
    iaConfigurada(app.ia)
      ? campo('Tu empresa, en una o dos líneas (para adaptar con IA)', h('input', {
        type: 'text', value: contextoEmpresa, maxlength: 300, placeholder: 'Ej.: planta de proceso de cerdos, supervisores por turno y SAP',
        oninput: (e) => { contextoEmpresa = e.target.value; },
      }), 'La IA solo cambia nombres de actores, pasos, para qué y dolores: el circuito no cambia.')
      : h('p', { class: 'ayuda' }, 'Con una IA conectada en Ajustes puedes adaptar la plantilla a la empresa (nombres de cargos, sistemas y dolores) antes de usarla.'),
    h('ul', { class: 'plantillas-lista' }, plantillasDe(industria).map((pl) => {
      const tareas = pl.pasos.filter(([, tipo]) => tipo === 'tarea');
      const decisiones = pl.pasos.filter(([, tipo]) => tipo === 'decision');
      const dolores = pl.pasos.flatMap(([, , , , o]) => o?.dolores || []);
      return h('li', { class: 'plantilla-proceso' },
        h('h3', {}, pl.nombre),
        h('p', { class: 'ayuda' }, pl.descripcion),
        h('p', { class: 'tarjeta-meta' }, `${pl.carriles.join(' · ')}`),
        h('p', { class: 'tarjeta-meta' }, `${tareas.length} tareas · ${decisiones.map(([, , t]) => t).join(' ')}`),
        h('details', {}, h('summary', {}, `Dolores típicos (${dolores.length})`), h('ul', {}, dolores.map((d) => h('li', {}, d)))),
        h('div', { class: 'acciones' },
          h('button', { type: 'button', class: 'btn btn--secundario btn--chico', disabled: Boolean(ocupado), onclick: () => usar(pl) }, 'Usar esta plantilla'),
          iaConfigurada(app.ia) ? h('button', {
            type: 'button', class: 'btn-texto', disabled: Boolean(ocupado),
            onclick: async () => {
              if (!contextoEmpresa.trim()) { app.avisar('Escribe primero cómo es la empresa, en una o dos líneas.', 'error'); return; }
              ocupado = pl.clave;
              app.render();
              try {
                const adaptada = adaptarPlantilla(pl, await adaptarPlantillaConIa(app.ia, plantillaParaIa(pl), contextoEmpresa.trim()));
                ocupado = '';
                await usar(adaptada);
              } catch (e) {
                ocupado = '';
                app.avisar(`La IA no respondió (${e.message}). Puedes usar la plantilla tal cual y ajustarla a mano.`, 'error');
                app.render();
              }
            },
          }, ocupado === pl.clave ? 'Adaptando…' : 'Adaptar con IA y usar') : null));
    })));
}

function seccionCarriles(proceso, cambiar, siempreAbierto) {
  const entrada = h('input', { type: 'text', id: 'proceso-nuevo-actor', placeholder: 'Ej.: Clienta, Dueña, Tienda en línea', maxlength: 60 });
  const agregar = () => { if (entrada.value.trim()) { enfocar = 'actor'; verActores = true; cambiar((p) => agregarCarril(p, entrada.value)); } };
  const ultimo = proceso.carriles.length - 1;
  return h('details', {
    class: 'panel proceso-actores', open: siempreAbierto || verActores || enfocar === 'actor' ? '' : null,
    ontoggle: (e) => { verActores = e.target.open; },
  },
    h('summary', {}, h('h2', { id: 'proceso-carriles' }, `Editar actores (${proceso.carriles.length})`),
      h('span', { class: 'proceso-meta' }, ` · ${proceso.carriles.map((c) => c.nombre).join(', ')}`)),
    h('p', { class: 'ayuda' }, 'Son los carriles del diagrama, de arriba hacia abajo. Toca un nombre para cambiarlo.'),
    h('ul', { class: 'proceso-carriles' }, proceso.carriles.map((c, i) => h('li', { class: 'chip-editable' },
      h('button', { type: 'button', class: 'icono', 'aria-label': `Subir el carril ${c.nombre}`, disabled: i === 0, onclick: () => cambiar((p) => moverCarril(p, c.id, -1)) }, '↑'),
      h('button', {
        type: 'button', class: 'chip-nombre', 'aria-label': `Cambiar el nombre de ${c.nombre}`,
        onclick: async () => {
          const nombre = await pedirTexto('Nombre del actor', { valor: c.nombre, aceptar: 'Guardar' });
          if (nombre) cambiar((p) => renombrarCarril(p, c.id, nombre));
        },
      }, c.nombre),
      h('button', { type: 'button', class: 'icono', 'aria-label': `Bajar el carril ${c.nombre}`, disabled: i === ultimo, onclick: () => cambiar((p) => moverCarril(p, c.id, 1)) }, '↓'),
      h('button', {
        type: 'button', class: 'icono', 'aria-label': `Quitar el carril ${c.nombre}`,
        disabled: proceso.carriles.length === 1,
        onclick: () => cambiar((p) => quitarCarril(p, c.id)),
      }, '×')))),
    h('form', { class: 'fila-agregar', onsubmit: (e) => { e.preventDefault(); agregar(); } },
      campo('Nuevo actor', entrada),
      h('button', { type: 'submit', class: 'btn btn--secundario' }, 'Agregar')));
}

function filaPaso(app, proceso, paso, i, cambiar) {
  const editar = (cambios) => cambiar((p) => editarPaso(p, paso.id, cambios));
  const nombre = (id) => {
    const destino = proceso.pasos.find((x) => x.id === id);
    return destino ? `${proceso.pasos.indexOf(destino) + 1}. ${destino.texto || TIPOS_PASO[destino.tipo]}` : '';
  };
  const carril = proceso.carriles.find((c) => c.id === paso.carril)?.nombre || '';
  const otros = proceso.pasos.filter((x) => x.id !== paso.id && !paso.siguientes.some((s) => s.a === x.id));
  const historias = app.proyecto.historias.filter((x) => x.tipo === 'historia');
  const porEpica = Map.groupBy ? Map.groupBy(historias, (x) => x.epica || 'Sin épica') : agrupar(historias);

  // El editor (con la lista de historias para enlazar) se arma solo al abrir el paso:
  // con cientos de historias, armarlo para cada paso dejaba la pestaña en decenas de miles de nodos
  const crearEditor = () => h('div', { class: 'proceso-editor' },
        h('div', { class: 'editor-fila' },
          campo('Qué pasa', h('input', { type: 'text', value: paso.texto, maxlength: 160, placeholder: paso.tipo === 'decision' ? '¿Hay stock?' : 'Verbo + objeto: «Paga el pedido»', onchange: (e) => editar({ texto: e.target.value.trim() }) })),
          campo('Tipo', selector(TIPOS_PASO, paso.tipo, { onchange: (e) => editar({ tipo: e.target.value }) })),
          campo('Quién', selector(Object.fromEntries(proceso.carriles.map((c) => [c.id, c.nombre])), paso.carril, { onchange: (e) => editar({ carril: e.target.value }) }))),
        paso.tipo === 'tarea' ? h('div', { class: 'editor-fila' },
          campoDuracion('Tiempo de trabajo', paso.trabajo, 'Ej.: 30 min, 2 h', (min) => editar({ trabajo: min })),
          campoDuracion('Espera antes de este paso', paso.espera, 'Ej.: 1 d, 4 h', (min) => editar({ espera: min }),
            'Lo que el trabajo queda detenido antes de empezar este paso: una aprobación, un repuesto, una firma.')) : null,
        paso.tipo === 'tarea' ? campo('Para qué sirve este paso', h('input', {
          type: 'text', value: paso.valor || '', maxlength: 200, placeholder: 'Ej.: saber cuánto llegó y de qué proveedor',
          onchange: (e) => editar({ valor: e.target.value.trim() }),
        }), 'Es el «para» de las historias que salen de este paso.') : null,
        paso.tipo === 'tarea' ? editorDolores(paso, editar) : null,
        paso.tipo === 'tarea' ? campo('Reglas de este paso', h('textarea', {
          rows: 2, placeholder: 'Una por línea. Ej.: la guía debe calzar con la orden de compra',
          onchange: (e) => editar({ reglas: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) }),
        }, (paso.reglas || []).join('\n')), 'Pasan a las historias generadas desde el paso.') : null,

        paso.tipo === 'fin' ? null : h('fieldset', { class: 'proceso-salidas' },
          h('legend', {}, paso.tipo === 'decision' ? 'Salidas (una por respuesta)' : 'Va a'),
          paso.siguientes.length ? h('ul', {}, paso.siguientes.map((s) => h('li', {},
            h('span', {}, '→ ', nombre(s.a)),
            paso.tipo === 'decision' ? h('input', {
              type: 'text', value: s.etiqueta, maxlength: 40, placeholder: 'Sí / No', 'aria-label': `Respuesta que lleva a ${nombre(s.a)}`,
              onchange: (e) => cambiar((p) => conectar(p, paso.id, s.a, e.target.value)),
            }) : null,
            h('button', { type: 'button', class: 'btn-texto', onclick: () => cambiar((p) => desconectar(p, paso.id, s.a)) }, 'Quitar')))) : h('p', { class: 'ayuda' }, 'Todavía no lleva a ningún paso.'),
          otros.length ? selector({ '': 'Agregar salida hacia…', ...Object.fromEntries(otros.map((x) => [x.id, nombre(x.id)])) }, '', {
            'aria-label': 'Agregar salida hacia otro paso',
            onchange: (e) => { if (e.target.value) cambiar((p) => conectar(p, paso.id, e.target.value)); },
          }) : null),

        paso.tipo === 'tarea' ? h('fieldset', { class: 'proceso-historias' },
          h('legend', {}, 'Historias de este paso'),
          historias.length ? [...porEpica].map(([epica, lista]) => h('div', { class: 'proceso-epica' },
            h('p', { class: 'eyebrow' }, epica),
            lista.map((x) => h('label', { class: 'opcion' },
              h('input', {
                type: 'checkbox', checked: paso.historiaIds.includes(x.id),
                onchange: (e) => editar({ historiaIds: e.target.checked ? [...paso.historiaIds, x.id] : paso.historiaIds.filter((id) => id !== x.id) }),
              }), x.titulo)))) : h('p', { class: 'ayuda' }, 'Aún no hay historias en el backlog.')) : null,

        paso.tipo === 'fin' ? null : h('div', { class: 'acciones proceso-insertar' },
          h('span', { class: 'ayuda' }, '¿Faltó un paso?'),
          ['tarea', 'decision'].map((tipo) => h('button', {
            type: 'button', class: 'btn btn--secundario btn--chico',
            onclick: () => cambiar((p) => {
              const nuevo = insertarPasoDespues(p, paso.id, { tipo });
              abierto = nuevo.pasos[nuevo.pasos.findIndex((x) => x.id === paso.id) + 1].id;
              enfocar = abierto;
              return nuevo;
            }),
          }, `+ ${TIPOS_PASO[tipo]} después`))),
        h('div', { class: 'acciones' },
          h('button', { type: 'button', class: 'btn-texto', disabled: i === 0, onclick: () => cambiar((p) => moverPaso(p, paso.id, -1)) }, '↑ Antes'),
          h('button', { type: 'button', class: 'btn-texto', disabled: i === proceso.pasos.length - 1, onclick: () => cambiar((p) => moverPaso(p, paso.id, 1)) }, '↓ Después'),
          h('button', {
            type: 'button', class: 'btn-texto btn-peligro',
            onclick: () => { abierto = null; app.cambiarConDeshacer('Paso eliminado.', (x) => ({ ...x, proceso: eliminarPaso(procesoDe(x), paso.id) })); },
          }, 'Eliminar paso')));

  return h('li', { class: `proceso-paso proceso-paso--${paso.tipo}`, id: `paso-${paso.id}` },
    h('details', {
      open: abierto === paso.id,
      ontoggle: (e) => {
        if (e.target.open) {
          abierto = paso.id;
          if (!e.target.querySelector('.proceso-editor')) e.target.append(crearEditor());
        } else if (abierto === paso.id) abierto = null;
      },
    },
      h('summary', {},
        h('span', { class: 'proceso-numero' }, String(i + 1)),
        h('span', { class: `proceso-tipo proceso-tipo--${paso.tipo}` }, TIPOS_PASO[paso.tipo]),
        h('span', { class: 'proceso-resumen' }, paso.texto || h('em', {}, 'Sin nombre')),
        h('span', { class: 'proceso-meta' }, carril),
        paso.tipo === 'tarea' ? h('span', { class: `chip${paso.historiaIds.length ? ' chip--ok' : ' chip--aviso'}` }, `${paso.historiaIds.length} hist.`) : null),
      abierto === paso.id ? crearEditor() : null));
}

/** Dolores del paso: los de la plantilla son sospechas; se confirman con lo que se ve en terreno. */
function editorDolores(paso, editar) {
  const dolores = paso.dolores || [];
  const nuevo = h('input', { type: 'text', maxlength: 200, placeholder: 'Ej.: doble digitación entre la planilla y el ERP', 'aria-label': 'Nuevo dolor del paso' });
  const agregar = () => { if (nuevo.value.trim()) editar({ dolores: [...dolores, { texto: nuevo.value.trim(), confirmado: true }] }); };
  return h('fieldset', { class: 'proceso-dolores' },
    h('legend', {}, 'Puntos de dolor'),
    dolores.length ? h('ul', {}, dolores.map((d, i) => h('li', {},
      h('label', { class: 'opcion' },
        h('input', { type: 'checkbox', checked: d.confirmado, onchange: (e) => editar({ dolores: dolores.map((x, k) => (k === i ? { ...x, confirmado: e.target.checked } : x)) }) }),
        d.texto),
      h('button', { type: 'button', class: 'icono', 'aria-label': `Quitar el dolor: ${d.texto}`, onclick: () => editar({ dolores: dolores.filter((_, k) => k !== i) }) }, '×')))) : null,
    h('p', { class: 'ayuda' }, 'Marca los que confirmaste en terreno: se vuelven criterios de aceptación y suben la prioridad de la historia.'),
    h('div', { class: 'fila-accion fila-accion--dos' }, nuevo, h('button', { type: 'button', class: 'btn btn--secundario btn--chico', onclick: agregar }, 'Agregar dolor')));
}

/** Campo de duración: acepta «45 min», «2 h», «1,5 d»; vacío borra el dato. */
function campoDuracion(etiqueta, valor, ejemplo, alGuardar, ayuda) {
  return campo(etiqueta, h('input', {
    type: 'text', inputmode: 'text', value: Number.isFinite(valor) ? formatoDuracion(valor) : '', placeholder: ejemplo,
    onchange: (e) => {
      const texto = e.target.value.trim();
      if (!texto) { alGuardar(null); return; }
      const min = leerDuracion(texto);
      if (min === null) { avisar(`No entendí «${texto}». Escribe, por ejemplo, 45 min, 2 h o 1,5 d.`, 'error'); return; }
      alGuardar(min);
    },
  }), ayuda);
}

/**
 * Flujo de valor (VSM): cuánto del tiempo del circuito se trabaja y cuánto se espera, paso a paso.
 * Muestra dónde está el cuello de botella antes de decidir qué automatizar.
 */
function panelFlujo(proceso) {
  const v = flujoDeValor(proceso);
  const titulo = h('h2', { id: 'proceso-flujo' }, 'Flujo de valor', termino('vsm'));
  if (!v.medidos) {
    return h('section', { class: 'panel', 'aria-labelledby': 'proceso-flujo' }, titulo,
      h('p', { class: 'ayuda' }, 'Anota en cada tarea cuánto se trabaja y cuánto se espera antes de ella (abre el paso en la lista de abajo). Así ves dónde se pierde tiempo antes de decidir qué automatizar: muchas veces el problema no es el trabajo, es la espera.'));
  }
  const cuello = proceso.pasos.find((p) => p.id === v.cuello);
  const mayor = Math.max(...v.pasos.map((p) => p.total), 1);
  const cifra = (nombre, valor, extra) => h('div', { class: 'cifra' }, h('dt', {}, nombre), h('dd', {}, valor, extra ? h('span', { class: 'tarjeta-meta' }, extra) : null));
  return h('section', { class: 'panel', 'aria-labelledby': 'proceso-flujo' }, titulo,
    h('dl', { class: 'cifras cifras--4' },
      cifra('Tiempo total', formatoDuracion(v.total)),
      cifra('Trabajo', formatoDuracion(v.trabajo)),
      cifra('Espera', formatoDuracion(v.espera)),
      cifra('Eficiencia del flujo', `${v.eficiencia}%`, ' del tiempo se trabaja')),
    cuello ? h('p', { class: 'aviso-suave' }, h('strong', {}, 'Cuello de botella: '), `«${cuello.texto}»`,
      v.espera ? ` espera ${formatoDuracion(cuello.espera || 0)} antes de empezar. Antes de automatizar otros pasos, pregunta por qué se espera aquí.` : ` es el paso con más trabajo (${formatoDuracion(cuello.trabajo || 0)}).`) : null,
    h('ol', { class: 'vsm-barras', 'aria-label': 'Trabajo y espera por paso' }, v.pasos.map((p) => {
      const ancho = (min) => `${Math.max(min ? 1.5 : 0, (min / mayor) * 100)}%`;
      const barra = (clase, min, texto) => { const el = h('span', { class: clase, title: texto }); el.style.width = ancho(min); return el; };
      return h('li', { class: p.id === v.cuello ? 'is-cuello' : null },
        h('span', { class: 'vsm-nombre', title: p.texto }, p.texto || 'Paso sin nombre'),
        h('span', { class: 'vsm-pista' },
          barra('vsm-espera', p.espera, `Espera: ${formatoDuracion(p.espera)}`),
          barra('vsm-trabajo', p.trabajo, `Trabajo: ${formatoDuracion(p.trabajo)}`)),
        h('span', { class: 'vsm-valor' }, `${formatoDuracion(p.trabajo)} + ${formatoDuracion(p.espera)} de espera`));
    })),
    h('p', { class: 'vsm-leyenda ayuda' }, h('span', { class: 'vsm-muestra vsm-espera' }), ' espera  ', h('span', { class: 'vsm-muestra vsm-trabajo' }), ' trabajo',
      v.faltan ? ` · ${v.faltan} ${v.faltan === 1 ? 'tarea sin tiempos no suma' : 'tareas sin tiempos no suman'}` : '',
      ' · Se suma el camino principal, en el orden del proceso; los días son de calendario.'));
}

function agrupar(lista) {
  const m = new Map();
  for (const x of lista) { const k = x.epica || 'Sin épica'; if (!m.has(k)) m.set(k, []); m.get(k).push(x); }
  return m;
}

function seccionRevision(app, avisos, historiasFuera, cantidadPasos) {
  const NIVEL = { error: 'Falta', aviso: 'Revisar', info: 'Cobertura' };
  return h('section', { class: 'panel', id: 'revision-circuito', 'aria-labelledby': 'proceso-revision' },
    h('h2', { id: 'proceso-revision' }, 'Revisión del circuito'),
    avisos.length ? h('ul', { class: 'proceso-avisos' }, avisos.map((a) => h('li', { class: `proceso-aviso proceso-aviso--${a.nivel}` },
      h('span', { class: 'chip' }, NIVEL[a.nivel]), ' ',
      a.pasoId ? h('button', { type: 'button', class: 'btn-texto', onclick: () => { abierto = a.pasoId; app.render(); document.getElementById(`paso-${a.pasoId}`)?.scrollIntoView({ block: 'center' }); } }, a.texto) : a.texto)))
      : cantidadPasos
        ? h('p', { class: 'invest-ok' }, '✓ El circuito está completo y cada tarea tiene sus historias.')
        : h('p', { class: 'ayuda' }, 'Agrega los pasos del circuito para revisarlo.'),
    historiasFuera.length ? h('details', {},
      h('summary', {}, `Historias fuera del proceso (${historiasFuera.length})`),
      h('ul', {}, historiasFuera.map((x) => h('li', {}, x.titulo, x.epica ? h('span', { class: 'proceso-meta' }, ` · ${x.epica}`) : null)))) : null);
}

/** Arriba del diagrama: lo que falta, en una línea, con salto a la revisión completa. */
function resumenRevision(avisos, historiasFuera) {
  const cuenta = (nivel) => avisos.filter((a) => a.nivel === nivel).length;
  const partes = [
    [cuenta('error'), 'por completar', 'error'],
    [cuenta('aviso'), 'por revisar', 'aviso'],
    [avisos.filter((a) => a.nivel === 'info' && a.pasoId).length, 'tareas sin historias', 'info'],
    [historiasFuera.length, historiasFuera.length === 1 ? 'historia fuera del proceso' : 'historias fuera del proceso', 'info'],
  ].filter(([n]) => n);
  if (!partes.length) return h('p', { class: 'invest-ok proceso-pendientes' }, '✓ El circuito está completo y cada tarea tiene sus historias.');
  return h('p', { class: 'proceso-pendientes' },
    partes.map(([n, texto, nivel]) => h('span', { class: `proceso-aviso--${nivel}` }, h('span', { class: 'chip' }, String(n)), ` ${texto}`)),
    h('button', { type: 'button', class: 'btn-texto', onclick: () => document.getElementById('revision-circuito')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, 'Ver la revisión'));
}

/** Abre un paso en la lista de abajo y lo lleva a la vista. */
function abrirPaso(app, id) {
  abierto = id;
  app.render();
  requestAnimationFrame(() => document.getElementById(`paso-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
}

/** Texto del tooltip de un paso: historias, problemas, reglas y tiempos. */
function detallePaso(paso, historias) {
  const l = [paso.texto || 'Paso sin nombre'];
  if (paso.tipo === 'tarea') {
    l.push(historias.length ? `Historias (${historias.length}): ${historias.map((x) => x.titulo).join('; ')}` : 'Sin historias todavía');
    const dol = paso.dolores || [];
    if (dol.length) l.push(`Problemas: ${dol.map((x) => `${x.texto}${x.confirmado ? ' (confirmado)' : ' (por confirmar)'}`).join('; ')}`);
    if ((paso.reglas || []).length) l.push(`Reglas: ${paso.reglas.join('; ')}`);
    if (Number.isFinite(paso.trabajo) || Number.isFinite(paso.espera)) l.push(`Trabajo ${formatoDuracion(paso.trabajo || 0)} · espera ${formatoDuracion(paso.espera || 0)}`);
  }
  l.push('Clic para editar');
  return l.join('\n');
}

/** Interruptores del diagrama. */
function barraDiagrama(app) {
  const interruptor = (clave, texto, ayuda) => h('label', { class: 'proceso-interruptor', title: ayuda },
    h('input', {
      type: 'checkbox', checked: vista[clave],
      onchange: (e) => {
        vista = { ...vista, [clave]: e.target.checked };
        try { localStorage.setItem('proceso-vista', JSON.stringify(vista)); } catch { /* sin almacenamiento */ }
        app.render();
      },
    }), ` ${texto}`);
  return h('div', { class: 'proceso-vista-barra', role: 'group', 'aria-label': 'Qué mostrar en el diagrama' },
    interruptor('tiempos', 'Tiempos', 'Trabajo y espera bajo cada tarea'),
    interruptor('dolores', 'Problemas', 'Marca ⚠ con los problemas anotados en cada tarea'),
    interruptor('cuello', 'Cuello de botella', 'Resalta la tarea donde más se pierde tiempo'),
    interruptor('ajustar', 'Ajustar al ancho', 'Achica el diagrama para verlo completo sin desplazarse'));
}

function leyenda() {
  const item = (muestra, texto) => h('span', { class: 'proceso-leyenda-item' }, muestra, ` ${texto}`);
  return h('p', { class: 'proceso-leyenda ayuda' },
    item(h('span', { class: 'ley ley--sin' }), 'sin historias'),
    item(h('span', { class: 'ley ley--con' }), 'con historias («2 h» = 2 historias)'),
    vista.cuello ? item(h('span', { class: 'ley ley--cuello' }), 'cuello de botella') : null,
    vista.dolores ? item(h('span', { class: 'ley-dolor is-confirmado' }, '⚠'), 'problema confirmado') : null,
    vista.dolores ? item(h('span', { class: 'ley-dolor' }, '⚠'), 'problema por confirmar') : null,
    vista.tiempos ? item(h('span', { class: 'ley-tiempo' }, '15 min · espera 1 h'), 'trabajo y espera antes de empezar') : null,
    h('span', {}, 'Toca un paso para editarlo. El orden de izquierda a derecha es el de la lista de pasos.'));
}

/** Etiqueta de una salida, junto a su primer tramo: a la derecha si baja, encima si avanza. */
function etiquetaFlecha(f) {
  const [[x1, y1], [x2]] = f.puntos;
  const baja = x1 === x2;
  return svg('text', { x: x1 + 8, y: baja ? y1 + 16 : y1 - 7, class: 'proceso-etiqueta' }, f.etiqueta);
}

/** Diagrama dibujado a partir de la lista: no se arrastra, se ordena con la lista de pasos. */
function diagrama(app, proceso) {
  const d = disposicion(proceso);
  const historiasPorId = new Map(app.proyecto.historias.map((x) => [x.id, x]));
  const vsm = flujoDeValor(proceso);
  const tiempos = new Map(proceso.pasos.map((p) => [p.id, p]));
  const resumen = proceso.pasos.map((p, i) => `${i + 1}. ${p.texto || p.tipo}`).join('; ');
  const lienzo = svg('svg', { viewBox: `0 0 ${d.ancho} ${d.alto}`, width: vista.ajustar ? null : d.ancho, height: vista.ajustar ? null : d.alto, class: `proceso-svg${vista.ajustar ? ' is-ajustado' : ''}`, role: 'img', 'aria-label': `Diagrama del proceso: ${resumen}` },
    svg('defs', {}, svg('marker', { id: 'punta', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, svg('path', { d: 'M0,0 L10,5 L0,10 z', class: 'proceso-punta' }))),
    d.carriles.map((c) => svg('g', {},
      svg('rect', { x: 0, y: c.y, width: d.ancho, height: c.alto, class: 'proceso-carril' }),
      svg('rect', { x: 0, y: c.y, width: 104, height: c.alto, class: 'proceso-carril-cabecera' }),
      (() => {
        // Nombre en varias líneas para que quepa en la cabecera (104 px)
        const ls = lineas(c.nombre, 14);
        return svg('text', { x: 52, y: c.y + c.alto / 2 - (ls.length - 1) * 7.5, class: 'proceso-carril-nombre', 'text-anchor': 'middle', 'dominant-baseline': 'middle' },
          svg('title', {}, c.nombre),
          ls.map((l, k) => svg('tspan', { x: 52, dy: k ? '1.15em' : 0 }, l)));
      })())),
    d.flechas.map((f) => svg('g', {},
      svg('polyline', { points: f.puntos.map((pt) => pt.join(',')).join(' '), class: 'proceso-flecha', 'marker-end': 'url(#punta)' }),
      f.etiqueta ? etiquetaFlecha(f) : null)),
    d.nodos.map((n) => {
      const texto = (x, y0, ancla = 'middle') => svg('text', { x, y: y0, 'text-anchor': ancla, class: 'proceso-texto' },
        n.lineas.map((l, k) => svg('tspan', { x, dy: k ? '1.15em' : 0 }, l)));
      if (n.tipo === 'tarea') {
        const paso = tiempos.get(n.id);
        const conTiempo = Number.isFinite(paso.trabajo) || Number.isFinite(paso.espera);
        const cuello = vista.cuello && n.id === vsm.cuello;
        return svg('g', { class: `proceso-nodo${n.historias ? '' : ' proceso-nodo--sin'}${cuello ? ' proceso-nodo--cuello' : ''}` },
          svg('rect', { x: n.x, y: n.y, width: n.ancho, height: n.alto, rx: 10 }),
          texto(n.cx, n.cy - (n.lineas.length - 1) * 7.5 + 4),
          n.historias ? svg('text', { x: n.x + n.ancho - 6, y: n.y + n.alto - 6, 'text-anchor': 'end', class: 'proceso-cuenta' }, `${n.historias} h`) : null,
          // Bajo la tarea: trabajo y espera, como la línea de tiempo de un VSM
          vista.tiempos && conTiempo ? svg('text', { x: n.cx, y: n.y + n.alto + 15, 'text-anchor': 'middle', class: 'proceso-tiempo' },
            `${formatoDuracion(paso.trabajo || 0)} · espera ${formatoDuracion(paso.espera || 0)}`) : null,
          cuello ? svg('text', { x: n.cx, y: n.y - 6, 'text-anchor': 'middle', class: 'proceso-cuello' }, 'Cuello de botella') : null,
          vista.dolores && (paso.dolores || []).length ? (() => {
            const conf = paso.dolores.filter((x) => x.confirmado).length;
            return svg('text', { x: n.x + 6, y: n.y + 13, class: `proceso-dolor${conf ? ' is-confirmado' : ''}` }, `⚠ ${conf || paso.dolores.length}`);
          })() : null);
      }
      if (n.tipo === 'decision') {
        const r = n.ancho / 2;
        return svg('g', { class: 'proceso-nodo proceso-nodo--decision' },
          svg('polygon', { points: `${n.cx},${n.cy - r} ${n.cx + r},${n.cy} ${n.cx},${n.cy + r} ${n.cx - r},${n.cy}` }),
          svg('text', { x: n.cx, y: n.cy + 6, 'text-anchor': 'middle', class: 'proceso-x' }, '×'),
          // Sobre el rombo y hacia la derecha: abajo salen las flechas que vuelven atrás
          // y por la izquierda entra la flecha del paso anterior
          texto(n.cx - 26, n.y - 8 - (n.lineas.length - 1) * 13.8, 'start'));
      }
      return svg('g', { class: `proceso-nodo proceso-nodo--${n.tipo}` },
        svg('circle', { cx: n.cx, cy: n.cy, r: n.ancho / 2 }),
        texto(n.cx, n.y + n.alto + 16));
    }));
  // Cada paso: tooltip con su detalle y clic (o Enter) para editarlo en la lista
  const pasos = new Map(proceso.pasos.map((x) => [x.id, x]));
  lienzo.querySelectorAll('g.proceso-nodo').forEach((g, i) => {
    const n = d.nodos[i];
    const paso = pasos.get(n.id);
    const titulo = detallePaso(paso, paso.historiaIds.map((id) => historiasPorId.get(id)).filter(Boolean));
    g.prepend(svg('title', {}, titulo));
    g.setAttribute('tabindex', '0');
    g.setAttribute('role', 'button');
    g.setAttribute('aria-label', `${titulo.split('\n')[0]}: editar`);
    g.addEventListener('click', () => abrirPaso(app, n.id));
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirPaso(app, n.id); } });
  });
  return h('figure', { class: 'proceso-figura' },
    barraDiagrama(app),
    h('div', { class: 'mapa-scroll' }, lienzo),
    h('figcaption', {}, leyenda()));
}
