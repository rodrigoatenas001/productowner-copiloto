// Proyectos guardados en una carpeta que el usuario elige (por ejemplo, dentro de OneDrive o Drive):
// un archivo por proyecto. La sincronización entre equipos la hace la nube del usuario, no la app.
// La carpeta llega como parámetro (FileSystemDirectoryHandle o un doble en las pruebas):
// así esta lógica se prueba sin navegador.
import { normalizarProyecto } from './proyecto.js';

export const EXTENSION = '.copiloto.json';
export const PAPELERA = 'papelera';
export const ID_EJEMPLO = 'ejemplo-pasteleria';

/**
 * Nombre del archivo de un proyecto: su nombre y un trozo de su id. Se decide al escribirlo por
 * primera vez y después se mantiene (va en la marca), así renombrar el proyecto no lo pierde.
 */
export function nombreArchivoProyecto(proyecto) {
  const base = String(proyecto.nombre || 'proyecto').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 50) || 'proyecto';
  const id = String(proyecto.id).replace(/[^a-z0-9]/gi, '').slice(-6).toLowerCase();
  return `${base}-${id}${EXTENSION}`;
}

/**
 * Lee los proyectos de la carpeta. Los archivos que no son un proyecto válido se informan, nunca se tocan.
 * @returns {Promise<{proyectos: {proyecto: object, archivo: string, modificado: number}[], invalidos: string[]}>}
 */
export async function leerCarpeta(carpeta) {
  const proyectos = [];
  const invalidos = [];
  for await (const entrada of carpeta.values()) {
    if (entrada.kind !== 'file' || !entrada.name.endsWith(EXTENSION)) continue;
    try {
      const archivo = await entrada.getFile();
      const datos = JSON.parse(await archivo.text());
      if (!datos || typeof datos !== 'object' || !datos.id || !Array.isArray(datos.historias)) throw new Error('no es un proyecto');
      // normalizarProyecto pone «actualizado» en ahora: se conserva el del archivo para comparar
      const proyecto = { ...normalizarProyecto(datos), actualizado: typeof datos.actualizado === 'string' ? datos.actualizado : '' };
      if (proyecto.id === ID_EJEMPLO) continue;
      proyectos.push({ proyecto, archivo: entrada.name, modificado: archivo.lastModified });
    } catch {
      invalidos.push(entrada.name);
    }
  }
  return { proyectos, invalidos };
}

/**
 * Qué hacer con cada proyecto al sincronizar, comparando con lo que se vio la última vez (las marcas).
 * Una marca guarda el archivo, su fecha de modificación y el «actualizado» del proyecto al escribirlo o leerlo.
 * @returns {{tipo: 'traer'|'escribir'|'conflicto'|'marcar', id: string, local?: object, enCarpeta?: object}[]}
 */
export function planificar(locales, enCarpeta, marcas = {}) {
  const acciones = [];
  const porId = new Map(enCarpeta.map((x) => [x.proyecto.id, x]));
  for (const local of locales) {
    if (local.id === ID_EJEMPLO) continue;
    const archivo = porId.get(local.id);
    porId.delete(local.id);
    if (!archivo) { acciones.push({ tipo: 'escribir', id: local.id, local }); continue; }
    const marca = marcas[local.id];
    if (!marca) {
      // Primera vez que se ve este proyecto en los dos lados: si son la misma versión, solo se anota
      acciones.push(local.actualizado === archivo.proyecto.actualizado
        ? { tipo: 'marcar', id: local.id, local, enCarpeta: archivo }
        : { tipo: 'conflicto', id: local.id, local, enCarpeta: archivo });
      continue;
    }
    // La nube a veces reescribe el archivo sin cambiar su contenido: si trae la versión que se escribió
    // desde aquí, no es un cambio de otro equipo
    const cambioArchivo = archivo.modificado !== marca.modificado && archivo.proyecto.actualizado !== marca.local;
    const cambioLocal = local.actualizado !== marca.local;
    if (cambioArchivo && cambioLocal) acciones.push({ tipo: 'conflicto', id: local.id, local, enCarpeta: archivo });
    else if (cambioArchivo) acciones.push({ tipo: 'traer', id: local.id, enCarpeta: archivo });
    else if (cambioLocal) acciones.push({ tipo: 'escribir', id: local.id, local });
    else if (archivo.modificado !== marca.modificado) acciones.push({ tipo: 'marcar', id: local.id, local, enCarpeta: archivo });
  }
  // Lo que está en la carpeta y no aquí: proyectos creados en otro equipo
  for (const archivo of porId.values()) acciones.push({ tipo: 'traer', id: archivo.proyecto.id, enCarpeta: archivo });
  return acciones;
}

async function escribirArchivo(carpeta, nombre, contenido) {
  const entrada = await carpeta.getFileHandle(nombre, { create: true });
  const escritor = await entrada.createWritable();
  await escritor.write(contenido);
  await escritor.close();
  return (await entrada.getFile()).lastModified;
}

/** Escribe el proyecto en su archivo y devuelve la marca nueva. */
export async function escribirProyecto(carpeta, proyecto, marca = null) {
  const archivo = marca?.archivo || nombreArchivoProyecto(proyecto);
  const modificado = await escribirArchivo(carpeta, archivo, JSON.stringify(proyecto, null, 2));
  return { archivo, modificado, local: proyecto.actualizado };
}

/** ¿Alguien cambió el archivo desde la marca? (antes de escribir encima) */
export async function cambioEnCarpeta(carpeta, marca) {
  if (!marca) return false;
  try {
    const archivo = await (await carpeta.getFileHandle(marca.archivo)).getFile();
    if (archivo.lastModified === marca.modificado) return false;
    // Fecha distinta: solo es un cambio si el contenido no es la versión que se escribió desde aquí
    try { return JSON.parse(await archivo.text()).actualizado !== marca.local; } catch { return true; }
  } catch {
    return false; // el archivo ya no está: se vuelve a crear
  }
}

/** Guarda una copia en la papelera (por ejemplo, la versión descartada en un conflicto). */
export async function copiarAPapelera(carpeta, proyecto, motivo, cuando = new Date()) {
  const papelera = await carpeta.getDirectoryHandle(PAPELERA, { create: true });
  const sello = cuando.toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const nombre = nombreArchivoProyecto(proyecto).replace(EXTENSION, `.${motivo}-${sello}${EXTENSION}`);
  await escribirArchivo(papelera, nombre, JSON.stringify(proyecto, null, 2));
  return nombre;
}

/** Proyecto borrado en la app: su archivo pasa a la papelera, nunca se elimina sin copia. */
export async function moverAPapelera(carpeta, marca, cuando = new Date()) {
  if (!marca) return null;
  let entrada;
  try { entrada = await carpeta.getFileHandle(marca.archivo); } catch { return null; }
  const contenido = await (await entrada.getFile()).text();
  const papelera = await carpeta.getDirectoryHandle(PAPELERA, { create: true });
  const sello = cuando.toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const nombre = marca.archivo.replace(EXTENSION, `.borrado-${sello}${EXTENSION}`);
  await escribirArchivo(papelera, nombre, contenido);
  await carpeta.removeEntry(marca.archivo);
  return nombre;
}
