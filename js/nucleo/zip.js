// ZIP mínimo sin compresión (método «store»): lo que necesitan .xlsx y .docx, que son ZIP con XML.
// Sin librerías: la app funciona sin conexión y no carga código de terceros.

const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = TABLA_CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Fecha y hora en el formato de MS-DOS que usa ZIP. */
function fechaDos(d) {
  return {
    hora: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    fecha: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

/**
 * Arma un ZIP con los archivos dados ({ ruta: texto o Uint8Array }), en ese orden.
 * @returns {Uint8Array}
 */
export function crearZip(archivos, cuando = new Date()) {
  const cod = new TextEncoder();
  const { hora, fecha } = fechaDos(cuando);
  const locales = [];
  const centrales = [];
  let desplazamiento = 0;

  for (const [ruta, contenido] of Object.entries(archivos)) {
    const nombre = cod.encode(ruta);
    const datos = typeof contenido === 'string' ? cod.encode(contenido) : contenido;
    const crc = crc32(datos);

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true); // versión necesaria
    local.setUint16(6, 0x0800, true); // nombres en UTF-8
    local.setUint16(8, 0, true); // sin compresión
    local.setUint16(10, hora, true);
    local.setUint16(12, fecha, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, datos.length, true);
    local.setUint32(22, datos.length, true);
    local.setUint16(26, nombre.length, true);
    local.setUint16(28, 0, true);
    locales.push(new Uint8Array(local.buffer), nombre, datos);

    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02014b50, true);
    central.setUint16(4, 20, true);
    central.setUint16(6, 20, true);
    central.setUint16(8, 0x0800, true);
    central.setUint16(10, 0, true);
    central.setUint16(12, hora, true);
    central.setUint16(14, fecha, true);
    central.setUint32(16, crc, true);
    central.setUint32(20, datos.length, true);
    central.setUint32(24, datos.length, true);
    central.setUint16(28, nombre.length, true);
    central.setUint32(42, desplazamiento, true);
    centrales.push(new Uint8Array(central.buffer), nombre);

    desplazamiento += 30 + nombre.length + datos.length;
  }

  const tamanoCentral = centrales.reduce((t, b) => t + b.length, 0);
  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true);
  const cantidad = Object.keys(archivos).length;
  fin.setUint16(8, cantidad, true);
  fin.setUint16(10, cantidad, true);
  fin.setUint32(12, tamanoCentral, true);
  fin.setUint32(16, desplazamiento, true);

  const partes = [...locales, ...centrales, new Uint8Array(fin.buffer)];
  const salida = new Uint8Array(partes.reduce((t, b) => t + b.length, 0));
  let i = 0;
  for (const b of partes) { salida.set(b, i); i += b.length; }
  return salida;
}

/** Lee un ZIP «store» (para las pruebas): devuelve { ruta: texto }. */
export function leerZip(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const dec = new TextDecoder();
  const salida = {};
  let i = 0;
  while (i + 4 <= bytes.length && dv.getUint32(i, true) === 0x04034b50) {
    const tamano = dv.getUint32(i + 18, true);
    const largoNombre = dv.getUint16(i + 26, true);
    const extra = dv.getUint16(i + 28, true);
    const nombre = dec.decode(bytes.subarray(i + 30, i + 30 + largoNombre));
    const inicio = i + 30 + largoNombre + extra;
    salida[nombre] = dec.decode(bytes.subarray(inicio, inicio + tamano));
    i = inicio + tamano;
  }
  return salida;
}
