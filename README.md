# Copiloto PO

De tus notas a historias de usuario, backlog y sprints. Libre (MIT), sin cuentas, sin servidor y sin conexión.

Pensado para Product Owners y equipos independientes que no quieren pagar una herramienta grande ni entregar sus datos a nadie. Es parte de la comunidad de [ProductOwner.cl](https://productowner.cl).

## Qué hace

- **Notas → historias.** Pegas lo que anotaste en una reunión y lo convierte en historias "Como… quiero… para…", con épicas según tus títulos y un criterio de aceptación de partida.
- **Revisión INVEST.** Cada historia muestra qué le falta: el beneficio, un rol concreto, palabras que no se pueden verificar ("rápido", "fácil"), varias metas en una, criterios de aceptación o una estimación demasiado grande.
- **Backlog priorizado.** El orden es la prioridad: arrastra o usa las flechas. Puntos (Fibonacci), prioridad MoSCoW, épicas con su avance y búsqueda.
- **Estimar en equipo.** Planning poker en una sola pantalla: cada persona elige su carta sin ver las demás, se revelan juntas y el copiloto sugiere el valor o pide conversar si hay mucha diferencia.
- **Sprints.** Capacidad, sugerencia automática según prioridad y capacidad, tablero Por hacer / En curso / Hecho, burndown y velocidad de los últimos sprints.
- **Priorizar con números.** WSJF o RICE por historia, orden del backlog por puntaje (con deshacer) y matriz valor/esfuerzo: victorias rápidas, apuestas grandes, relleno y trampas de tiempo.
- **Revisión en dos voces.** Una IA revisa como QA o desarrollo y otra corrige como PO; las reglas INVEST deciden si hace falta otra vuelta (máximo 2). Puedes usar dos IAs distintas, por ejemplo Ollama para redactar y una API para revisar. Ves la conversación, el antes y el después, y decides.
- **Casos borde y métricas.** Según de qué trata la historia (formularios, pagos, archivos, búsquedas, fechas, avisos) propone los escenarios no felices en formato Dado/Cuando/Entonces, y cuando detecta palabras vagas ("rápido", "fácil"…) sugiere cómo medirlas, también en los criterios.
- **Objetivos e hipótesis.** OKR del proyecto, hipótesis de valor por épica ("Creemos que al… lograremos… lo sabremos cuando…") y aviso de resultados clave sin trabajo asociado o épicas que no aportan a ningún objetivo. Aparecen en los reportes y en las especificaciones.
- **Dividir y mejorar.** Las historias que piden varias cosas se dividen en un clic (por sus partes o con IA), y la IA puede proponer criterios de aceptación con casos de error.
- **Deshacer y respaldo.** Eliminar, dividir o cerrar un sprint se puede deshacer, y el copiloto te recuerda descargar un respaldo cuando tienes trabajo sin respaldar.
- **Definition of Ready y Done.** Listas del equipo, editables, que cada historia marca en el backlog y en el tablero; avisa si algo pasa a Hecho sin cumplir la DoD.
- **Mapa de historias.** Épicas en columnas y versiones en filas; arrastra para decidir qué entra en la primera versión.
- **Retrospectiva.** Notas anónimas en tres columnas, votos, acciones con responsable y revisión de las acciones pendientes de la retro anterior.
- **Taller para cursos y equipos.** Trivia tipo Kahoot para proyectar (Scrum, PO, historias, estimación, Jira y agilidad; puntaje por rapidez y racha; preguntas propias por JSON) y ejercicios de historias de usuario sobre casos reales, con retroalimentación INVEST inmediata.
- **Reportes en Markdown.** Reporte de sprint, avance por épica, retrospectiva y notas de versión, para copiar o descargar. Y la **especificación para agente**: una historia o épica lista para pegar en Claude Code, Antigravity o Cursor, con criterios, Definition of Done, lo que queda fuera de alcance e instrucciones para no implementar de más.
- **Objetivo del sprint y notas de versión.** Borrador del objetivo a partir de las historias elegidas (con reglas o con IA) y notas de versión reescritas por la IA para usuarios finales, editables antes de publicar.
- **GitHub y Linear.** Cada historia se abre como issue nueva, ya completa con criterios y DoD, con un clic (sin tokens: tú revisas y creas), o se copia en Markdown.
- **Importar y exportar.** Trae tu backlog desde un CSV de Jira o Excel; exporta a Markdown, CSV para Excel y CSV para Jira con épicas enlazadas y sprints, más una guía rápida de JQL. Respaldo completo en JSON.
- **IA opcional y tuya.** Funciona completo sin IA. Si quieres, conecta [Ollama](https://ollama.com) en tu equipo (gratis y privado) o tu propia clave de un servicio compatible con OpenAI o de Anthropic.

## Con equipos

Está pensado para una persona o para un equipo **mirando la misma pantalla** (presencial o compartiendo pantalla): planificar, estimar, la retro y la trivia funcionan así. No sincroniza entre equipos distintos porque no hay servidor; para pasar un proyecto, se descarga el respaldo y se importa en el otro navegador.

## Privacidad

- **Copiloto PO no recopila datos.** No tiene servidor, cuentas, cookies ni analítica: todo lo que escribes se guarda en tu navegador (IndexedDB) y no se envía a nadie.
- La única excepción es la IA, si tú la conectas: tus notas viajan **solo** al servicio que configuraste y solo cuando usas una función con IA. La clave queda guardada en tu navegador. Con Ollama, nada sale de tu equipo.
- Quien publica la página (GitHub Pages, tu propio GitHub o tu servidor) puede registrar visitas técnicas, como cualquier sitio web, bajo sus propias políticas. Usarlo desde el ZIP en tu equipo evita incluso eso.
- Los datos del navegador se pueden borrar (limpieza, otro equipo, modo privado): descarga un respaldo desde Ajustes de vez en cuando.

## Usarlo

Hay tres formas; los datos son los mismos en todas: se guardan en el navegador que uses.

### 1. En línea, sin instalar nada

Ábrelo en **https://rodrigoatenas001.github.io/productowner-copiloto/**. En Chrome o Edge, usa **Instalar aplicación** para tenerlo como programa y usarlo sin conexión.

### 2. Descargado en tu equipo

1. Descarga el ZIP de la última versión en [Releases](https://github.com/rodrigoatenas001/productowner-copiloto/releases/latest) y descomprímelo en una carpeta fija (por ejemplo, Documentos).
2. Ábrelo:
   - **Windows:** doble clic en **`Abrir Copiloto PO.bat`**. No necesita instalar nada.
   - **Mac:** doble clic en **`abrir-copiloto.command`**. La primera vez, macOS puede pedir permiso: clic derecho → Abrir → Abrir. Usa Python 3 (si no lo tienes, el lanzador te dice cómo instalarlo).
   - **Linux:** `sh abrir-copiloto.command`.
3. Se abre el navegador en `http://localhost:8765`. Deja la ventana del lanzador abierta mientras lo usas.

Importante: usa siempre el mismo lanzador y no cambies el puerto. El navegador guarda tus proyectos asociados a esa dirección exacta; si cambia, parecerá que desaparecieron (siguen ahí, en la dirección anterior). Para pasar tus proyectos a otra dirección o equipo, usa el respaldo de Ajustes.

¿Por qué no basta con doble clic en `index.html`? Por seguridad, los navegadores no cargan módulos de JavaScript desde archivos sueltos. El lanzador levanta un servidor mínimo, solo para tu equipo.

### 3. Tu propia copia en GitHub

Para tener tu versión en línea, bajo tu control:

1. Inicia sesión en GitHub y presiona **Fork** en este repositorio.
2. En tu copia: **Settings → Pages**.
3. En "Build and deployment", elige **Deploy from a branch**, rama **main** y carpeta **/ (root)**. Guarda.
4. En uno o dos minutos estará en `https://TU-USUARIO.github.io/productowner-copiloto/`.

Para recibir mejoras, en tu copia usa **Sync fork**. Es gratis para repositorios públicos.

### Usar Ollama

```bash
ollama pull llama3.1
OLLAMA_ORIGINS=http://localhost:8765 ollama serve
```

Cambia `OLLAMA_ORIGINS` por la dirección desde donde abres Copiloto PO (por ejemplo, `https://rodrigoatenas001.github.io` si lo usas en línea). En Ajustes → IA elige "Ollama", deja la dirección `http://localhost:11434` y presiona "Probar conexión".

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
npm test          # lógica (node --test)
npm run test:ui   # interfaz: recorre la app real en Chrome o Edge sin ventana
```

Las pruebas de interfaz también se pueden ver en vivo abriendo `tests/ui.html` con el servidor local. Usan una base de datos aparte (`?prueba`), así que no tocan tus proyectos.

Al publicar una versión nueva, cambia `VERSION` en `sw.js` para que los navegadores descarguen los archivos nuevos.

Reglas de la casa: el DOM se construye con nodos (nunca `innerHTML` con datos del usuario), sin estilos en línea, accesible con teclado y lector de pantalla, y todo texto de la interfaz en español claro.

## Licencia

[MIT](LICENSE). Úsalo, cámbialo y compártelo.
