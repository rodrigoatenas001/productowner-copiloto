// (No se llama test-*.mjs para que `node --test` no lo ejecute como prueba.)
// Corre las pruebas de interfaz (tests/ui.html) en Chrome o Edge sin ventana. Sin dependencias:
// un servidor estático de Node y el protocolo de depuración del navegador (WebSocket incluido en Node 22+).
// Uso: npm run test:ui   (o CHROME=/ruta/al/navegador npm run test:ui)
import { createServer } from 'node:http';
import { readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(fileURLToPath(new URL('..', import.meta.url)));
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png',
};
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

function servir() {
  const servidor = createServer(async (req, res) => {
    const ruta = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^[/\\]+/, '');
    const archivo = join(RAIZ, ruta || 'index.html');
    if (!archivo.startsWith(RAIZ + sep)) { res.writeHead(403).end(); return; }
    try {
      const cuerpo = await readFile(archivo);
      res.writeHead(200, { 'Content-Type': TIPOS[extname(archivo)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(cuerpo);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((r) => servidor.listen(0, '127.0.0.1', () => r(servidor)));
}

function buscarNavegador() {
  return [
    process.env.CHROME,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge',
  ].filter(Boolean).find((c) => existsSync(c));
}

/** Evalúa una expresión en la página por el protocolo de depuración. */
function cliente(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pendientes = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (pendientes.has(m.id)) { pendientes.get(m.id)(m.result); pendientes.delete(m.id); }
  };
  const listo = new Promise((r, x) => { ws.onopen = r; ws.onerror = x; });
  const evaluar = async (expresion) => {
    await listo;
    id += 1;
    ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression: expresion, returnByValue: true } }));
    return new Promise((r) => pendientes.set(id, (res) => r(res?.result?.value)));
  };
  return { evaluar, cerrar: () => ws.close() };
}

async function main() {
  const navegador = buscarNavegador();
  if (!navegador) {
    console.error('No encontré Chrome ni Edge. Indica la ruta con CHROME=/ruta/al/navegador, o abre tests/ui.html en el navegador.');
    process.exit(2);
  }
  const servidor = await servir();
  const url = `http://127.0.0.1:${servidor.address().port}/tests/ui.html`;
  const perfil = join(RAIZ, `.perfil-pruebas-${Date.now()}`);
  const puerto = 9300 + Math.floor(Math.random() * 500);
  const proceso = spawn(navegador, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--user-data-dir=${perfil}`, `--remote-debugging-port=${puerto}`, '--window-size=1280,900', url], { stdio: 'ignore' });

  let codigo = 1;
  try {
    let pagina = null;
    for (let i = 0; i < 60 && !pagina; i++) {
      await pausa(500);
      try {
        const lista = await (await fetch(`http://127.0.0.1:${puerto}/json/list`)).json();
        pagina = lista.find((p) => p.type === 'page' && p.url.startsWith(url));
      } catch { /* el navegador aún no abre el puerto */ }
    }
    if (!pagina) throw new Error('El navegador no abrió la página de pruebas.');

    const { evaluar, cerrar } = cliente(pagina.webSocketDebuggerUrl);
    let titulo = '';
    const fin = Date.now() + 240000;
    while (Date.now() < fin && !/^(OK|FALLA)/.test(titulo)) {
      await pausa(1000);
      titulo = (await evaluar('document.title')) || '';
    }
    const lineas = (await evaluar('[...document.querySelectorAll("#lista li")].map((l) => l.textContent)')) || [];
    cerrar();
    lineas.forEach((l) => console.log(l));
    if (!/^(OK|FALLA)/.test(titulo)) throw new Error('Las pruebas no terminaron a tiempo.');
    const fallas = lineas.filter((l) => l.startsWith('✖')).length;
    console.log(`\n${lineas.length - fallas} de ${lineas.length} pruebas de interfaz pasaron.`);
    codigo = fallas ? 1 : 0;
  } catch (e) {
    console.error(e.message);
  } finally {
    proceso.kill();
    servidor.close();
    await pausa(500);
    await rm(perfil, { recursive: true, force: true }).catch(() => {});
  }
  process.exit(codigo);
}

main();
