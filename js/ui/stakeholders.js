// Pestaña «Stakeholders» de Cliente: la matriz poder / interés y la lista para editarla.
import { h, campo, selector, termino } from './dom.js';
import {
  ROLES_STAKEHOLDER, NIVELES, CUADRANTES_PI, stakeholdersDe, cuadranteDe, nuevoStakeholder, revisarStakeholders,
} from '../nucleo/stakeholders.js';
import { procesoDe } from '../nucleo/proceso.js';

export function vistaStakeholders(app) {
  const lista = stakeholdersDe(app.proyecto);
  const proceso = procesoDe(app.proyecto);
  const cambiar = (f) => app.cambiar((x) => ({ ...x, stakeholders: f(stakeholdersDe(x)) }));
  const carriles = { '': '—', ...Object.fromEntries(proceso.carriles.map((c) => [c.id, c.nombre])) };
  const avisos = revisarStakeholders(lista, proceso);

  // Formulario para agregar: lo mínimo para ubicar a alguien en la matriz
  const nombre = h('input', { type: 'text', maxlength: 80, placeholder: 'Ej.: Jorge Soto', required: true });
  const cargo = h('input', { type: 'text', maxlength: 80, placeholder: 'Ej.: dueño del taller' });
  const rol = selector(ROLES_STAKEHOLDER, 'aprueba');
  const poder = selector(NIVELES, 'alto');
  const interes = selector(NIVELES, 'alto');
  const carril = selector(carriles, '');
  const agregar = (e) => {
    e.preventDefault();
    if (!nombre.value.trim()) { nombre.focus(); return; }
    cambiar((l) => [...l, nuevoStakeholder({ nombre: nombre.value, cargo: cargo.value, rol: rol.value, poder: poder.value, interes: interes.value, carril: carril.value || null })]);
  };

  return h('div', { class: 'stakeholders' },
    h('p', { class: 'ayuda' }, 'Quién aprueba el presupuesto, quién opera en terreno y quién mantiene el sistema. Mapéalos desde el día 1: un sistema perfecto en el escritorio puede fracasar si quienes lo usarán no participaron. ', termino('stakeholders')),

    h('section', { class: 'panel', 'aria-labelledby': 'st-matriz' },
      h('h2', { id: 'st-matriz' }, 'Matriz poder / interés'),
      h('div', { class: 'matriz-pi', role: 'list' },
        h('span', { class: 'matriz-pi-eje matriz-pi-eje--y', 'aria-hidden': 'true' }, 'Poder ↑'),
        ['satisfacer', 'gestionar', 'monitorear', 'informar'].map((clave) => {
          const c = CUADRANTES_PI[clave];
          const aqui = lista.filter((s) => cuadranteDe(s) === clave);
          return h('div', { class: `matriz-pi-cuadrante matriz-pi-cuadrante--${clave}`, role: 'listitem' },
            h('h3', {}, c.nombre, h('span', { class: 'nav-conteo' }, String(aqui.length))),
            h('p', { class: 'ayuda' }, c.estrategia),
            aqui.length ? h('ul', {}, aqui.map((s) => h('li', {}, h('strong', {}, s.nombre), s.cargo ? ` · ${s.cargo}` : '', h('span', { class: 'tarjeta-meta' }, ` · ${ROLES_STAKEHOLDER[s.rol].toLowerCase()}`)))) : null);
        }),
        h('span', { class: 'matriz-pi-eje matriz-pi-eje--x', 'aria-hidden': 'true' }, 'Interés →'))),

    avisos.length ? h('section', { class: 'panel', 'aria-labelledby': 'st-revision' },
      h('h2', { id: 'st-revision' }, 'Lo que falta mirar'),
      h('ul', { class: 'proceso-avisos' }, avisos.map((a) => h('li', { class: 'proceso-aviso proceso-aviso--aviso' }, h('span', { class: 'chip' }, 'Revisar'), ' ', a.texto)))) : null,

    h('section', { class: 'panel', 'aria-labelledby': 'st-lista' },
      h('h2', { id: 'st-lista' }, 'Stakeholders'),
      lista.length ? h('div', { class: 'mapa-scroll' }, h('table', { class: 'tabla tabla-stakeholders' },
        h('thead', {}, h('tr', {}, ['Nombre', 'Cargo', 'Rol', 'Poder', 'Interés', 'Actor del proceso', ''].map((t) => h('th', { scope: 'col' }, t)))),
        h('tbody', {}, lista.map((s) => {
          const editar = (cambios) => cambiar((l) => l.map((x) => (x.id === s.id ? { ...x, ...cambios } : x)));
          const etiqueta = (que) => ({ 'aria-label': `${que} de ${s.nombre}` });
          return h('tr', {},
            h('td', {}, h('input', { type: 'text', value: s.nombre, maxlength: 80, ...etiqueta('Nombre'), onchange: (e) => editar({ nombre: e.target.value.trim() || s.nombre }) })),
            h('td', {}, h('input', { type: 'text', value: s.cargo, maxlength: 80, ...etiqueta('Cargo'), onchange: (e) => editar({ cargo: e.target.value.trim() }) })),
            h('td', {}, selector(ROLES_STAKEHOLDER, s.rol, { ...etiqueta('Rol'), onchange: (e) => editar({ rol: e.target.value }) })),
            h('td', {}, selector(NIVELES, s.poder, { ...etiqueta('Poder'), onchange: (e) => editar({ poder: e.target.value }) })),
            h('td', {}, selector(NIVELES, s.interes, { ...etiqueta('Interés'), onchange: (e) => editar({ interes: e.target.value }) })),
            h('td', {}, selector(carriles, s.carril || '', { ...etiqueta('Actor del proceso'), onchange: (e) => editar({ carril: e.target.value || null }) })),
            h('td', {}, h('button', {
              type: 'button', class: 'btn-texto btn-peligro',
              onclick: () => app.cambiarConDeshacer(`${s.nombre} quitado.`, (x) => ({ ...x, stakeholders: stakeholdersDe(x).filter((y) => y.id !== s.id) })),
            }, 'Quitar')));
        })))) : h('p', { class: 'ayuda' }, 'Aún no hay stakeholders. Parte por quien firma, quien lo usará cada día y quien lo mantendrá.'),

      h('form', { class: 'stakeholder-nuevo', onsubmit: agregar },
        h('div', { class: 'editor-fila' }, campo('Nombre', nombre), campo('Cargo', cargo), campo('Rol', rol)),
        h('div', { class: 'editor-fila' }, campo('Poder', poder), campo('Interés', interes), campo('Actor del proceso (opcional)', carril)),
        h('button', { type: 'submit', class: 'btn btn--secundario' }, 'Agregar stakeholder'))));
}
