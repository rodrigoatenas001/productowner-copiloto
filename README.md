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
npm test          # lógica (node --test)
npm run test:ui   # interfaz: recorre la app real en Chrome o Edge sin ventana
```

Las pruebas de interfaz también se pueden ver en vivo abriendo `tests/ui.html` con el servidor local. Usan una base de datos aparte (`?prueba`), así que no tocan tus proyectos.

Al publicar una versión nueva, cambia `VERSION` en `sw.js` para que los navegadores descarguen los archivos nuevos.

Reglas de la casa: el DOM se construye con nodos (nunca `innerHTML` con datos del usuario), sin estilos en línea, accesible con teclado y lector de pantalla, y todo texto de la interfaz en español claro.

## Licencia

[MIT](LICENSE). Úsalo, cámbialo y compártelo.
