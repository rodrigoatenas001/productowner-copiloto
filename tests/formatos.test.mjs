import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { crearZip, leerZip, crc32 } from '../js/nucleo/zip.js';
import { libroExcel, letra, nombreHoja } from '../js/nucleo/xlsx.js';
import { documentoWord } from '../js/nucleo/docx.js';
import { excelBacklog, excelProyecto, documentoProyecto, codigos } from '../js/nucleo/informe.js';
import { normalizarProyecto } from '../js/nucleo/proyecto.js';

const carla = async () => normalizarProyecto(JSON.parse(await readFile(new URL('../docs/ejemplo/pasteleria-carla.json', import.meta.url), 'utf8')));

test('ZIP: CRC estándar y los archivos vuelven tal cual, con acentos en nombre y contenido', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
  const zip = crearZip({ 'a.txt': 'hola', 'carpeta/ñandú.xml': '<x>más</x>' });
  assert.deepEqual(leerZip(zip), { 'a.txt': 'hola', 'carpeta/ñandú.xml': '<x>más</x>' });
  assert.equal(new DataView(zip.buffer).getUint32(zip.length - 22, true), 0x06054b50, 'termina con el registro final');
});

test('Excel: columnas, nombres de hoja válidos y sin repetir, y texto escapado', () => {
  assert.deepEqual([0, 25, 26, 701].map(letra), ['A', 'Z', 'AA', 'ZZ']);
  assert.equal(nombreHoja('Hitos: pago [1]/2'), 'Hitos  pago  1  2');
  const archivos = leerZip(libroExcel([
    { nombre: 'Datos', columnas: [{ titulo: 'A' }], filas: [['<b>&"x"\u0001']] },
    { nombre: 'Datos', columnas: [{ titulo: 'B' }], filas: [[3.5]] },
  ]));
  assert.match(archivos['xl/workbook.xml'], /name="Datos".*name="Datos 2"/);
  assert.ok(archivos['xl/worksheets/sheet1.xml'].includes('&lt;b&gt;&amp;&quot;x&quot;</t>'), 'escapa y quita caracteres de control');
  assert.ok(archivos['xl/worksheets/sheet2.xml'].includes('<v>3.5</v>'), 'los números quedan como números');
});

test('Excel: enteros sin coma decimal y decimales con dos cifras', () => {
  const archivos = leerZip(libroExcel([{ nombre: 'N', columnas: [{ titulo: 'A' }, { titulo: 'B' }], filas: [[30, 44.09]] }]));
  const estilos = archivos['xl/styles.xml'];
  assert.ok(!estilos.includes('#,##0.##'), 'ese formato deja «30,» en los enteros');
  const xfs = [...estilos.split('<cellXfs')[1].matchAll(/<xf numFmtId="(\d+)"/g)].map((m) => m[1]);
  const [, sEntero] = archivos['xl/worksheets/sheet1.xml'].match(/<c r="A2" s="(\d+)"/);
  const [, sDecimal] = archivos['xl/worksheets/sheet1.xml'].match(/<c r="B2" s="(\d+)"/);
  assert.equal(xfs[sEntero], '3', 'entero con separador de miles y sin decimales');
  assert.equal(xfs[sDecimal], '164', 'decimal con #,##0.00');
});

test('Excel del backlog: encabezado fijo, filtros, prioridad con color y una fila por historia', async () => {
  const p = await carla();
  const hoja = leerZip(excelBacklog(p))['xl/worksheets/sheet1.xml'];
  assert.match(hoja, /<pane ySplit="4" topLeftCell="A5"[^>]*state="frozen"/);
  assert.ok(hoja.includes(`<autoFilter ref="A4:O${4 + p.historias.length}"/>`));
  assert.equal((hoja.match(/<row /g) || []).length, 3 + p.historias.length, 'título, nota, encabezado y filas');
  assert.match(hoja, /s="4" t="inlineStr"><is><t xml:space="preserve">Imprescindible/);
  assert.ok(hoja.includes('Reglas de negocio') && hoja.includes('• Despacho solo a Ñuñoa'));
  assert.ok(hoja.includes('orientation="landscape"'));
});

test('Excel del proyecto: hojas de resumen, backlog, épicas, proceso, sprints, hitos y cambios', async () => {
  const libro = leerZip(excelProyecto(await carla()))['xl/workbook.xml'];
  const hojas = [...libro.matchAll(/<sheet name="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(hojas, ['Resumen', 'Backlog', 'Épicas', 'Resultados clave', 'Stakeholders', 'Proceso', 'Sprints', 'Hitos de pago', 'Cambios']);
  assert.match(libro, /_xlnm.Print_Titles/);
});

test('documento del proyecto: secciones numeradas, códigos de historia, criterios como casillas', async () => {
  const p = await carla();
  const bloques = documentoProyecto(p, new Date('2026-11-16T12:00:00'));
  const secciones = bloques.filter((b) => b.t === 'h1').map((b) => b.texto);
  assert.deepEqual(secciones, ['1. Stakeholders', '2. Alcance', '3. Proceso', '4. Backlog', '5. Cotización e hitos de pago', '6. Sprints', '7. Solicitudes de cambio', '8. Resultados medidos', '9. Mejoras acordadas en las retrospectivas']);
  assert.equal(bloques[0].texto, p.nombre);
  const cod = codigos(p);
  assert.ok(bloques.some((b) => b.t === 'h3' && b.texto === `${cod.get(p.historias[0].id)} · ${p.historias[0].titulo}`));
  assert.ok(bloques.some((b) => b.t === 'check' && b.items.some((c) => c.startsWith('Dado '))));
  assert.ok(bloques.some((b) => b.t === 'p' && b.texto.startsWith('Hipótesis: Creemos que al ')), 'usa la misma frase de hipótesis que la app');
});

test('Word: estilos de título reales, casillas, tablas con encabezado repetido y número de página', async () => {
  const p = await carla();
  const archivos = leerZip(documentoWord(documentoProyecto(p), { titulo: p.nombre }));
  const doc = archivos['word/document.xml'];
  for (const estilo of ['Title', 'Heading1', 'Heading2', 'Heading3', 'Quote']) assert.ok(doc.includes(`<w:pStyle w:val="${estilo}"/>`), estilo);
  assert.ok(doc.includes('<w:numId w:val="2"/>') && archivos['word/numbering.xml'].includes('☐'), 'criterios como casillas');
  assert.ok(doc.includes('<w:tblHeader/>'));
  assert.ok(archivos['word/footer1.xml'].includes(' PAGE ') && archivos['word/footer1.xml'].includes(' NUMPAGES '));
  assert.ok(archivos['word/styles.xml'].includes('<w:outlineLvl w:val="0"/>'), 'los títulos entran al índice');
});

test('Markdown de la app a bloques: título y fecha, secciones, listas, casillas, tablas y negritas limpias', async () => {
  const { markdownABloques } = await import('../js/nucleo/markdownBloques.js');
  const b = markdownABloques('# Propuesta: Taller\n\n_16-11-2026 · válida por 15 días_\n\n## Qué incluye\n\n**Agenda**\n\n- Ver la agenda, para preparar.\n- [ ] Dado un día, cuando abro, entonces veo.\n\n| Concepto | Valor |\n|---|---|\n| **Total** | **28,8 UF** |\n\n> Como mecánico, quiero ver la agenda.\n\nTexto con **negrita** y _cursiva_.');
  assert.deepEqual(b.map((x) => x.t), ['titulo', 'subtitulo', 'h1', 'p', 'lista', 'check', 'tabla', 'cita', 'p']);
  assert.equal(b[1].texto, '16-11-2026 · válida por 15 días');
  assert.ok(b[3].fuerte);
  assert.deepEqual(b[6].columnas, ['Concepto', 'Valor']);
  assert.deepEqual(b[6].filas, [['Total', '28,8 UF']]);
  assert.equal(b[8].texto, 'Texto con negrita y cursiva.');
});
