import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  nombreArchivoProyecto, leerCarpeta, planificar, escribirProyecto, cambioEnCarpeta, copiarAPapelera, moverAPapelera, EXTENSION,
} from '../js/nucleo/carpeta.js';
import { nuevoProyecto } from '../js/nucleo/proyecto.js';

/** Doble de FileSystemDirectoryHandle: archivos en memoria y un reloj que avanza con cada escritura. */
let reloj = 1000;
function carpetaFalsa() {
  const archivos = new Map();
  const subcarpetas = new Map();
  const manejador = (nombre) => ({
    kind: 'file',
    name: nombre,
    getFile: async () => { const a = archivos.get(nombre); return { lastModified: a.modificado, text: async () => a.contenido }; },
    createWritable: async () => {
      let contenido = '';
      return { write: async (t) => { contenido += t; }, close: async () => { archivos.set(nombre, { contenido, modificado: ++reloj }); } };
    },
  });
  return {
    archivos,
    subcarpetas,
    async *values() { for (const nombre of archivos.keys()) yield manejador(nombre); },
    async getFileHandle(nombre, { create = false } = {}) {
      if (!archivos.has(nombre)) {
        if (!create) throw Object.assign(new Error('NotFound'), { name: 'NotFoundError' });
        archivos.set(nombre, { contenido: '', modificado: ++reloj });
      }
      return manejador(nombre);
    },
    async getDirectoryHandle(nombre, { create = false } = {}) {
      if (!subcarpetas.has(nombre)) { if (!create) throw new Error('NotFound'); subcarpetas.set(nombre, carpetaFalsa()); }
      return subcarpetas.get(nombre);
    },
    async removeEntry(nombre) { archivos.delete(nombre); },
    /** Simula que otro equipo cambió el archivo (la nube lo trajo). */
    tocar(nombre, cambio) {
      const a = archivos.get(nombre);
      archivos.set(nombre, { contenido: JSON.stringify(cambio(JSON.parse(a.contenido))), modificado: ++reloj });
    },
  };
}

const proyecto = (nombre, actualizado = '2026-11-16T10:00:00.000Z') => ({ ...nuevoProyecto(nombre), actualizado });

test('el nombre del archivo lleva el nombre y un trozo del id, sin acentos', () => {
  const p = { ...proyecto('Taller Mecánico Soto'), id: 'p-mwj4fcu3-1d67n' };
  assert.equal(nombreArchivoProyecto(p), 'taller-mecanico-soto-31d67n.copiloto.json');
});

test('un proyecto se escribe y se vuelve a leer igual; el ejemplo y los archivos ajenos no se cargan', async () => {
  const c = carpetaFalsa();
  const p = proyecto('Taller');
  const marca = await escribirProyecto(c, p);
  c.archivos.set(`roto${EXTENSION}`, { contenido: '{no es json', modificado: 1 });
  c.archivos.set(`otro${EXTENSION}`, { contenido: '{"hola":1}', modificado: 1 });
  c.archivos.set('notas.txt', { contenido: 'x', modificado: 1 });
  await escribirProyecto(c, { ...proyecto('Pastelería de Carla (ejemplo)'), id: 'ejemplo-pasteleria' });
  const { proyectos, invalidos } = await leerCarpeta(c);
  assert.deepEqual(proyectos.map((x) => x.proyecto.id), [p.id]);
  assert.equal(proyectos[0].proyecto.actualizado, p.actualizado, 'conserva la fecha del archivo para comparar');
  assert.equal(proyectos[0].modificado, marca.modificado);
  assert.deepEqual(invalidos.sort(), [`otro${EXTENSION}`, `roto${EXTENSION}`]);
  assert.ok(c.archivos.has('notas.txt'), 'nunca toca lo que no es suyo');
});

test('planificar: escribe lo nuevo de aquí, trae lo nuevo de allá y no hace nada si nada cambió', async () => {
  const c = carpetaFalsa();
  const aqui = proyecto('Solo aquí');
  const comun = proyecto('Común');
  const alla = proyecto('Creado en otro equipo');
  const marcas = { [comun.id]: await escribirProyecto(c, comun) };
  await escribirProyecto(c, alla);
  const { proyectos } = await leerCarpeta(c);
  const acciones = planificar([aqui, comun], proyectos, marcas);
  assert.deepEqual(acciones.map((a) => `${a.tipo}:${a.id === aqui.id ? 'aqui' : a.id === alla.id ? 'alla' : 'comun'}`).sort(), ['escribir:aqui', 'traer:alla']);
});

test('planificar: un cambio en un solo lado se copia al otro; en los dos lados es conflicto', async () => {
  const c = carpetaFalsa();
  const p = proyecto('Taller');
  const marca = await escribirProyecto(c, p);
  const marcas = { [p.id]: marca };

  const editadoAqui = { ...p, actualizado: '2026-11-16T11:00:00.000Z' };
  assert.deepEqual(planificar([editadoAqui], (await leerCarpeta(c)).proyectos, marcas).map((a) => a.tipo), ['escribir']);

  c.tocar(marca.archivo, (d) => ({ ...d, nombre: 'Taller (oficina)', actualizado: '2026-11-16T12:00:00.000Z' }));
  const enCarpeta = (await leerCarpeta(c)).proyectos;
  assert.deepEqual(planificar([p], enCarpeta, marcas).map((a) => a.tipo), ['traer'], 'solo cambió el otro equipo');
  assert.deepEqual(planificar([editadoAqui], enCarpeta, marcas).map((a) => a.tipo), ['conflicto'], 'cambiaron los dos');
});

test('primera vez con la carpeta: la misma versión solo se anota; versiones distintas son conflicto', async () => {
  const c = carpetaFalsa();
  const p = proyecto('Taller');
  await escribirProyecto(c, p);
  const { proyectos } = await leerCarpeta(c);
  assert.deepEqual(planificar([p], proyectos, {}).map((a) => a.tipo), ['marcar']);
  assert.deepEqual(planificar([{ ...p, actualizado: '2026-11-17T09:00:00.000Z' }], proyectos, {}).map((a) => a.tipo), ['conflicto']);
});

test('renombrar el proyecto no cambia su archivo; antes de escribir se detecta si otro equipo lo cambió', async () => {
  const c = carpetaFalsa();
  const p = proyecto('Taller');
  const marca = await escribirProyecto(c, p);
  const otra = await escribirProyecto(c, { ...p, nombre: 'Taller Soto', actualizado: '2026-11-16T13:00:00.000Z' }, marca);
  assert.equal(otra.archivo, marca.archivo);
  assert.equal(c.archivos.size, 1);
  assert.equal(await cambioEnCarpeta(c, otra), false);
  c.tocar(otra.archivo, (d) => ({ ...d, actualizado: '2026-11-16T14:00:00.000Z' }));
  assert.equal(await cambioEnCarpeta(c, otra), true);
});

test('borrar o descartar nunca pierde trabajo: todo pasa a la papelera', async () => {
  const c = carpetaFalsa();
  const p = proyecto('Taller');
  const marca = await escribirProyecto(c, p);
  const copia = await copiarAPapelera(c, p, 'conflicto', new Date('2026-11-16T10:30:00Z'));
  assert.match(copia, /\.conflicto-2026-11-16-10-30-00\.copiloto\.json$/);
  const borrado = await moverAPapelera(c, marca, new Date('2026-11-16T11:00:00Z'));
  assert.ok(!c.archivos.has(marca.archivo), 'sale de la carpeta');
  const papelera = c.subcarpetas.get('papelera');
  assert.deepEqual([...papelera.archivos.keys()].sort(), [copia, borrado].sort());
  assert.equal(JSON.parse(papelera.archivos.get(borrado).contenido).id, p.id);
});

test('si la nube reescribe el archivo sin cambiar su contenido, no hay conflicto falso', async () => {
  const c = carpetaFalsa();
  const p = proyecto('Taller');
  const marca = await escribirProyecto(c, p);
  c.tocar(marca.archivo, (d) => d); // misma versión, fecha nueva
  const editadoAqui = { ...p, actualizado: '2026-11-16T11:00:00.000Z' };
  const { proyectos } = await leerCarpeta(c);
  assert.deepEqual(planificar([editadoAqui], proyectos, { [p.id]: marca }).map((a) => a.tipo), ['escribir']);
  assert.deepEqual(planificar([p], proyectos, { [p.id]: marca }).map((a) => a.tipo), ['marcar'], 'solo actualiza la fecha anotada');
  assert.equal(await cambioEnCarpeta(c, marca), false);
});
