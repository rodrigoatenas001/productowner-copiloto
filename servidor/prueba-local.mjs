// Prueba del servidor de salas con dos clientes: node servidor/prueba-local.mjs [http://127.0.0.1:8787]
import { nuevaSala, cifrar, descifrar, urlSocket } from '../js/nucleo/sala.js';
import { mezclar } from '../js/nucleo/mezcla.js';

const servidor = process.argv[2] || 'http://127.0.0.1:8787';
const { sala, clave } = nuevaSala();
const abrir = () => new Promise((ok, mal) => {
  const ws = new WebSocket(urlSocket(servidor, sala));
  const cola = [];
  let espera = null;
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (espera) { const r = espera; espera = null; r(m); } else cola.push(m); };
  ws.siguiente = () => (cola.length ? Promise.resolve(cola.shift()) : new Promise((r) => { espera = r; }));
  ws.onopen = () => ok(ws);
  ws.onerror = mal;
});
const enviar = (ws, m) => ws.send(JSON.stringify(m));
const verificar = (c, texto) => { if (!c) { console.error('FALLA:', texto); process.exit(1); } console.log('ok -', texto); };

console.log((await (await fetch(`${servidor}/salud`)).json()));
const a = await abrir();
const b = await abrir();
enviar(a, { t: 'hola' });
verificar((await a.siguiente()).version === 0, 'sala nueva vacía');
const base = { id: 'p1', historias: [{ id: 'h1', titulo: 'Uno' }] };
enviar(a, { t: 'guardar', base: 0, datos: await cifrar(clave, base) });
verificar((await a.siguiente()).t === 'ok', 'A guarda la versión 1');
const aviso = await b.siguiente();
verificar(aviso.t === 'nuevo' && (await descifrar(clave, aviso.datos)).historias[0].titulo === 'Uno', 'B recibe la versión 1 al momento');
// B guarda sobre una versión vieja: rechazo, mezcla y reintento
enviar(a, { t: 'guardar', base: 1, datos: await cifrar(clave, { ...base, historias: [{ id: 'h1', titulo: 'Uno A' }] }) });
await a.siguiente(); await b.siguiente();
const deB = { ...base, historias: [...base.historias, { id: 'h2', titulo: 'Dos B' }] };
enviar(b, { t: 'guardar', base: 1, datos: await cifrar(clave, deB) });
const rechazo = await b.siguiente();
verificar(rechazo.t === 'rechazo' && rechazo.version === 2, 'B guardó tarde: rechazo con la versión 2');
const mezcla = mezclar(base, deB, await descifrar(clave, rechazo.datos));
enviar(b, { t: 'guardar', base: 2, datos: await cifrar(clave, mezcla) });
verificar((await b.siguiente()).t === 'ok', 'B guarda la mezcla');
const final = await descifrar(clave, (await a.siguiente()).datos);
verificar(final.historias.map((x) => x.titulo).join('|') === 'Uno A|Dos B', 'A ve los dos cambios');
// Reabrir la sala: el servidor recuerda la última versión, y en partes si es grande
const grande = { id: 'p1', historias: Array.from({ length: 4000 }, (_, i) => ({ id: `h${i}`, titulo: crypto.randomUUID() })) };
enviar(a, { t: 'guardar', base: 3, datos: await cifrar(clave, grande) });
await a.siguiente();
a.close(); b.close();
const c = await abrir();
enviar(c, { t: 'hola' });
const estado = await c.siguiente();
verificar(estado.version === 4 && estado.datos.length > 100_000 && (await descifrar(clave, estado.datos)).historias.length === 4000, `persistió la versión 4 (${Math.round(estado.datos.length / 1024)} KB cifrados, en partes)`);
c.close();
