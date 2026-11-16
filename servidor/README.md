# Servidor del equipo (Cloudflare)

Con este servidor, el Copiloto PO deja trabajar a varias personas en el mismo proyecto, cada una desde su ciudad: lo que cambia una persona aparece en las demás al momento.

- **Es tuyo.** Se instala en tu propia cuenta de Cloudflare, no en la nuestra. Nadie más administra tus datos.
- **No puede leer tus proyectos.** Todo viaja y se guarda cifrado (AES-256). La clave va en el enlace de invitación, después del `#`, y los navegadores nunca envían esa parte al servidor.
- **Gratis para un equipo normal.** Usa Workers y Durable Objects, que están en el plan gratuito de Cloudflare. Un equipo de 10 personas trabajando todo el día queda muy por debajo del límite.

## Instalarlo (una vez, unos 10 minutos)

Necesitas una cuenta gratuita en [cloudflare.com](https://dash.cloudflare.com/sign-up) y [Node.js](https://nodejs.org) instalado.

1. Descarga este repositorio (botón verde «Code» › «Download ZIP») y descomprímelo.
2. Abre una terminal en la carpeta `servidor`.
3. Ejecuta:

   ```bash
   npx wrangler login
   ```

   Se abre el navegador para que autorices a Wrangler (la herramienta oficial de Cloudflare) en tu cuenta.

4. Ejecuta:

   ```bash
   npx wrangler deploy
   ```

   Al terminar, muestra una dirección como `https://copiloto-po-salas.tu-cuenta.workers.dev`. Ese es tu servidor.

5. En el Copiloto PO: **Ajustes › Trabajar en equipo en tiempo real**, pega esa dirección y presiona «Probar el servidor».

## Usarlo

1. Abre tu proyecto y presiona **Compartir este proyecto**.
2. Copia el enlace de invitación y envíaselo a tu equipo por un canal privado.
3. Quien abre el enlace escribe su nombre y entra al proyecto. Abajo a la izquierda se ve quién está en línea.

Cada persona sigue teniendo su copia en su navegador: si se corta internet, sigue trabajando y al volver se mezclan los cambios. La mezcla es historia por historia y campo por campo; si dos personas cambian el mismo campo al mismo tiempo, queda el último que guardó.

**Si alguien deja el equipo**, presiona «Crear enlace nuevo» y envíalo solo a quienes siguen: el enlace anterior deja de recibir cambios.

## Opcional: aceptar solo tu copiloto

Por defecto el servidor acepta conexiones desde cualquier página. Para limitarlo a la dirección donde usas el copiloto, edita `wrangler.toml`:

```toml
[vars]
ORIGENES = "https://rodrigoatenas001.github.io"
```

y vuelve a ejecutar `npx wrangler deploy`.

## Probarlo en tu equipo

```bash
npx wrangler dev --port 8787
```

En otra terminal, desde la carpeta del repositorio:

```bash
node servidor/prueba-local.mjs http://127.0.0.1:8787
```

## Cómo funciona

- Cada proyecto compartido es una «sala»: un Durable Object que guarda la última versión cifrada y su número, y la reenvía por WebSocket a quienes están conectados.
- Para guardar, el navegador dice sobre qué versión trabajó. Si alguien guardó antes, el servidor lo rechaza con la versión nueva; el navegador mezcla (`js/nucleo/mezcla.js`) y vuelve a enviar. Así nunca se pierde el trabajo de nadie.
- Las reglas de la sala están en `src/protocolo.js` y se prueban con `npm test` desde la carpeta principal.
