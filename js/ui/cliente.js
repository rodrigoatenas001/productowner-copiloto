// Cliente: lo comercial del PO independiente. Alcance, cotización, hitos de pago y cambios.
import { h, campo, selector, pedirTexto } from './dom.js';
import { botonesMarkdown } from './compartir.js';
import { PLANTILLAS } from '../nucleo/plantillas.js';
import {
  alcanceDe, aplicarPlantilla, comercialDe, cotizacion, formatoMonto, sugerirHitos, revisarHitos, montoHito, hitoListo,
  aceptarHito, registrarCambio, impactoCambio, aprobarCambio, rechazarCambio,
} from '../nucleo/comercial.js';
import { propuestaAlcance, actaAceptacion, respuestaCambio, detalleHoras } from '../nucleo/documentos.js';

let pestana = 'alcance';

const PESTANAS = { alcance: 'Alcance', cotizacion: 'Cotización', hitos: 'Hitos de pago', cambios: 'Cambios' };

export function vistaCliente(app) {
  return h('div', { class: 'vista' },
    h('header', { class: 'vista-cabecera' },
      h('p', { class: 'eyebrow' }, app.proyecto.nombre),
      h('h1', {}, 'Cliente'),
      h('p', { class: 'bajada' }, 'Lo que acuerdas con tu cliente: qué incluye y qué no, cuánto cuesta, cómo se paga y qué pasa cuando pide cambios. Todo queda aquí y se comparte como documento.')),
    h('div', { class: 'pestanas', role: 'tablist', 'aria-label': 'Secciones del cliente' },
      Object.entries(PESTANAS).map(([clave, texto]) => h('button', {
        type: 'button', role: 'tab', class: 'pestana', 'aria-selected': String(pestana === clave),
        onclick: () => { pestana = clave; app.render(); },
      }, texto))),
    { alcance, cotizacion: vistaCotizacion, hitos, cambios }[pestana](app),
    h('p', { class: 'ayuda aviso-legal' }, 'Los documentos son borradores para revisar y adaptar: no reemplazan un contrato ni asesoría legal.'));
}

/** Lista editable de textos (un ítem por línea). */
function listaEditable(app, clave, etiqueta, ayuda, ejemplo) {
  const a = alcanceDe(app.proyecto);
  return campo(etiqueta, h('textarea', {
    rows: 4, placeholder: ejemplo,
    onchange: (e) => {
      const valores = [...new Set(e.target.value.split('\n').map((x) => x.replace(/^\s*[-*•]\s*/, '').trim()).filter(Boolean))].slice(0, 30);
      app.cambiar((x) => ({ ...x, alcance: { ...alcanceDe(x), [clave]: valores } }), { redibujar: false });
    },
  }, a[clave].join('\n')), ayuda);
}

function alcance(app) {
  const enAlcance = app.proyecto.historias.filter((x) => x.prioridad !== 'wont').length;
  const plantilla = selector({ '': 'Elige un tipo de proyecto…', ...Object.fromEntries(Object.entries(PLANTILLAS).map(([k, v]) => [k, `${v.nombre} · ${v.descripcion}`])) }, '', { 'aria-label': 'Plantilla por tipo de proyecto' });
  return h('div', {},
    h('section', { class: 'panel', 'aria-labelledby': 'cl-plantilla' },
      h('h2', { id: 'cl-plantilla' }, 'Partir de una plantilla'),
      h('p', { class: 'ayuda' }, 'Agrega historias de partida y lo típico que no se incluye, los supuestos y lo que el cliente debe entregar. Después ajústalo a tu caso.'),
      h('div', { class: 'fila-accion fila-accion--dos' }, plantilla,
        h('button', {
          type: 'button', class: 'btn btn--secundario',
          onclick: () => {
            if (!plantilla.value) return;
            app.cambiarConDeshacer(`Plantilla "${PLANTILLAS[plantilla.value].nombre}" aplicada.`, (x) => aplicarPlantilla(x, plantilla.value));
          },
        }, 'Aplicar'))),
    h('section', { class: 'panel', 'aria-labelledby': 'cl-alcance' },
      h('h2', { id: 'cl-alcance' }, 'Alcance acordado'),
      h('p', {}, `Incluye las ${enAlcance} historias del backlog (salvo las marcadas "Esta vez no"). Agrega aquí lo que no sea una historia.`),
      listaEditable(app, 'incluye', 'También incluye', 'Por ejemplo: capacitación, documentación, garantía.', 'Una capacitación de 1 hora al equipo'),
      listaEditable(app, 'noIncluye', 'Qué NO incluye', 'Tu escudo contra el "ya que estás…": sé explícito.', 'Fotografía de productos'),
      listaEditable(app, 'supuestos', 'Supuestos', 'Lo que das por hecho; si cambia, cambia la cotización.', 'Hasta 50 productos en la carga inicial'),
      listaEditable(app, 'cliente', 'Lo que el cliente debe entregar', 'Con fecha, idealmente: los retrasos del cliente mueven la entrega.', 'Textos e imágenes finales')),
    h('div', { class: 'compartir' }, botonesMarkdown(app, 'Propuesta de alcance y cotización', 'propuesta', () => propuestaAlcance(app.proyecto))));
}

function vistaCotizacion(app) {
  const c = comercialDe(app.proyecto);
  const cot = cotizacion(app.proyecto);
  const guardar = (cambios) => app.cambiar((x) => ({ ...x, comercial: { ...comercialDe(x), ...cambios } }));
  const numero = (clave, etiqueta, ayuda, atributos = {}) => campo(etiqueta, h('input', {
    type: 'number', value: c[clave] ?? '', ...atributos,
    onchange: (e) => guardar({ [clave]: e.target.value === '' ? null : Number(e.target.value) }),
  }), ayuda);
  const horasManual = (hist) => h('input', {
    type: 'number', min: 0, step: 0.5, value: hist.manual ? hist.horas : '', class: 'input-corto',
    placeholder: hist.manual ? '' : 'auto', 'aria-label': `Horas de ${hist.titulo}`,
    onchange: (e) => app.cambiar((x) => ({ ...x, historias: x.historias.map((y) => (y.id === hist.id ? { ...y, horas: e.target.value ? Number(e.target.value) : null } : y)) })),
  });

  return h('div', {},
    h('section', { class: 'panel', 'aria-labelledby': 'cl-valores' },
      h('h2', { id: 'cl-valores' }, 'Valores'),
      h('div', { class: 'editor-fila' },
        campo('Moneda', selector({ UF: 'UF', CLP: 'Pesos (CLP)' }, c.moneda, { onchange: (e) => guardar({ moneda: e.target.value }) })),
        numero('valorHora', `Valor hora (${c.moneda})`, null, { min: 0, step: c.moneda === 'UF' ? 0.01 : 1000 }),
        numero('horasPorPunto', 'Horas por punto', 'Para estimar con los puntos; o escribe horas por ítem abajo.', { min: 0.5, max: 200, step: 0.5 }),
        numero('margen', 'Imprevistos (%)', 'Entre 15 y 20% es lo habitual.', { min: 0, max: 100 }),
        c.moneda === 'UF' ? numero('valorUF', 'Valor UF (CLP)', 'Opcional: para mostrar el equivalente en pesos.', { min: 1 }) : null,
        numero('horasSemana', 'Horas por semana', 'Tu dedicación al proyecto; se usa para el plazo de los cambios.', { min: 1, max: 168 }))),
    h('dl', { class: 'cifras' },
      h('div', { class: 'cifra' }, h('dt', {}, 'Horas'), h('dd', {}, `${cot.horas.toLocaleString('es-CL')} h`)),
      h('div', { class: 'cifra' }, h('dt', {}, 'Subtotal'), h('dd', {}, formatoMonto(cot.subtotal, c.moneda))),
      h('div', { class: 'cifra' }, h('dt', {}, 'Imprevistos'), h('dd', {}, formatoMonto(cot.margen, c.moneda))),
      h('div', { class: 'cifra' }, h('dt', {}, 'Total'), h('dd', {}, formatoMonto(cot.total, c.moneda), cot.totalCLP ? h('small', {}, ` ≈ $${cot.totalCLP.toLocaleString('es-CL')}`) : null))),
    cot.sinEstimar ? h('p', { class: 'invest--aviso aviso-suelto' }, `${cot.sinEstimar} ${cot.sinEstimar === 1 ? 'ítem no tiene' : 'ítems no tienen'} horas ni puntos y no ${cot.sinEstimar === 1 ? 'suma' : 'suman'} al total.`) : null,
    h('section', { class: 'panel', 'aria-labelledby': 'cl-horas' },
      h('h2', { id: 'cl-horas' }, 'Horas por ítem'),
      h('div', { class: 'tabla-scroll' }, h('table', { class: 'tabla' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Ítem'), h('th', {}, 'Horas estimadas'), h('th', {}, 'Horas a mano'))),
        h('tbody', {}, detalleHoras(app.proyecto).map((x) => h('tr', {},
          h('td', {}, x.titulo),
          h('td', {}, x.horas === null ? '—' : `${x.horas} h${x.manual ? '' : ' (por puntos)'}`),
          h('td', {}, horasManual(x)))))))),
    h('div', { class: 'compartir' }, botonesMarkdown(app, 'Propuesta de alcance y cotización', 'propuesta', () => propuestaAlcance(app.proyecto))));
}

function hitos(app) {
  const p = app.proyecto;
  const lista = p.hitos || [];
  const c = comercialDe(p);
  const problemas = revisarHitos(p);
  const editarHito = (id, cambios) => app.cambiar((x) => ({ ...x, hitos: x.hitos.map((y) => (y.id === id ? { ...y, ...cambios } : y)) }), { redibujar: false });
  const sugerir = (n) => {
    try { app.cambiarConDeshacer(`Propuesta de ${n} hitos lista.`, (x) => ({ ...x, hitos: sugerirHitos(x, n) })); } catch (e) { app.avisar(e.message, 'error'); }
  };

  return h('div', {},
    h('section', { class: 'panel', 'aria-labelledby': 'cl-hitos' },
      h('h2', { id: 'cl-hitos' }, 'Hitos de pago'),
      h('p', { class: 'ayuda' }, 'Tu cliente entiende entregables y pagos, no puntos ni sprints. Agrupa el alcance en 2 a 4 hitos que se puedan revisar y aceptar.'),
      h('div', { class: 'acciones' }, [2, 3, 4].map((n) => h('button', { type: 'button', class: 'btn btn--secundario', onclick: () => sugerir(n) }, `Proponer ${n} hitos`))),
      problemas.length ? h('ul', { class: 'invest' }, problemas.map((t) => h('li', { class: 'invest--aviso' }, t))) : null),
    lista.length ? h('ol', { class: 'lista-hitos' }, lista.map((hito) => {
      const hs = p.historias.filter((x) => hito.historiaIds.includes(x.id));
      const listo = hitoListo(p, hito);
      return h('li', { class: `panel hito hito--${hito.estado}` },
        h('div', { class: 'editor-fila' },
          campo('Nombre', h('input', { type: 'text', value: hito.nombre, maxlength: 120, onchange: (e) => editarHito(hito.id, { nombre: e.target.value.trim() || hito.nombre }) })),
          campo('Porcentaje', h('input', { type: 'number', min: 0, max: 100, value: hito.porcentaje, onchange: (e) => { editarHito(hito.id, { porcentaje: Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0))) }); app.render(); } })),
          campo('Fecha de entrega', h('input', { type: 'date', value: hito.fecha, onchange: (e) => editarHito(hito.id, { fecha: e.target.value }) }))),
        h('p', { class: 'tarjeta-meta' }, `Monto: ${formatoMonto(montoHito(p, hito), c.moneda)} · ${hs.length} entregables`,
          hito.estado === 'aceptado' ? h('span', { class: 'chip chip--ok' }, ` aceptado por ${hito.aceptacion.nombre}`) : listo ? h('span', { class: 'chip chip--ok' }, ' listo para entregar') : null),
        h('ul', { class: 'entregables' }, hs.map((x) => h('li', { class: x.estado === 'done' ? 'is-hecha' : '' }, x.titulo))),
        h('div', { class: 'compartir' },
          botonesMarkdown(app, 'Acta de aceptación', `acta-${hito.nombre}`, () => actaAceptacion(app.proyecto, hito.id)),
          hito.estado !== 'aceptado' ? h('button', {
            type: 'button', class: 'btn-texto',
            onclick: async () => {
              const nombre = await pedirTexto('¿Quién acepta este hito por parte del cliente?', { aceptar: 'Registrar aceptación', placeholder: 'Nombre y cargo' });
              if (nombre === null) return;
              try { app.cambiarConDeshacer(`${hito.nombre} aceptado.`, (x) => aceptarHito(x, hito.id, { nombre })); } catch (e) { app.avisar(e.message, 'error'); }
            },
          }, 'Registrar aceptación') : null));
    })) : h('p', { class: 'vacio' }, 'Aún no hay hitos. Propón 2, 3 o 4 a partir del alcance.'));
}

function cambios(app) {
  const p = app.proyecto;
  const lista = [...(p.cambios || [])].reverse();
  const c = comercialDe(p);
  const descripcion = h('textarea', { rows: 3, placeholder: 'Lo que pidió el cliente, con sus palabras. Ej.: agregar un blog de recetas.', 'aria-label': 'Solicitud del cliente', maxlength: 2000 });
  const horas = h('input', { type: 'number', min: 0, step: 0.5, placeholder: 'Horas', 'aria-label': 'Horas estimadas del cambio', class: 'input-corto' });
  const ESTADOS = { propuesto: 'Por responder', aprobado: 'Aprobado', rechazado: 'Rechazado' };

  return h('div', {},
    h('section', { class: 'panel', 'aria-labelledby': 'cl-cambio' },
      h('h2', { id: 'cl-cambio' }, 'Nueva solicitud de cambio'),
      h('p', { class: 'ayuda' }, 'Cuando el cliente pide algo que no estaba en el alcance, regístralo aquí: se calcula su impacto y te queda una respuesta lista para enviar.'),
      descripcion,
      h('div', { class: 'acciones' }, horas,
        h('button', {
          type: 'button', class: 'btn',
          onclick: () => {
            try { app.cambiar((x) => registrarCambio(x, descripcion.value, horas.value)); } catch (e) { app.avisar(e.message, 'error'); }
          },
        }, 'Registrar y calcular impacto'))),
    lista.length ? h('ol', { class: 'lista-hitos' }, lista.map((cambio) => {
      const im = impactoCambio(p, cambio);
      return h('li', { class: `panel cambio cambio--${cambio.estado}` },
        h('div', { class: 'epica-cabecera' }, h('strong', {}, cambio.descripcion.split('\n')[0].slice(0, 120)), h('span', { class: `chip${cambio.estado === 'aprobado' ? ' chip--ok' : cambio.estado === 'propuesto' ? ' chip--aviso' : ''}` }, ESTADOS[cambio.estado])),
        h('p', { class: 'tarjeta-meta' }, `${cambio.fecha.split('-').reverse().join('-')} · ${im.horas ? `${im.horas} h` : 'sin estimar'} · ${formatoMonto(im.valor, c.moneda)}${im.dias ? ` · mueve la entrega ~${im.dias} días` : ''}`),
        h('div', { class: 'compartir' },
          botonesMarkdown(app, 'Respuesta al cliente', `cambio-${cambio.fecha}`, () => respuestaCambio(app.proyecto, cambio.id)),
          cambio.estado === 'propuesto' ? h('button', {
            type: 'button', class: 'btn-texto',
            onclick: () => app.cambiarConDeshacer('Cambio aprobado: entró al backlog y a la cotización.', (x) => aprobarCambio(x, cambio.id)),
          }, 'El cliente aprobó') : null,
          cambio.estado === 'propuesto' ? h('button', { type: 'button', class: 'btn-texto', onclick: () => app.cambiar((x) => rechazarCambio(x, cambio.id)) }, 'No se hará') : null));
    })) : null);
}
