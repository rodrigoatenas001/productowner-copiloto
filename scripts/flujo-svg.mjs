// Genera la ilustración del flujo para el README (versión clara y oscura).
// Uso: node scripts/flujo-svg.mjs   → docs/img/flujo.svg y docs/img/flujo-oscuro.svg
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const ETAPAS = [
  { nombre: 'Levantar', sub: 'con el cliente', items: ['Notas → historias', 'Plantillas por tipo', 'Revisión INVEST', 'Casos borde'] },
  { nombre: 'Acordar', sub: 'alcance y precio', items: ['Incluye / no incluye', 'Horas y valor en UF', 'Hitos de pago', 'Propuesta lista'] },
  { nombre: 'Ordenar', sub: 'qué va primero', items: ['WSJF y RICE', 'Roadmap y OKR', 'Pronóstico con rango', 'Dependencias'] },
  { nombre: 'Construir', sub: 'en sprints', items: ['Tablero y límite WIP', 'Bloqueos y ciclo', 'Definition of Done', 'Burndown'] },
  { nombre: 'Entregar', sub: 'y cobrar', items: ['Acta de aceptación', 'Informe al cliente', 'Notas de versión', 'Issues GitHub/Linear'] },
  { nombre: 'Aprender', sub: 'y mejorar', items: ['Retrospectiva', 'Hipótesis medidas', 'Feedback de Review', 'Taller y trivia'] },
];

const TEMAS = {
  claro: { fondo: '#f5f7fa', tarjeta: '#ffffff', borde: '#e3e9f1', texto: '#10213a', suave: '#5a6b82', acento: '#b8642e', acentoTexto: '#9a4f1d', numero: '#ffffff' },
  oscuro: { fondo: '#0d1117', tarjeta: '#161b22', borde: '#30363d', texto: '#e6edf3', suave: '#9fb0c8', acento: '#d9884f', acentoTexto: '#f0b98f', numero: '#0d1117' },
};

const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function svg(t) {
  const ancho = 172;
  const separacion = 20;
  const x0 = 34;
  const y0 = 104;
  const alto = 268;
  const fuente = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
  const centro = (i) => x0 + i * (ancho + separacion) + ancho / 2;

  const tarjetas = ETAPAS.map((e, i) => {
    const x = x0 + i * (ancho + separacion);
    const lineas = e.items.map((it, k) => `
      <circle cx="${x + 22}" cy="${y0 + 150 + k * 28}" r="3" fill="${t.acento}"/>
      <text x="${x + 32}" y="${y0 + 155 + k * 28}" font-size="13.5" fill="${t.texto}">${esc(it)}</text>`).join('');
    const flecha = i < ETAPAS.length - 1
      ? `<path d="M ${x + ancho + 5} ${y0 + 60} l 9 0 m -4 -5 l 5 5 l -5 5" fill="none" stroke="${t.acento}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`
      : '';
    return `
    <g>
      <rect x="${x}" y="${y0}" width="${ancho}" height="${alto}" rx="14" fill="${t.tarjeta}" stroke="${t.borde}"/>
      <rect x="${x}" y="${y0}" width="${ancho}" height="5" rx="2.5" fill="${t.acento}"/>
      <circle cx="${x + 30}" cy="${y0 + 42}" r="16" fill="${t.acento}"/>
      <text x="${x + 30}" y="${y0 + 48}" text-anchor="middle" font-size="16" font-weight="700" fill="${t.numero}">${i + 1}</text>
      <text x="${x + 18}" y="${y0 + 92}" font-size="21" font-weight="700" fill="${t.texto}">${esc(e.nombre)}</text>
      <text x="${x + 18}" y="${y0 + 114}" font-size="12" font-weight="600" letter-spacing="1" fill="${t.acentoTexto}">${esc(e.sub.toUpperCase())}</text>${lineas}
      ${flecha}
    </g>`;
  }).join('');

  // El ciclo: cambios del cliente y aprendizajes vuelven a "Ordenar"
  const yBase = y0 + alto;
  const desde = centro(5);
  const hasta = centro(2);
  const ciclo = `
    <path d="M ${desde} ${yBase + 6} V ${yBase + 50} Q ${desde} ${yBase + 62} ${desde - 12} ${yBase + 62} H ${hasta + 12} Q ${hasta} ${yBase + 62} ${hasta} ${yBase + 50} V ${yBase + 14}"
      fill="none" stroke="${t.acento}" stroke-width="2.5" stroke-dasharray="7 6" stroke-linecap="round"/>
    <path d="M ${hasta - 7} ${yBase + 20} L ${hasta} ${yBase + 9} L ${hasta + 7} ${yBase + 20}" fill="none" stroke="${t.acento}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="${(desde + hasta) / 2 - 215}" y="${yBase + 48}" width="430" height="28" rx="14" fill="${t.fondo}"/>
    <text x="${(desde + hasta) / 2}" y="${yBase + 67}" text-anchor="middle" font-size="14" font-weight="600" fill="${t.acentoTexto}">Cambios del cliente y aprendizajes vuelven al backlog</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 520" width="1200" height="520" font-family="${fuente}" role="img" aria-labelledby="titulo desc">
  <title id="titulo">Flujo de Copiloto PO</title>
  <desc id="desc">Seis etapas: levantar con el cliente, acordar alcance y precio, ordenar qué va primero, construir en sprints, entregar y cobrar, y aprender; los cambios y aprendizajes vuelven al backlog.</desc>
  <rect width="1200" height="520" rx="18" fill="${t.fondo}"/>
  <text x="34" y="58" font-size="28" font-weight="800" fill="${t.texto}">Copiloto <tspan fill="${t.acento}">PO</tspan></text>
  <text x="34" y="84" font-size="15" fill="${t.suave}">Del primer audio desordenado del cliente a la entrega aceptada, sin cuentas ni servidor.</text>${tarjetas}${ciclo}
  <text x="1166" y="498" text-anchor="end" font-size="12.5" fill="${t.suave}">Libre (MIT) · funciona sin conexión · IA opcional y tuya</text>
</svg>
`;
}

const carpeta = fileURLToPath(new URL('../docs/img/', import.meta.url));
await mkdir(carpeta, { recursive: true });
await writeFile(`${carpeta}flujo.svg`, svg(TEMAS.claro));
await writeFile(`${carpeta}flujo-oscuro.svg`, svg(TEMAS.oscuro));
console.log('Listo: docs/img/flujo.svg y docs/img/flujo-oscuro.svg');
