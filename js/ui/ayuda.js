// Ayudas: cajas informativas que se pueden cerrar, el recorrido introductorio y el aviso del proyecto de ejemplo.
import { h } from './dom.js';

/** Caja "¿Para qué sirve esta sección?". Se cierra y no vuelve a aparecer (se puede reabrir desde Inicio). */
export function cajaInfo(app, clave, titulo, ...contenido) {
  if (app.cajasCerradas.has(clave)) return null;
  return h('aside', { class: 'caja-info', 'aria-label': titulo },
    h('div', {}, h('strong', {}, titulo), h('div', { class: 'caja-info-texto' }, contenido)),
    h('button', { type: 'button', class: 'icono', 'aria-label': `Cerrar: ${titulo}`, title: 'No volver a mostrar', onclick: () => app.cerrarCaja(clave) }, '×'));
}

export const PASOS_RECORRIDO = [
  { vista: 'notas', titulo: 'Paso 1 de 4 · Del caos a las historias', texto: 'Pega lo que te pidió el cliente (una minuta, un audio transcrito, un correo) y presiona "Convertir en historias". Revisa las propuestas y agrégalas al backlog.' },
  { vista: 'backlog', titulo: 'Paso 2 de 4 · Ordena y mejora', texto: 'Arriba va lo más importante. Abre una historia para ver qué le falta (la etiqueta "Revisar" o "Mejorar"), agrega casos borde y estima. En "Roadmap" ves qué viene y cuándo.' },
  { vista: 'cliente', titulo: 'Paso 3 de 4 · Acuerda con tu cliente', texto: 'Define qué incluye y qué NO, cotiza en UF o pesos y propone hitos de pago. Descarga la propuesta y, al entregar, el acta de aceptación de cada hito.' },
  { vista: 'sprint', titulo: 'Paso 4 de 4 · Trabaja y muestra avance', texto: 'Planifica un sprint, mueve las tarjetas y, cuando corresponda, envía el informe para el cliente. Al cerrar, haz la retrospectiva. ¡Eso es todo! Y cuéntanos qué te pareció en "Comentar".' },
];

/** Caja del recorrido, arriba de la vista que corresponde al paso actual. */
export function cajaRecorrido(app) {
  if (app.recorrido === null) return null;
  const paso = PASOS_RECORRIDO[app.recorrido];
  if (!paso || paso.vista !== app.vista) return null;
  const ultimo = app.recorrido === PASOS_RECORRIDO.length - 1;
  return h('aside', { class: 'recorrido', 'aria-label': 'Recorrido introductorio' },
    h('p', { class: 'eyebrow' }, paso.titulo),
    h('p', {}, paso.texto),
    h('div', { class: 'acciones' },
      h('button', {
        type: 'button', class: 'btn',
        onclick: () => {
          if (ultimo) { app.terminarRecorrido(); app.ir('comentar'); return; }
          app.recorrido += 1;
          app.ir(PASOS_RECORRIDO[app.recorrido].vista);
        },
      }, ultimo ? 'Terminar y comentar' : 'Siguiente paso →'),
      h('button', { type: 'button', class: 'btn-texto', onclick: () => app.terminarRecorrido() }, 'Salir del recorrido')));
}

/** Aviso permanente mientras se mira el proyecto de ejemplo. */
export function avisoEjemplo(app) {
  if (app.proyecto.id !== 'ejemplo-pasteleria') return null;
  return h('aside', { class: 'aviso-ejemplo', 'aria-label': 'Proyecto de ejemplo' },
    h('p', {}, h('strong', {}, 'Estás viendo un ejemplo. '),
      'Carla tiene una pastelería en Ñuñoa y quiere vender en línea. Un PO independiente levantó sus necesidades, le cotizó en UF con tres hitos de pago y ya va en el tercer sprint: hay un ítem bloqueado, una solicitud de cambio y una retrospectiva. Explóralo y cámbialo sin miedo: no afecta tus proyectos.'),
    h('div', { class: 'acciones' },
      h('button', { type: 'button', class: 'btn-texto', onclick: () => app.ir('inicio') }, 'Volver al inicio'),
      h('button', {
        type: 'button', class: 'btn-texto',
        onclick: async () => {
          if (!confirm('¿Eliminar el proyecto de ejemplo? Puedes volver a cargarlo desde Inicio.')) return;
          await app.borrarProyectoActual();
        },
      }, 'Eliminar el ejemplo')));
}
