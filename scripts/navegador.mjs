// Utilidades compartidas por las pruebas de interfaz y las capturas del README:
// servidor estático de Node y control de Chrome/Edge sin ventana por el protocolo de depuración.
import { createServer } from 'node:http';
import { readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ = resolve(fileURLToPath(new URL('..', import.meta.url)));
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png',
};
export const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

export function servir() {
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

export function buscarNavegador() {
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

/**
 * Abre el navegador sin ventana en una URL y devuelve un cliente del protocolo de depuración.
 * @returns {Promise<{enviar: (metodo: string, params?: object) => Promise<object>, evaluar: (expr: string) => Promise<any>, cerrar: () => Promise<void>}>}
 */
export async function abrir(url, { ancho = 1280, alto = 900 } = {}) {
  const navegador = buscarNavegador();
  if (!navegador) throw new Error('No encontré Chrome ni Edge. Indica la ruta con CHROME=/ruta/al/navegador.');
  const perfil = join(RAIZ, `.perfil-pruebas-${Date.now()}`);
  const puerto = 9300 + Math.floor(Math.random() * 500);
  const proceso = spawn(navegador, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars',
    `--user-data-dir=${perfil}`, `--remote-debugging-port=${puerto}`, `--window-size=${ancho},${alto}`, url], { stdio: 'ignore' });

  let pagina = null;
  for (let i = 0; i < 60 && !pagina; i++) {
    await pausa(500);
    try {
      const lista = await (await fetch(`http://127.0.0.1:${puerto}/json/list`)).json();
      pagina = lista.find((p) => p.type === 'page' && p.url.startsWith(url.split('#')[0].split('?')[0]));
    } catch { /* el navegador aún no abre el puerto */ }
  }
  if (!pagina) { proceso.kill(); throw new Error('El navegador no abrió la página.'); }

  const ws = new WebSocket(pagina.webSocketDebuggerUrl);
  let id = 0;
  const pendientes = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (pendientes.has(m.id)) { pendientes.get(m.id)(m.result); pendientes.delete(m.id); }
  };
  await new Promise((r, x) => { ws.onopen = r; ws.onerror = x; });
  const enviar = (method, params = {}) => {
    id += 1;
    ws.send(JSON.stringify({ id, method, params }));
    return new Promise((r) => pendientes.set(id, r));
  };
  const evaluar = async (expression) => (await enviar('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }))?.result?.value;
  const cerrar = async () => {
    ws.close();
    proceso.kill();
    await pausa(800);
    await rm(perfil, { recursive: true, force: true }).catch(() => {});
  };
  return { enviar, evaluar, cerrar };
}
