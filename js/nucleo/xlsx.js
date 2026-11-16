// Libro de Excel (.xlsx, Office Open XML) armado a mano: hojas con título, encabezado fijo,
// filtros, anchos de columna, colores por prioridad y página lista para imprimir.
import { crearZip } from './zip.js';

/** Quita caracteres que XML no admite y escapa los especiales. */
export const xmlSeguro = (t) => String(t ?? '')
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Letra de columna de Excel: 0 → A, 26 → AA. */
export function letra(i) {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** Nombre de hoja válido: hasta 31 caracteres y sin \ / ? * [ ] : */
export const nombreHoja = (t) => String(t || 'Hoja').replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31) || 'Hoja';

// Índices en <cellXfs> de styles.xml (el orden importa)
export const ESTILO = { normal: 1, encabezado: 2, centro: 3, must: 4, should: 5, could: 6, wont: 7, titulo: 8, nota: 9, total: 10, decimal: 11, hecho: 12, curso: 13 };

const ESTILOS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.##"/></numFmts>
  <fonts count="5">
    <font><sz val="11"/><color rgb="FF10213A"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="11"/><color rgb="FF10213A"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="16"/><color rgb="FF10213A"/><name val="Calibri"/><family val="2"/></font>
    <font><i/><sz val="10"/><color rgb="FF5A6B82"/><name val="Calibri"/><family val="2"/></font>
  </fonts>
  <fills count="10">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF10213A"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF8D7D3"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFBF1D9"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE2F1EC"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFEEF0F3"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF5F7FA"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFC8E6DC"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF6E9DF"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"><color rgb="FFD0D7E2"/></left><right style="thin"><color rgb="FFD0D7E2"/></right><top style="thin"><color rgb="FFD0D7E2"/></top><bottom style="thin"><color rgb="FFD0D7E2"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="14">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf>
    <xf numFmtId="0" fontId="2" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf>
    <xf numFmtId="0" fontId="2" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf>
    <xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf>
    <xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="164" fontId="2" fillId="7" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="top"/></xf>
    <xf numFmtId="0" fontId="0" fillId="8" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf>
    <xf numFmtId="0" fontId="0" fillId="9" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

/** Una celda: texto, número o { v, estilo }. Los números van alineados a la derecha. */
function celda(ref, valor, estiloFila) {
  const v = valor && typeof valor === 'object' && 'v' in valor ? valor.v : valor;
  const nombre = valor && typeof valor === 'object' && valor.estilo;
  const s = ESTILO[nombre || (typeof v === 'number' ? 'decimal' : estiloFila)] ?? ESTILO.normal;
  if (v === null || v === undefined || v === '') return `<c r="${ref}" s="${s}"/>`;
  if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}" s="${s}"><v>${v}</v></c>`;
  return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${xmlSeguro(v)}</t></is></c>`;
}

/**
 * XML de una hoja. Con `titulo`, la fila 1 es el título, la 2 una nota y el encabezado va en la 4.
 * @param {{nombre: string, titulo?: string, nota?: string, columnas: {titulo: string, ancho?: number}[], filas: any[][], filtro?: boolean}} hoja
 */
function hojaXml(hoja) {
  const filaEncabezado = hoja.titulo ? 4 : 1;
  const ultimaCol = letra(Math.max(0, hoja.columnas.length - 1));
  const ultimaFila = filaEncabezado + hoja.filas.length;
  const filas = [];
  if (hoja.titulo) {
    filas.push(`<row r="1" ht="24" customHeight="1">${celda('A1', { v: hoja.titulo, estilo: 'titulo' })}</row>`);
    if (hoja.nota) filas.push(`<row r="2">${celda('A2', { v: hoja.nota, estilo: 'nota' })}</row>`);
  }
  filas.push(`<row r="${filaEncabezado}" ht="30" customHeight="1">${hoja.columnas.map((c, i) => celda(`${letra(i)}${filaEncabezado}`, { v: c.titulo, estilo: 'encabezado' })).join('')}</row>`);
  hoja.filas.forEach((fila, k) => {
    const r = filaEncabezado + 1 + k;
    const estiloFila = fila.estiloFila || 'normal';
    filas.push(`<row r="${r}">${fila.map((v, i) => celda(`${letra(i)}${r}`, v, estiloFila)).join('')}</row>`);
  });
  const conFiltro = hoja.filtro !== false && hoja.filas.length > 0;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
  <dimension ref="A1:${ultimaCol}${ultimaFila}"/>
  <sheetViews><sheetView workbookViewId="0"${hoja.titulo ? '' : ''}><pane ySplit="${filaEncabezado}" topLeftCell="A${filaEncabezado + 1}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A${filaEncabezado + 1}" sqref="A${filaEncabezado + 1}"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <cols>${hoja.columnas.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.ancho || 14}" customWidth="1"/>`).join('')}</cols>
  <sheetData>${filas.join('')}</sheetData>
  ${conFiltro ? `<autoFilter ref="A${filaEncabezado}:${ultimaCol}${ultimaFila}"/>` : ''}
  <pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>
  <pageSetup paperSize="1" orientation="landscape" fitToWidth="1" fitToHeight="0"/>
  <headerFooter><oddFooter>&amp;L${xmlSeguro(hoja.nombre)}&amp;RPágina &amp;P de &amp;N</oddFooter></headerFooter>
</worksheet>`;
}

/**
 * Arma el libro completo.
 * @param {object[]} hojas ver hojaXml
 * @returns {Uint8Array}
 */
export function libroExcel(hojas, { titulo = 'Copiloto PO', autor = 'Copiloto PO', fecha = new Date() } = {}) {
  const usadas = new Set();
  const lista = hojas.map((h) => {
    let nombre = nombreHoja(h.nombre);
    for (let n = 2; usadas.has(nombre.toLowerCase()); n++) nombre = `${nombreHoja(h.nombre).slice(0, 28)} ${n}`;
    usadas.add(nombre.toLowerCase());
    return { ...h, nombre };
  });
  const iso = fecha.toISOString().replace(/\.\d+Z$/, 'Z');
  const ref = (h) => `'${h.nombre.replace(/'/g, "''")}'`;
  const definidos = lista.flatMap((h, i) => {
    const fila = h.titulo ? 4 : 1;
    const ultima = letra(Math.max(0, h.columnas.length - 1));
    return [
      h.filtro !== false && h.filas.length ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">${xmlSeguro(ref(h))}!$A$${fila}:$${ultima}$${fila + h.filas.length}</definedName>` : null,
      `<definedName name="_xlnm.Print_Titles" localSheetId="${i}">${xmlSeguro(ref(h))}!$${fila}:$${fila}</definedName>`,
    ].filter(Boolean);
  });

  const archivos = {
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  ${lista.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('\n  ')}
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`,
    'docProps/core.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${xmlSeguro(titulo)}</dc:title><dc:creator>${xmlSeguro(autor)}</dc:creator>
  <dcterms:created xsi:type="dcterms:W3CDTF">${iso}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${iso}</dcterms:modified>
</cp:coreProperties>`,
    'docProps/app.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Copiloto PO</Application></Properties>`,
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <bookViews><workbookView activeTab="0"/></bookViews>
  <sheets>${lista.map((h, i) => `<sheet name="${xmlSeguro(h.nombre)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>
  <definedNames>${definidos.join('')}</definedNames>
</workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${lista.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('\n  ')}
  <Relationship Id="rId${lista.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    'xl/styles.xml': ESTILOS_XML,
  };
  lista.forEach((h, i) => { archivos[`xl/worksheets/sheet${i + 1}.xml`] = hojaXml(h); });
  return crearZip(archivos, fecha);
}
