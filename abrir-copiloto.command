#!/bin/sh
# Abre Copiloto PO en tu navegador, desde este equipo y sin internet (Mac y Linux).
# En Mac: doble clic. En Linux: sh abrir-copiloto.command
# Deja esta ventana abierta mientras lo usas; ciérrala (o Ctrl+C) para terminar.
# Usa siempre el puerto 8765: el navegador guarda tus proyectos asociados a esa dirección.
cd "$(dirname "$0")" || exit 1
PUERTO=8765
DIRECCION="http://localhost:$PUERTO/"

abrir_navegador() {
  if command -v open >/dev/null 2>&1; then open "$DIRECCION"
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$DIRECCION" >/dev/null 2>&1
  else echo "Abre esta dirección en tu navegador: $DIRECCION"
  fi
}

# Si ya está abierto, solo abre el navegador
if command -v curl >/dev/null 2>&1 && curl -s -o /dev/null "$DIRECCION"; then
  echo "Copiloto PO ya está abierto en $DIRECCION"
  abrir_navegador
  exit 0
fi

echo ""
echo "  Copiloto PO está abierto en: $DIRECCION"
echo "  Deja esta ventana abierta mientras lo usas. Para terminar, ciérrala o presiona Ctrl+C."
echo ""
(sleep 1 && abrir_navegador) &

if command -v python3 >/dev/null 2>&1; then
  exec python3 -m http.server "$PUERTO" --bind 127.0.0.1
elif command -v node >/dev/null 2>&1; then
  exec node -e "
    const http = require('http'), fs = require('fs'), path = require('path');
    const tipos = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
      '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png' };
    const raiz = process.cwd();
    http.createServer((req, res) => {
      const ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
      const archivo = path.resolve(raiz, ruta);
      if (!archivo.startsWith(raiz + path.sep) || /(^|\/)\./.test(ruta)) { res.writeHead(403); return res.end(); }
      fs.readFile(archivo, (e, datos) => {
        if (e) { res.writeHead(404); return res.end(); }
        res.writeHead(200, { 'Content-Type': tipos[path.extname(archivo)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
        res.end(datos);
      });
    }).listen($PUERTO, '127.0.0.1');
  "
elif command -v ruby >/dev/null 2>&1; then
  exec ruby -run -e httpd . -p "$PUERTO" -b 127.0.0.1
else
  echo "No encontré Python 3, Node ni Ruby para abrir el servidor local."
  echo "En Mac, instala Python desde https://www.python.org/downloads/ y vuelve a intentarlo."
  exit 1
fi
