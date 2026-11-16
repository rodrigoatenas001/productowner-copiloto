// Servidor de salas del Copiloto PO para Cloudflare Workers + Durable Objects.
// Cada proyecto compartido es una sala (un Durable Object) que guarda la última versión cifrada
// y la reenvía por WebSocket. La clave nunca llega aquí: va en el enlace, después del «#».
import { DurableObject } from 'cloudflare:workers';
import { procesar, partir, ID_SALA } from './protocolo.js';

const permitido = (env, origen) => {
  const lista = String(env.ORIGENES || '').split(',').map((x) => x.trim()).filter(Boolean);
  return !lista.length || lista.includes(origen);
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origen = request.headers.get('Origin') || '';
    const cors = { 'Access-Control-Allow-Origin': origen || '*', Vary: 'Origin' };
    if (url.pathname === '/' || url.pathname === '/salud') {
      return Response.json({ servicio: 'copiloto-po-salas', ok: true }, { headers: cors });
    }
    const m = /^\/sala\/([^/]+)$/.exec(url.pathname);
    if (!m || !ID_SALA.test(m[1])) return new Response('No encontrado', { status: 404, headers: cors });
    if (!permitido(env, origen)) return new Response('Origen no permitido', { status: 403, headers: cors });
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Se espera un WebSocket', { status: 426, headers: cors });
    return env.SALAS.get(env.SALAS.idFromName(m[1])).fetch(request);
  },
};

export class Sala extends DurableObject {
  async fetch() {
    const par = new WebSocketPair();
    // Hibernación: la sala no cobra tiempo mientras nadie escribe
    this.ctx.acceptWebSocket(par[1]);
    return new Response(null, { status: 101, webSocket: par[0] });
  }

  async leer() {
    if (this.estado) return this.estado;
    const version = (await this.ctx.storage.get('version')) || 0;
    const n = (await this.ctx.storage.get('partes')) || 0;
    let datos = null;
    if (n) {
      const mapa = await this.ctx.storage.get(Array.from({ length: n }, (_, i) => `p${i}`));
      datos = Array.from({ length: n }, (_, i) => mapa.get(`p${i}`)).join('');
    }
    this.estado = { version, datos };
    return this.estado;
  }

  async escribir(estado) {
    const partes = partir(estado.datos);
    const anterior = (await this.ctx.storage.get('partes')) || 0;
    const valores = { version: estado.version, partes: partes.length };
    partes.forEach((p, i) => { valores[`p${i}`] = p; });
    await this.ctx.storage.put(valores);
    if (anterior > partes.length) await this.ctx.storage.delete(Array.from({ length: anterior - partes.length }, (_, i) => `p${partes.length + i}`));
    this.estado = estado;
  }

  async webSocketMessage(ws, mensaje) {
    if (typeof mensaje !== 'string') return;
    const r = procesar(await this.leer(), mensaje);
    if (r.estado) await this.escribir(r.estado);
    if (r.responder) ws.send(JSON.stringify(r.responder));
    if (r.difundir) {
      const texto = JSON.stringify(r.difundir);
      for (const otro of this.ctx.getWebSockets()) if (otro !== ws) { try { otro.send(texto); } catch { /* ya se fue */ } }
    }
  }

  webSocketClose(ws, codigo) {
    try { ws.close(codigo, 'chao'); } catch { /* ya cerrado */ }
  }
}
