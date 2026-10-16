// Toma las capturas del README con el proyecto de ejemplo (docs/ejemplo/pasteleria-carla.json).
// Uso: node scripts/proyecto-ejemplo.mjs && node scripts/capturas.mjs   → docs/img/captura-*.png
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { servir, abrir, pausa, RAIZ } from './navegador.mjs';

const CAPTURAS = [
  { archivo: 'captura-backlog.png', vista: 'backlog', pasos: '' },
  { archivo: 'captura-cliente.png', vista: 'cliente', pasos: 'pestana("Hitos de pago")' },
  { archivo: 'captura-roadmap.png', vista: 'backlog', pasos: 'pestana("Roadmap")' },
  { archivo: 'captura-sprint.png', vista: 'sprint', pasos: '' },
];

const servidor = await servir();
const base = `http://127.0.0.1:${servidor.address().port}`;
const navegador = await abrir(`${base}/index.html?prueba#notas`);
try {
  await navegador.enviar('Emulation.setDeviceMetricsOverride', { width: 1280, height: 820, deviceScaleFactor: 1, mobile: false });
  await navegador.enviar('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
  await pausa(1500);
  // Importa el proyecto de ejemplo como lo haría una persona, desde Ajustes
  const importado = await navegador.evaluar(`(async () => {
    const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
    location.hash = 'ajustes'; await pausa(400);
    const datos = await (await fetch('/docs/ejemplo/pasteleria-carla.json')).text();
    const entrada = document.getElementById('importar');
    const dt = new DataTransfer();
    dt.items.add(new File([datos], 'pasteleria-carla.json', { type: 'application/json' }));
    entrada.files = dt.files;
    entrada.dispatchEvent(new Event('change'));
    await pausa(1200);
    return document.querySelector('#proyecto-activo option:checked')?.textContent;
  })()`);
  console.log(`Proyecto cargado: ${importado}`);

  for (const c of CAPTURAS) {
    await navegador.evaluar(`(async () => {
      const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
      const pestana = async (t) => { [...document.querySelectorAll('.pestana')].find((b) => b.textContent === t)?.click(); await pausa(300); };
      const abrirPrimera = async () => { document.querySelector('.tarjeta-abrir')?.click(); await pausa(300); };
      location.hash = '${c.vista}'; await pausa(500);
      ${c.pasos ? `await ${c.pasos};` : ''}
      document.getElementById('avisos').replaceChildren();
      window.scrollTo(0, 0); await pausa(200);
    })()`);
    const { data } = await navegador.enviar('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1280, height: 820, scale: 1 } });
    await writeFile(join(RAIZ, 'docs', 'img', c.archivo), Buffer.from(data, 'base64'));
    console.log(`Captura: docs/img/${c.archivo}`);
  }
} finally {
  await navegador.cerrar();
  servidor.close();
}
