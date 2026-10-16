# Copiloto PO

De tus notas a historias de usuario, backlog y sprints. Libre (MIT), sin cuentas, sin servidor y sin conexión.

Pensado para Product Owners y equipos independientes que no quieren pagar una herramienta grande ni entregar sus datos a nadie. Es parte de la comunidad de [ProductOwner.cl](https://productowner.cl).

## Qué hace

- **Notas → historias.** Pegas lo que anotaste en una reunión y lo convierte en historias "Como… quiero… para…", con épicas según tus títulos y un criterio de aceptación de partida.
- **Revisión INVEST.** Cada historia muestra qué le falta: el beneficio, un rol concreto, palabras que no se pueden verificar ("rápido", "fácil"), varias metas en una, criterios de aceptación o una estimación demasiado grande.
- **Backlog priorizado.** El orden es la prioridad: arrastra o usa las flechas. Puntos (Fibonacci), prioridad MoSCoW, épicas y búsqueda.
- **Sprints.** Capacidad, sugerencia automática según prioridad y capacidad, tablero Por hacer / En curso / Hecho, burndown y velocidad de los últimos sprints.
- **Dividir y mejorar.** Las historias que piden varias cosas se dividen en un clic (por sus partes o con IA), y la IA puede proponer criterios de aceptación con casos de error.
- **Deshacer y respaldo.** Eliminar, dividir o cerrar un sprint se puede deshacer, y el copiloto te recuerda descargar un respaldo cuando tienes trabajo sin respaldar.
- **Exportación.** Markdown, CSV para Excel y CSV listo para importar en Jira. Respaldo completo en JSON.
- **IA opcional y tuya.** Funciona completo sin IA. Si quieres, conecta [Ollama](https://ollama.com) en tu equipo (gratis y privado) o tu propia clave de un servicio compatible con OpenAI o de Anthropic.

## Privacidad

- Todo se guarda en tu navegador (IndexedDB). No hay servidor, cuentas ni analítica.
- Si conectas una IA, tus notas viajan **solo** a ese servicio y solo cuando presionas "Convertir con IA". La clave queda guardada en tu navegador.
- Los datos del navegador se pueden borrar (limpieza, otro equipo, modo privado): descarga un respaldo desde Ajustes de vez en cuando.

## Usarlo

Ábrelo en **https://rodrigoatenas001.github.io/productowner-copiloto/** y, en Chrome o Edge, usa **Instalar aplicación** para tenerlo como programa y usarlo sin conexión.

Para correrlo en tu equipo basta un servidor estático (los módulos de JavaScript no cargan con doble clic sobre el archivo):

```bash
python -m http.server 8080
```

y abre http://localhost:8080.

### Usar Ollama

```bash
ollama pull llama3.1
OLLAMA_ORIGINS=https://la-direccion-del-copiloto ollama serve
```

En Ajustes → IA elige "Ollama", deja la dirección `http://localhost:11434` y presiona "Probar conexión".

## Desarrollo

Sin dependencias ni paso de compilación: HTML, CSS y módulos de JavaScript.

```
index.html, sw.js, manifest.webmanifest
css/app.css
js/app.js          estado, navegación y guardado
js/almacen.js      IndexedDB
js/ia.js           conexión opcional con IA
js/nucleo/         lógica pura (historias, INVEST, sprints, exportación), probada con node --test
js/ui/             vistas: notas, backlog, sprint, ajustes
tests/
```

```bash
npm test        # o: node --test
```

Al publicar una versión nueva, cambia `VERSION` en `sw.js` para que los navegadores descarguen los archivos nuevos.

Reglas de la casa: el DOM se construye con nodos (nunca `innerHTML` con datos del usuario), sin estilos en línea, accesible con teclado y lector de pantalla, y todo texto de la interfaz en español claro.

## Licencia

[MIT](LICENSE). Úsalo, cámbialo y compártelo.
