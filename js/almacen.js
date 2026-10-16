// Almacenamiento local en IndexedDB. Nada sale del navegador.
// Con ?prueba en la dirección se usa una base aparte: las pruebas de interfaz nunca tocan los datos reales.
export const MODO_PRUEBA = new URLSearchParams(location.search).has('prueba');
const NOMBRE = MODO_PRUEBA ? 'copiloto-po-prueba' : 'copiloto-po';
const VERSION = 1;

let conexion = null;

function abrir() {
  if (conexion) return conexion;
  conexion = new Promise((resolver, rechazar) => {
    const pedido = indexedDB.open(NOMBRE, VERSION);
    pedido.onupgradeneeded = () => {
      const db = pedido.result;
      if (!db.objectStoreNames.contains('proyectos')) db.createObjectStore('proyectos', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('ajustes')) db.createObjectStore('ajustes');
    };
    pedido.onsuccess = () => resolver(pedido.result);
    pedido.onerror = () => rechazar(pedido.error);
    pedido.onblocked = () => rechazar(new Error('Cierra las otras pestañas del copiloto y vuelve a intentarlo.'));
  });
  return conexion;
}

async function operar(almacen, modo, accion) {
  const db = await abrir();
  return new Promise((resolver, rechazar) => {
    const tx = db.transaction(almacen, modo);
    const pedido = accion(tx.objectStore(almacen));
    tx.oncomplete = () => resolver(pedido?.result);
    tx.onerror = () => rechazar(tx.error);
    tx.onabort = () => rechazar(tx.error || new Error('No se pudo guardar.'));
  });
}

export const listarProyectos = () => operar('proyectos', 'readonly', (s) => s.getAll());
export const guardarProyecto = (p) => operar('proyectos', 'readwrite', (s) => s.put({ ...p, actualizado: new Date().toISOString() }));
export const borrarProyecto = (id) => operar('proyectos', 'readwrite', (s) => s.delete(id));
export const leerAjuste = (clave) => operar('ajustes', 'readonly', (s) => s.get(clave));
export const guardarAjuste = (clave, valor) => operar('ajustes', 'readwrite', (s) => s.put(valor, clave));

/** Pide al navegador que no borre los datos cuando falte espacio. */
export async function pedirPersistencia() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      return await navigator.storage.persist();
    }
    return true;
  } catch {
    return false;
  }
}
