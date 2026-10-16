// Inicio: qué es Copiloto PO, para quién, qué no es, sus límites, cómo empezar y cómo aportar.
import { h } from './dom.js';
import { PLANTILLAS } from '../nucleo/plantillas.js';

export const PRODUCTOWNER = 'https://productowner.cl';

export function vistaBienvenida(app) {
  const camino = (titulo, texto, accion, etiqueta, principal = false) => h('li', { class: 'camino' },
    h('h3', {}, titulo), h('p', {}, texto),
    h('button', { type: 'button', class: principal ? 'btn btn--cobre' : 'btn btn--secundario', onclick: accion }, etiqueta));

  return h('div', { class: 'vista bienvenida' },
    h('header', { class: 'bienvenida-hero' },
      h('p', { class: 'eyebrow' }, 'Versión inicial · libre y gratuita (MIT)'),
      h('h1', {}, 'Del audio desordenado del cliente a la entrega aceptada.'),
      h('p', { class: 'bajada' }, 'Copiloto PO es una herramienta para Product Owners y profesionales TI independientes: convierte tus notas en historias claras, te ayuda a acordar alcance y precio con tu cliente, a ordenar el trabajo y a mostrar avance. Sin cuentas, sin servidor y con tus datos en tu equipo.')),

    h('section', { 'aria-labelledby': 'bv-empezar' },
      h('h2', { id: 'bv-empezar' }, '¿Cómo quieres empezar?'),
      h('ol', { class: 'caminos' },
        camino('Mirar un ejemplo', 'Un proyecto real armado de punta a punta: la tienda en línea de una pastelería, con propuesta, hitos, sprints y un bloqueo.', async () => { await app.cargarEjemplo(); app.iniciarRecorrido(); }, 'Ver el ejemplo con un recorrido', true),
        camino('Pegar mis notas', 'Lo que te pidió tu cliente, tal cual. Lo convertimos en historias de usuario y te decimos qué les falta.', () => app.ir('notas'), 'Ir a mis notas'),
        camino('Partir de una plantilla', `Para proyectos típicos: ${Object.values(PLANTILLAS).map((p) => p.nombre).join(', ')}.`, () => app.ir('cliente'), 'Elegir una plantilla'))),

    h('div', { class: 'bienvenida-columnas' },
      h('section', { class: 'panel', 'aria-labelledby': 'bv-es' },
        h('h2', { id: 'bv-es' }, 'Qué es'),
        h('ul', { class: 'lista-check' },
          h('li', {}, 'Una ayuda para pensar, escribir y ordenar el trabajo de un proyecto.'),
          h('li', {}, 'Documentos listos para tu cliente: propuesta, hitos, actas, informe de avance.'),
          h('li', {}, 'Una forma de aprender buenas prácticas (Scrum, historias, estimación) mientras trabajas.'),
          h('li', {}, 'Código abierto: puedes usarlo, cambiarlo y compartirlo.'))),
      h('section', { class: 'panel', 'aria-labelledby': 'bv-no' },
        h('h2', { id: 'bv-no' }, 'Qué no es'),
        h('ul', { class: 'lista-no' },
          h('li', {}, 'No es Jira ni reemplaza una herramienta corporativa para equipos grandes.'),
          h('li', {}, 'No es un servicio en línea: no guarda tus datos en ningún servidor ni los ve nadie.'),
          h('li', {}, 'No es asesoría legal ni contable: los documentos son borradores para revisar.'),
          h('li', {}, 'No busca clientes por ti: para eso está la comunidad de ProductOwner.cl.')))),

    h('section', { class: 'panel', 'aria-labelledby': 'bv-limites' },
      h('h2', { id: 'bv-limites' }, 'Límites que conviene saber'),
      h('ul', {},
        h('li', {}, h('strong', {}, 'Tus datos viven en este navegador. '), 'Si limpias el navegador o cambias de equipo se pierden: descarga un respaldo de vez en cuando (Ajustes).'),
        h('li', {}, h('strong', {}, 'Es para una persona o una pantalla compartida. '), 'No sincroniza entre varias personas; para pasar un proyecto, usa el respaldo.'),
        h('li', {}, h('strong', {}, 'La IA es opcional y tuya. '), 'Sin IA funciona completo; si conectas una, tus notas van solo a ese servicio.'),
        h('li', {}, h('strong', {}, 'Es una versión inicial. '), 'Puede tener errores y cambiar según lo que nos cuenten quienes lo usen.'))),

    h('div', { class: 'bienvenida-columnas' },
      h('section', { class: 'panel invitacion', 'aria-labelledby': 'bv-aporta' },
        h('h2', { id: 'bv-aporta' }, 'Pruébalo y cuéntanos'),
        h('p', {}, 'Esto es un proyecto abierto: crece con lo que aportan quienes lo usan. Si algo te sirvió, te sobró o te faltó, nos ayuda muchísimo saberlo. Son 2 minutos.'),
        h('button', { type: 'button', class: 'btn', onclick: () => app.ir('comentar') }, 'Dejar un comentario')),
      h('section', { class: 'panel invitacion invitacion--comunidad', 'aria-labelledby': 'bv-comunidad' },
        h('h2', { id: 'bv-comunidad' }, '¿Buscas clientes o profesionales?'),
        h('p', {}, 'Copiloto PO te ayuda a ordenar el trabajo; ProductOwner.cl te ayuda a encontrarlo. Es una plataforma gratuita que conecta a profesionales TI independientes con clientes en Chile: publica tu perfil o el proyecto que necesitas.'),
        h('a', { class: 'btn btn--secundario', href: PRODUCTOWNER, rel: 'noopener', target: '_blank' }, 'Conocer ProductOwner.cl'))),

    h('section', { class: 'panel', 'aria-labelledby': 'bv-modo' },
      h('h2', { id: 'bv-modo' }, 'A tu medida'),
      h('label', { class: 'opcion' },
        h('input', { type: 'checkbox', checked: app.modoSimple, onchange: (e) => app.cambiarModoSimple(e.target.checked) }),
        h('span', {}, h('strong', {}, 'Modo simple: '), 'muestra solo lo esencial (Notas, Backlog, Cliente y Sprint). Desactívalo para ver priorización, mapa de historias, estimación en equipo, retrospectiva y taller.')),
      app.cajasCerradas.size ? h('p', {}, h('button', { type: 'button', class: 'btn-texto', onclick: () => app.reabrirCajas() }, 'Volver a mostrar las cajas de ayuda')) : null,
      h('p', {}, h('button', { type: 'button', class: 'btn-texto', onclick: () => { app.iniciarRecorrido(); } }, 'Hacer el recorrido de 4 pasos con mi proyecto'))));
}
