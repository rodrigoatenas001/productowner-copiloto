// Documento de Word (.docx, Office Open XML) a partir de bloques simples (ver informe.js).
// Usa estilos reales de Word (Título, Título 1-3, Cita), así se puede generar el índice
// y cambiar el aspecto de todo el documento desde Word.
import { crearZip } from './zip.js';
import { xmlSeguro } from './xlsx.js';

const ANCHO_TEXTO = 9360; // carta (12240) menos márgenes de 1 pulgada, en twips

/** Texto con saltos de línea respetados. */
function corridas(texto, propiedades = '') {
  const rpr = propiedades ? `<w:rPr>${propiedades}</w:rPr>` : '';
  return String(texto ?? '').split('\n').map((linea, i) => `${i ? `<w:r>${rpr}<w:br/></w:r>` : ''}<w:r>${rpr}<w:t xml:space="preserve">${xmlSeguro(linea)}</w:t></w:r>`).join('');
}

const parrafo = (texto, { estilo = null, numId = null, rpr = '' } = {}) => {
  const ppr = [estilo ? `<w:pStyle w:val="${estilo}"/>` : '', numId ? `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${numId}"/></w:numPr>` : ''].join('');
  return `<w:p>${ppr ? `<w:pPr>${ppr}</w:pPr>` : ''}${corridas(texto, rpr)}</w:p>`;
};

function celda(texto, ancho, { encabezado = false, clave = false } = {}) {
  const sombra = encabezado ? '<w:shd w:val="clear" w:color="auto" w:fill="10213A"/>' : clave ? '<w:shd w:val="clear" w:color="auto" w:fill="F5F7FA"/>' : '';
  const rpr = encabezado ? '<w:b/><w:color w:val="FFFFFF"/>' : clave ? '<w:b/>' : '';
  return `<w:tc><w:tcPr><w:tcW w:w="${ancho}" w:type="dxa"/>${sombra}</w:tcPr><w:p><w:pPr><w:pStyle w:val="Celda"/></w:pPr>${corridas(texto, rpr)}</w:p></w:tc>`;
}

function tabla(columnas, filas, anchosPct) {
  const anchos = (anchosPct || columnas.map(() => 100 / columnas.length)).map((p) => Math.round((p / 100) * ANCHO_TEXTO));
  const grid = `<w:tblGrid>${anchos.map((a) => `<w:gridCol w:w="${a}"/>`).join('')}</w:tblGrid>`;
  const cabecera = columnas.length ? `<w:tr><w:trPr><w:tblHeader/><w:cantSplit/></w:trPr>${columnas.map((c, i) => celda(c, anchos[i], { encabezado: true })).join('')}</w:tr>` : '';
  const cuerpo = filas.map((f) => `<w:tr><w:trPr><w:cantSplit/></w:trPr>${f.map((v, i) => celda(v, anchos[i], { clave: !columnas.length && i === 0 })).join('')}</w:tr>`).join('');
  // Párrafo vacío después: Word necesita uno entre tablas seguidas y da aire antes del texto
  return `<w:tbl><w:tblPr><w:tblStyle w:val="TablaCopiloto"/><w:tblW w:w="${ANCHO_TEXTO}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr>${grid}${cabecera}${cuerpo}</w:tbl><w:p><w:pPr><w:pStyle w:val="Espacio"/></w:pPr></w:p>`;
}

function cuerpo(bloques) {
  return bloques.map((b) => {
    switch (b.t) {
      case 'titulo': return parrafo(b.texto, { estilo: 'Title' });
      case 'subtitulo': return parrafo(b.texto, { estilo: 'Subtitle' });
      case 'h1': return parrafo(b.texto, { estilo: 'Heading1' });
      case 'h2': return parrafo(b.texto, { estilo: 'Heading2' });
      case 'h3': return parrafo(b.texto, { estilo: 'Heading3' });
      case 'cita': return parrafo(b.texto, { estilo: 'Quote' });
      case 'p': return parrafo(b.texto, { estilo: b.nota ? 'Nota' : null, rpr: b.fuerte ? '<w:b/>' : '' });
      case 'lista': return b.items.map((x) => parrafo(x, { estilo: 'ListParagraph', numId: 1 })).join('');
      case 'check': return b.items.map((x) => parrafo(x, { estilo: 'ListParagraph', numId: 2 })).join('');
      case 'datos': return tabla([], b.pares, [28, 72]);
      case 'tabla': return tabla(b.columnas, b.filas, b.anchos);
      case 'salto': return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
      default: return '';
    }
  }).join('');
}

const ESTILOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:color w:val="10213A"/><w:sz w:val="21"/><w:szCs w:val="21"/><w:lang w:val="es-CL"/></w:rPr></w:rPrDefault>
    <w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>
    <w:pPr><w:spacing w:before="1200" w:after="120"/><w:pBdr><w:bottom w:val="single" w:sz="12" w:space="8" w:color="B8642E"/></w:pBdr></w:pPr>
    <w:rPr><w:b/><w:sz w:val="52"/><w:szCs w:val="52"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>
    <w:pPr><w:spacing w:after="480"/></w:pPr><w:rPr><w:color w:val="5A6B82"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="9"/><w:qFormat/>
    <w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="480" w:after="200"/><w:outlineLvl w:val="0"/></w:pPr>
    <w:rPr><w:b/><w:color w:val="10213A"/><w:sz w:val="36"/><w:szCs w:val="36"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="9"/><w:qFormat/>
    <w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="360" w:after="120"/><w:outlineLvl w:val="1"/></w:pPr>
    <w:rPr><w:b/><w:color w:val="9A4F1D"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="9"/><w:qFormat/>
    <w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="280" w:after="60"/><w:outlineLvl w:val="2"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="23"/><w:szCs w:val="23"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>
    <w:pPr><w:keepNext/><w:ind w:left="284"/><w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="B8642E"/></w:pBdr></w:pPr>
    <w:rPr><w:i/><w:color w:val="1D3557"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:customStyle="1" w:styleId="Nota"><w:name w:val="Nota"/><w:basedOn w:val="Normal"/><w:qFormat/>
    <w:rPr><w:color w:val="5A6B82"/><w:sz w:val="19"/><w:szCs w:val="19"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:customStyle="1" w:styleId="Celda"><w:name w:val="Celda"/><w:basedOn w:val="Normal"/>
    <w:pPr><w:spacing w:before="40" w:after="40" w:line="240" w:lineRule="auto"/></w:pPr><w:rPr><w:sz w:val="19"/><w:szCs w:val="19"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:customStyle="1" w:styleId="Espacio"><w:name w:val="Espacio"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="0"/></w:pPr><w:rPr><w:sz w:val="12"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="60"/><w:ind w:left="567" w:hanging="283"/></w:pPr></w:style>
  <w:style w:type="paragraph" w:styleId="Footer"><w:name w:val="footer"/><w:basedOn w:val="Normal"/><w:rPr><w:color w:val="5A6B82"/><w:sz w:val="17"/></w:rPr></w:style>
  <w:style w:type="table" w:styleId="TablaCopiloto"><w:name w:val="Tabla Copiloto"/>
    <w:tblPr><w:tblBorders>
      <w:top w:val="single" w:sz="4" w:color="D0D7E2"/><w:left w:val="single" w:sz="4" w:color="D0D7E2"/><w:bottom w:val="single" w:sz="4" w:color="D0D7E2"/>
      <w:right w:val="single" w:sz="4" w:color="D0D7E2"/><w:insideH w:val="single" w:sz="4" w:color="D0D7E2"/><w:insideV w:val="single" w:sz="4" w:color="D0D7E2"/>
    </w:tblBorders><w:tblCellMar><w:left w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>
</w:styles>`;

const NUMERACION = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/>
    <w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="567" w:hanging="283"/></w:pPr><w:rPr><w:color w:val="B8642E"/></w:rPr></w:lvl></w:abstractNum>
  <w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="singleLevel"/>
    <w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="☐"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="567" w:hanging="340"/></w:pPr><w:rPr><w:rFonts w:ascii="Segoe UI Symbol" w:hAnsi="Segoe UI Symbol"/></w:rPr></w:lvl></w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
  <w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>
</w:numbering>`;

const campo = (instr) => `<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> ${instr} </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>`;

/**
 * @param {object[]} bloques contenido (ver documentoProyecto en informe.js)
 * @returns {Uint8Array}
 */
export function documentoWord(bloques, { titulo = 'Documento', pie = 'Copiloto PO', fecha = new Date() } = {}) {
  const iso = fecha.toISOString().replace(/\.\d+Z$/, 'Z');
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  return crearZip({
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
  <Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`,
    'docProps/core.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${xmlSeguro(titulo)}</dc:title><dc:creator>Copiloto PO</dc:creator><dc:language>es-CL</dc:language>
  <dcterms:created xsi:type="dcterms:W3CDTF">${iso}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${iso}</dcterms:modified>
</cp:coreProperties>`,
    'docProps/app.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Copiloto PO</Application></Properties>`,
    'word/_rels/document.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>
</Relationships>`,
    'word/styles.xml': ESTILOS,
    'word/numbering.xml': NUMERACION,
    'word/footer1.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr ${W}><w:p><w:pPr><w:pStyle w:val="Footer"/><w:tabs><w:tab w:val="right" w:pos="${ANCHO_TEXTO}"/></w:tabs></w:pPr>${corridas(pie)}<w:r><w:tab/><w:t xml:space="preserve">Página </w:t></w:r>${campo('PAGE')}<w:r><w:t xml:space="preserve"> de </w:t></w:r>${campo('NUMPAGES')}</w:p></w:ftr>`,
    'word/document.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${W}><w:body>${cuerpo(bloques)}<w:sectPr><w:footerReference w:type="default" r:id="rId3"/><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`,
  }, fecha);
}
