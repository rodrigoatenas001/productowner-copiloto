// Convierte los documentos que la app arma en Markdown (propuesta, actas, respuestas, informes)
// a los bloques que entienden Word y el PDF. Cubre solo el Markdown que genera la propia app.

/** Quita las marcas de énfasis y enlaces: Word y el PDF reciben texto limpio. */
const limpio = (t) => String(t)
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  .replace(/\*\*([^*]+)\*\*/g, '$1')
  .replace(/(^|[\s(])[_*]([^_*]+)[_*](?=[\s).,;:]|$)/g, '$1$2')
  .replace(/`([^`]+)`/g, '$1')
  .trim();

const celdas = (linea) => linea.trim().replace(/^\||\|$/g, '').split('|').map((c) => limpio(c));

/** @returns {object[]} bloques (ver documentoProyecto en informe.js) */
export function markdownABloques(md) {
  const bloques = [];
  const lineas = String(md || '').split(/\r?\n/);
  let parrafo = [];
  const cerrarParrafo = () => {
    if (!parrafo.length) return;
    const texto = parrafo.join(' ');
    // Un párrafo entero en negrita funciona como subtítulo («**Catálogo**»)
    const fuerte = /^\*\*[^*]+\*\*:?$/.test(texto);
    bloques.push({ t: 'p', texto: limpio(texto), ...(fuerte ? { fuerte: true } : {}) });
    parrafo = [];
  };

  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i];
    const t = linea.trim();
    if (!t) { cerrarParrafo(); continue; }

    const titulo = t.match(/^(#{1,4})\s+(.+)$/);
    if (titulo) {
      cerrarParrafo();
      const nivel = titulo[1].length;
      bloques.push({ t: nivel === 1 ? 'titulo' : nivel === 2 ? 'h1' : nivel === 3 ? 'h2' : 'h3', texto: limpio(titulo[2]) });
      // La línea en cursiva justo bajo el título es la fecha o el subtítulo del documento
      const siguiente = lineas.slice(i + 1).find((l) => l.trim());
      if (nivel === 1 && siguiente && /^_[^_].*_$/.test(siguiente.trim())) {
        bloques.push({ t: 'subtitulo', texto: limpio(siguiente.trim()) });
        i = lineas.indexOf(siguiente, i + 1);
      }
      continue;
    }

    if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(t)) { cerrarParrafo(); continue; }

    if (t.startsWith('|')) {
      cerrarParrafo();
      const filas = [];
      while (i < lineas.length && lineas[i].trim().startsWith('|')) { filas.push(lineas[i]); i++; }
      i--;
      const conEncabezado = filas.length > 1 && /^\|?\s*:?-{2,}/.test(filas[1].trim().replace(/^\|/, ''));
      const columnas = conEncabezado ? celdas(filas[0]) : [];
      const cuerpo = (conEncabezado ? filas.slice(2) : filas).map(celdas);
      bloques.push({ t: 'tabla', columnas, filas: cuerpo });
      continue;
    }

    if (/^[-*]\s+\[[ xX]\]\s+/.test(t) || /^[-*]\s+/.test(t) || /^\d+[.)]\s+/.test(t)) {
      cerrarParrafo();
      const check = /^[-*]\s+\[[ xX]\]\s+/.test(t);
      const items = [];
      while (i < lineas.length) {
        const l = lineas[i].trim();
        const esCasilla = /^[-*]\s+\[[ xX]\]\s+/.test(l);
        if (esCasilla !== check) break; // una lista seguida de casillas son dos bloques
        const m = check ? l.match(/^[-*]\s+\[[ xX]\]\s+(.+)$/) : l.match(/^(?:[-*]|\d+[.)])\s+(.+)$/);
        if (!m) break;
        items.push(limpio(m[1]));
        i++;
      }
      i--;
      bloques.push({ t: check ? 'check' : 'lista', items });
      continue;
    }

    if (t.startsWith('>')) {
      cerrarParrafo();
      bloques.push({ t: 'cita', texto: limpio(t.replace(/^>\s?/, '')) });
      continue;
    }

    parrafo.push(t);
  }
  cerrarParrafo();
  return bloques;
}
