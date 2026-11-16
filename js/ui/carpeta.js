// Carpeta sincronizada: los proyectos se guardan también como archivos en una carpeta que elige la persona
// (por ejemplo, dentro de OneDrive o Google Drive), y su nube los lleva a sus otros equipos.
// Usa la File System Access API: Chrome y Edge de escritorio. En los demás navegadores sigue el respaldo manual.
import { h, avisar, confirmar } from './dom.js';
import { leerAjuste, guardarAjuste, guardarProyecto, MODO_PRUEBA } from '../almacen.js';
import {
  leerCarpeta, planificar, escribirProyecto, cambioEnCarpeta, copiarAPapelera, moverAPapelera, ID_EJEMPLO,
} from '../nucleo/carpeta.js';

const estado = {
  carpeta: null, // FileSystemDirectoryHandle
  permiso: 'sin carpeta', // 'granted' | 'prompt' | 'denied' | 'sin carpeta'
  marcas: {}, // id del proyecto → { archivo, modificado, local }
  invalidos: [],
  ultima: null, // fecha de la última sincronización
  ocupado: false,
};

export const carpetaSoportada = () => typeof window !== 'undefined' && 'showDirectoryPicker' in window && !MODO_PRUEBA;
export const carpetaLista = () => Boolean(estado.carpeta) && estado.permiso === 'granted';
export const nombreCarpeta = () => estado.carpeta?.name || '';

const guardarMarcas = () => guardarAjuste('carpetaMarcas', estado.marcas);
const hora = (iso) => (iso ? new Date(iso).toLocaleString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'sin fecha');

/** Al abrir la app: recupera la carpeta. Si el navegador ya dio permiso, sincroniza; si no, se pide con un clic. */
export async function iniciarCarpeta(app) {
  if (!carpetaSoportada()) return;
  estado.carpeta = (await leerAjuste('carpeta')) || null;
  estado.marcas = (await leerAjuste('carpetaMarcas')) || {};
  if (!estado.carpeta) return;
  try {
    estado.permiso = await estado.carpeta.queryPermission({ mode: 'readwrite' });
  } catch {
    estado.permiso = 'denied';
  }
  if (estado.permiso === 'granted') await sincronizar(app);
  else app.render();
}

export async function vincularCarpeta(app) {
  let carpeta;
  try {
    carpeta = await window.showDirectoryPicker({ id: 'copiloto-po', mode: 'readwrite', startIn: 'documents' });
  } catch (e) {
    if (e.name !== 'AbortError') avisar(`No se pudo abrir la carpeta: ${e.message}`, 'error');
    return;
  }
  estado.carpeta = carpeta;
  estado.permiso = 'granted';
  estado.marcas = {};
  await guardarAjuste('carpeta', carpeta);
  await guardarMarcas();
  await sincronizar(app, { anunciar: true });
}

/** El navegador pide confirmar el acceso en cada sesión: necesita un clic de la persona. */
export async function reconectarCarpeta(app) {
  try {
    estado.permiso = await estado.carpeta.requestPermission({ mode: 'readwrite' });
  } catch {
    estado.permiso = 'denied';
  }
  if (estado.permiso === 'granted') await sincronizar(app, { anunciar: true });
  else { avisar('Sin acceso a la carpeta: los cambios quedan solo en este navegador.', 'error'); app.render(); }
}

export async function desvincularCarpeta(app) {
  const ok = await confirmar(`¿Dejar de usar la carpeta «${nombreCarpeta()}»?`, {
    detalle: 'Los archivos quedan en la carpeta, sin cambios. Desde ahora los proyectos se guardan solo en este navegador.',
    aceptar: 'Dejar de usarla',
  });
  if (!ok) return;
  Object.assign(estado, { carpeta: null, permiso: 'sin carpeta', marcas: {}, invalidos: [], ultima: null });
  await guardarAjuste('carpeta', null);
  await guardarMarcas();
  app.render();
}

/** Deja el proyecto que llegó de la carpeta en el navegador y en la app, sin contarlo como un cambio de aquí. */
async function traer(app, enCarpeta) {
  const p = enCarpeta.proyecto;
  await guardarProyecto(p, { conservarFecha: true });
  const i = app.proyectos.findIndex((x) => x.id === p.id);
  if (i >= 0) app.proyectos[i] = p; else app.proyectos.push(p);
  if (app.proyecto?.id === p.id) app.proyecto = p;
  estado.marcas[p.id] = { archivo: enCarpeta.archivo, modificado: enCarpeta.modificado, local: p.actualizado };
}

async function escribir(proyecto) {
  estado.marcas[proyecto.id] = await escribirProyecto(estado.carpeta, proyecto, estado.marcas[proyecto.id]);
}

/** Cambió aquí y en otro equipo: la persona elige; la versión que no elige queda como copia en la papelera. */
async function resolverConflicto(app, local, enCarpeta) {
  const usarOtro = await confirmar(`«${local.nombre}» cambió en este equipo y en otro.`, {
    detalle: `Último cambio aquí: ${hora(local.actualizado)} · en la carpeta: ${hora(enCarpeta.proyecto.actualizado)}. La versión que no elijas queda como copia en la carpeta «papelera».`,
    aceptar: 'Usar la de la carpeta',
    cancelar: 'Conservar la de este equipo',
  });
  if (usarOtro) {
    await copiarAPapelera(estado.carpeta, local, 'este-equipo');
    await traer(app, enCarpeta);
  } else {
    await copiarAPapelera(estado.carpeta, enCarpeta.proyecto, 'otro-equipo');
    await escribir(local);
  }
}

/** Compara el navegador con la carpeta y deja los dos iguales. */
export async function sincronizar(app, { anunciar = false } = {}) {
  if (!carpetaLista() || estado.ocupado) return;
  estado.ocupado = true;
  try {
    const { proyectos, invalidos } = await leerCarpeta(estado.carpeta);
    const nuevosInvalidos = invalidos.filter((x) => !estado.invalidos.includes(x));
    estado.invalidos = invalidos;
    let traidos = 0;
    let escritos = 0;
    for (const accion of planificar(app.proyectos, proyectos, estado.marcas)) {
      if (accion.tipo === 'traer') { await traer(app, accion.enCarpeta); traidos += 1; }
      if (accion.tipo === 'escribir') { await escribir(accion.local); escritos += 1; }
      if (accion.tipo === 'marcar') estado.marcas[accion.id] = { archivo: accion.enCarpeta.archivo, modificado: accion.enCarpeta.modificado, local: accion.local.actualizado };
      if (accion.tipo === 'conflicto') await resolverConflicto(app, accion.local, accion.enCarpeta);
    }
    await guardarMarcas();
    estado.ultima = new Date().toISOString();
    if (nuevosInvalidos.length) avisar(`En la carpeta hay ${nuevosInvalidos.length === 1 ? 'un archivo que no es' : `${nuevosInvalidos.length} archivos que no son`} un proyecto válido: ${nuevosInvalidos.join(', ')}. No se tocaron.`, 'error');
    if (anunciar) avisar(`Carpeta «${nombreCarpeta()}» al día${traidos ? `: ${traidos} ${traidos === 1 ? 'proyecto traído' : 'proyectos traídos'}` : ''}${escritos ? `${traidos ? ',' : ':'} ${escritos} ${escritos === 1 ? 'guardado' : 'guardados'}` : ''}.`);
  } catch (e) {
    if (e.name === 'NotAllowedError') estado.permiso = 'prompt';
    avisar(`No se pudo sincronizar con la carpeta: ${e.message}`, 'error');
  } finally {
    estado.ocupado = false;
    app.render();
  }
}

/** Después de cada guardado local: escribe el archivo, salvo que otro equipo lo haya cambiado entretanto. */
export async function alGuardarEnCarpeta(app, proyecto) {
  if (!carpetaLista() || estado.ocupado || proyecto.id === ID_EJEMPLO) return;
  try {
    if (await cambioEnCarpeta(estado.carpeta, estado.marcas[proyecto.id])) {
      await sincronizar(app); // detecta el conflicto y pregunta
      return;
    }
    await escribir(proyecto);
    await guardarMarcas();
  } catch (e) {
    if (e.name === 'NotAllowedError') { estado.permiso = 'prompt'; app.render(); return; }
    avisar(`No se pudo guardar en la carpeta: ${e.message}. El cambio quedó en este navegador.`, 'error');
  }
}

/** Proyecto borrado: su archivo pasa a la papelera de la carpeta. */
export async function alBorrarEnCarpeta(id) {
  if (!carpetaLista()) return;
  try {
    await moverAPapelera(estado.carpeta, estado.marcas[id]);
    delete estado.marcas[id];
    await guardarMarcas();
  } catch (e) {
    avisar(`No se pudo mover el archivo a la papelera: ${e.message}`, 'error');
  }
}

/** Aviso arriba de cada vista cuando la carpeta necesita que la persona confirme el acceso. */
export function avisoCarpeta(app) {
  if (!estado.carpeta || estado.permiso === 'granted') return null;
  return h('aside', { class: 'recordatorio', 'aria-label': 'Carpeta sincronizada' },
    h('p', {}, h('strong', {}, `Tus proyectos se guardan en «${nombreCarpeta()}». `),
      'El navegador pide confirmar el acceso cada vez que abres el copiloto. Mientras tanto, los cambios quedan solo aquí.'),
    h('div', { class: 'acciones' },
      h('button', { type: 'button', class: 'btn', onclick: () => reconectarCarpeta(app) }, 'Dar acceso a la carpeta')));
}

/** Sección de Ajustes. */
export function seccionCarpeta(app) {
  const cuerpo = !carpetaSoportada()
    ? [h('p', { class: 'ayuda' }, 'Este navegador no permite guardar en una carpeta. Funciona en Chrome y Edge de escritorio. Aquí usa el respaldo: descárgalo y ábrelo en el otro equipo.')]
    : !estado.carpeta
      ? [
        h('p', { class: 'ayuda' }, 'Elige una carpeta que tu nube sincronice (OneDrive, Google Drive o Dropbox). Cada proyecto queda como un archivo; en tu otro equipo eliges la misma carpeta y aparecen todos. Sin servidor ni cuentas: tus archivos van solo a tu nube.'),
        h('div', { class: 'acciones' }, h('button', { type: 'button', class: 'btn', onclick: () => vincularCarpeta(app) }, 'Elegir carpeta')),
      ]
      : [
        h('p', {}, h('strong', {}, `Carpeta: «${nombreCarpeta()}». `),
          estado.permiso === 'granted'
            ? `Cada cambio se guarda también ahí${estado.ultima ? ` (última revisión: ${hora(estado.ultima)})` : ''}.`
            : 'Falta confirmar el acceso en esta sesión.'),
        estado.invalidos.length ? h('p', { class: 'ayuda' }, `Archivos que no son proyectos (no se tocan): ${estado.invalidos.join(', ')}.`) : null,
        h('div', { class: 'acciones' },
          estado.permiso === 'granted'
            ? h('button', { type: 'button', class: 'btn btn--secundario', onclick: () => sincronizar(app, { anunciar: true }) }, 'Revisar ahora')
            : h('button', { type: 'button', class: 'btn', onclick: () => reconectarCarpeta(app) }, 'Dar acceso a la carpeta'),
          h('button', { type: 'button', class: 'btn btn--secundario', onclick: () => vincularCarpeta(app) }, 'Cambiar de carpeta'),
          h('button', { type: 'button', class: 'btn-texto', onclick: () => desvincularCarpeta(app) }, 'Dejar de usarla')),
        h('p', { class: 'ayuda' }, 'Si editas el mismo proyecto en dos equipos antes de que la nube los iguale, el copiloto te pregunta cuál conservar; la otra versión queda en la carpeta «papelera». Los proyectos que borras también van ahí. El proyecto de ejemplo no se guarda en la carpeta.'),
      ];
  return h('section', { class: 'panel', 'aria-labelledby': 'aj-carpeta' },
    h('h2', { id: 'aj-carpeta' }, 'Usar en varios equipos'),
    cuerpo);
}
