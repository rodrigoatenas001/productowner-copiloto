// Pruebas de interfaz: recorren la aplicación real dentro de un iframe, como lo haría una persona.
// Se abren en el navegador (tests/ui.html) o sin ventana con `npm run test:ui`.

const marco = document.getElementById('app');
const lista = document.getElementById('lista');
const resultados = [];

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
const doc = () => marco.contentDocument;
const ventana = () => marco.contentWindow;
const todos = (sel) => [...doc().querySelectorAll(sel)];
const uno = (sel) => doc().querySelector(sel);

async function esperar(condicion, descripcion, ms = 4000) {
  const fin = Date.now() + ms;
  while (Date.now() < fin) {
    try { if (condicion()) return; } catch { /* aún no existe */ }
    await pausa(40);
  }
  throw new Error(`No ocurrió: ${descripcion}`);
}

function boton(texto) {
  const b = todos('button, a, label').find((x) => x.textContent.trim() === texto || x.getAttribute('aria-label') === texto);
  if (!b) throw new Error(`No hay botón "${texto}"`);
  return b;
}
async function clic(texto) { boton(texto).click(); await pausa(80); }
const ir = async (vista) => { uno(`#navegacion a[href="#${vista}"]`).click(); await pausa(80); };
const pestana = async (texto) => { todos('.pestana').find((b) => b.textContent === texto).click(); await pausa(80); };
function escribir(el, valor, evento = 'input') { el.value = valor; el.dispatchEvent(new Event(evento, { bubbles: true })); }
function igual(actual, esperado, que) { if (actual !== esperado) throw new Error(`${que}: se esperaba ${JSON.stringify(esperado)} y fue ${JSON.stringify(actual)}`); }
function verdad(cond, que) { if (!cond) throw new Error(que); }

let copiado = '';
let abiertas = [];
let responderDialogos = true;

async function cargar(ruta = '#notas') {
  marco.src = `../index.html?prueba&carga=${Date.now()}${ruta}`; // cambia la dirección para forzar una recarga real
  await new Promise((r) => { marco.onload = r; });
  await esperar(() => uno('#navegacion nav'), 'la aplicación cargó');
  const w = ventana();
  // Sin efectos externos: IA simulada, portapapeles, ventanas y diálogos
  Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async (t) => { copiado = t; } }, configurable: true });
  w.open = (url) => { abiertas.push(url); };
  w.confirm = () => true;
  w.prompt = () => 'Proyecto de prueba';
  // Diálogos propios de la app: se responden solos, como antes confirm/prompt
  new w.MutationObserver(() => {
    const d = doc().querySelector('dialog.dialogo-pregunta[open]:not(.respondido)');
    if (!d || !responderDialogos) return;
    d.classList.add('respondido');
    const entrada = d.querySelector('input');
    if (entrada) entrada.value = 'Proyecto de prueba';
    d.querySelector('[type=submit]').click();
  }).observe(doc().body, { childList: true });
  const fetchReal = w.fetch.bind(w);
  w.fetch = async (_url, op) => {
    if (!op?.body) return fetchReal(_url, op); // archivos de la app (por ejemplo, el proyecto de ejemplo)
    const c = JSON.parse(op.body);
    const sistema = c.system || c.messages[0].content;
    const usuario = c.messages[c.messages.length - 1].content;
    let r = { ok: true };
    if (sistema.includes('QA y desarrollo')) r = usuario.includes('menos de 2 segundos') ? { aprobada: true, observaciones: [] } : { aprobada: false, observaciones: ['"rápido" no se puede probar'] };
    else if (sistema.includes('Corrige la historia')) r = { rol: 'clienta', quiero: 'iniciar sesión en menos de 2 segundos', para: 'comprar sin esperas', criterios: ['Dado…', 'Dado un error…'] };
    else if (sistema.includes('historias de usuario de calidad')) r = { historias: [{ rol: 'contadora', quiero: 'bajar boletas', para: 'declarar', criterios: ['Dado…'] }] };
    return new w.Response(JSON.stringify({ message: { content: JSON.stringify(r) } }), { status: 200 });
  };
}

const PRUEBAS = [
  ['Notas → historias → backlog', async () => {
    await clic('Probar con un ejemplo');
    await clic('Convertir en historias');
    await esperar(() => todos('.candidata').length === 5, '5 historias propuestas');
    todos('button').find((b) => b.textContent.startsWith('Agregar')).click();
    await esperar(() => todos('.tarjeta').length === 5, '5 tarjetas en el backlog');
  }],
  ['Editar una historia y estimar', async () => {
    const pts = [5, 3, 2, 8, 3];
    for (let i = 0; i < 5; i++) {
      todos('.tarjeta-abrir')[i].click();
      await pausa(60);
      escribir(uno('.tarjeta.is-abierta select'), String(pts[i]), 'change');
      await pausa(60);
    }
    igual(todos('.cifra dd')[1].textContent, '21', 'puntos estimados');
  }],
  ['Eliminar y deshacer', async () => {
    if (!uno('.tarjeta.is-abierta')) { todos('.tarjeta-abrir')[0].click(); await pausa(60); }
    await clic('Eliminar');
    igual(todos('.tarjeta').length, 4, 'tarjetas tras eliminar');
    await clic('Deshacer');
    igual(todos('.tarjeta').length, 5, 'tarjetas tras deshacer');
  }],
  ['Casos borde se agregan a los criterios', async () => {
    if (!uno('.tarjeta.is-abierta')) { todos('.tarjeta-abrir')[0].click(); await pausa(60); }
    const antes = uno('.tarjeta.is-abierta textarea').value.split('\n').length;
    todos('.tarjeta.is-abierta button').find((b) => b.textContent.includes('casos borde')).click();
    await pausa(80);
    if (!uno('.tarjeta.is-abierta')) { todos('.tarjeta-abrir')[0].click(); await pausa(60); }
    verdad(uno('.tarjeta.is-abierta textarea').value.split('\n').length > antes, 'aumentan los criterios');
  }],
  ['Los datos sobreviven a recargar', async () => {
    await pausa(600); // guardado con pausa
    await cargar('#backlog');
    await esperar(() => todos('.tarjeta').length === 5, '5 tarjetas tras recargar');
  }],
  ['Sprint: planificar, trabajar y cerrar', async () => {
    await ir('sprint');
    await clic('Planificar un sprint');
    escribir(todos('input[type=number]')[0], '10', 'change');
    await pausa(80);
    await clic('Sugerir según capacidad');
    verdad(uno('.capacidad p').textContent.startsWith('10 de 10'), `capacidad usada: ${uno('.capacidad p').textContent}`);
    await clic('Iniciar sprint');
    uno('.columna--todo .icono').click(); await pausa(60);
    uno('.columna--doing .icono[aria-label^="Mover a Hecho"]').click(); await pausa(60);
    verdad(uno('.columna--done .ficha'), 'una historia en Hecho');
    await clic('Cerrar sprint');
    await esperar(() => uno('.tabla tbody tr'), 'el sprint aparece en el historial');
  }],
  ['Reporte del sprint en Markdown', async () => {
    copiado = '';
    todos('.tabla .compartir-md button')[0].click();
    await esperar(() => copiado.startsWith('# Mi proyecto · Sprint 1'), 'se copió el reporte');
    verdad(copiado.includes('## Terminado'), 'el reporte tiene lo terminado');
  }],
  ['Retrospectiva: nota, voto y acción', async () => {
    await ir('retro');
    await clic('Nueva retrospectiva');
    const ta = uno('[data-columna="mejorar"] textarea');
    ta.value = 'Llegamos tarde a la review';
    ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await esperar(() => uno('.nota-retro'), 'la nota aparece');
    uno('[aria-label^="Votar:"]').click(); await pausa(60);
    escribir(uno('[aria-label="Nueva acción"]'), 'Preparar la review antes');
    await clic('Agregar');
    verdad(uno('.acciones-lista')?.textContent.includes('Preparar la review antes'), 'la acción quedó');
  }],
  ['Trivia: una pregunta completa', async () => {
    await ir('taller');
    await clic('Empezar la trivia');
    await esperar(() => uno('.trivia-pregunta'), 'se muestra una pregunta');
    await clic('Mostrar respuesta');
    verdad(uno('.is-correcta'), 'se revela la correcta');
    todos('.equipos-marcar input')[0].click();
    await clic('Sumar puntos');
    verdad(/[1-9]/.test(todos('.ranking-puntos')[0].textContent), 'el primer equipo suma puntos');
    await clic('Terminar');
    await clic('Nueva trivia');
  }],
  ['Ejercicio de historias con retroalimentación', async () => {
    await pestana('Ejercicios de historias');
    escribir(uno('#respuesta-ejercicio'), 'Como clienta, quiero ver las tortas con su precio, para decidir sin preguntar');
    await clic('Revisar mis historias');
    verdad(/\d+ \/ 100/.test(uno('.puntaje').textContent), 'hay puntaje');
  }],
  ['Importar un CSV de Jira', async () => {
    await ir('ajustes');
    const csv = 'Summary,Status,Story Points,Priority\nPagar en cuotas,To Do,3,High\nVer historial,Done,2,Low\n';
    const entrada = uno('#importar-csv');
    const dt = new (ventana().DataTransfer)();
    dt.items.add(new (ventana().File)([csv], 'jira.csv', { type: 'text/csv' }));
    entrada.files = dt.files;
    entrada.dispatchEvent(new Event('change'));
    await esperar(() => todos('.tarjeta-titulo').some((t) => t.textContent === 'Pagar en cuotas'), 'la historia importada está en el backlog');
  }],
  ['Revisión en dos voces (IA simulada)', async () => {
    await ir('ajustes');
    const s = todos('select').find((x) => [...x.options].some((o) => o.value === 'ollama'));
    escribir(s, 'ollama', 'change');
    await pausa(150);
    await ir('notas');
    escribir(uno('#notas'), '- hacer el login rápido');
    await clic('Convertir en historias');
    todos('button').find((b) => b.textContent.startsWith('Agregar')).click();
    await esperar(() => todos('.tarjeta-titulo').some((t) => t.textContent.startsWith('Hacer el login')), 'historia nueva en el backlog');
    const i = todos('.tarjeta-titulo').findIndex((t) => t.textContent.startsWith('Hacer el login'));
    todos('.tarjeta-abrir')[i].click(); await pausa(60);
    await clic('Revisar en dos voces');
    await esperar(() => todos('button').some((b) => b.textContent === 'Aceptar cambios'), 'termina la revisión');
    await clic('Aceptar cambios');
    await esperar(() => todos('.tarjeta-titulo').some((t) => t.textContent.startsWith('Iniciar sesión')), 'se aplicó la corrección');
  }],
  ['Issue de Linear con un clic', async () => {
    abiertas = [];
    if (!uno('.tarjeta.is-abierta')) { todos('.tarjeta-abrir')[0].click(); await pausa(60); }
    todos('.tarjeta.is-abierta [aria-label="Crear issue"] button').find((b) => b.textContent === 'Linear').click();
    verdad(abiertas[0]?.startsWith('https://linear.new?title='), 'abre linear.new');
  }],
  ['Pronóstico y roadmap tras cerrar un sprint', async () => {
    await ir('backlog');
    await pestana('Épicas');
    verdad(uno('.pronostico')?.textContent.includes('¿Cuándo va a estar?'), 'aparece el pronóstico');
    await pestana('Roadmap');
    escribir(uno('.roadmap textarea'), 'Que las pymes vendan en línea', 'change');
    await pausa(80);
    verdad(todos('.roadmap-epica').length > 0, 'hay épicas en el roadmap');
  }],
  ['Informe para el cliente', async () => {
    copiado = '';
    todos('.compartir-md').find((g) => g.getAttribute('aria-label') === 'Informe para el cliente').querySelector('button').click();
    await esperar(() => copiado.includes('· Informe de avance'), 'se copió el informe');
    verdad(copiado.includes('Que las pymes vendan en línea') && copiado.includes('## Necesitamos de ti'), 'el informe trae visión y pedidos');
  }],
  ['Dependencias en la historia', async () => {
    await pestana('Lista priorizada');
    if (!uno('.tarjeta.is-abierta')) { todos('.tarjeta-abrir')[0].click(); await pausa(60); }
    const sel = uno('[aria-label="Agregar dependencia"]');
    escribir(sel, sel.options[1].value, 'change');
    await pausa(80);
    verdad(uno('.dependencias li'), 'la dependencia quedó registrada');
  }],
  ['Kanban liviano: columna de revisión y bloqueo', async () => {
    await ir('ajustes');
    const casilla = todos('label.opcion').find((l) => l.textContent.includes('En revisión')).querySelector('input');
    casilla.click(); await pausa(80);
    await ir('sprint');
    await clic('Planificar un sprint');
    todos('.lista-elegir input')[0].click(); await pausa(80);
    await clic('Iniciar sprint');
    verdad(uno('.columna--review'), 'aparece la columna En revisión');
    todos('.ficha-bloqueo').find((b) => b.textContent === 'Bloquear').click(); await pausa(80);
    verdad(uno('.ficha.is-bloqueada') && uno('.aviso-bloqueos'), 'la ficha queda bloqueada con aviso');
  }],
  ['Desafíos del taller', async () => {
    await ir('taller');
    await pestana('Desafíos');
    escribir(uno('[aria-label="Sprints que faltan (probable)"]'), '5');
    await clic('Responder');
    verdad(uno('.desafios .resultado'), 'responde el pronóstico');
    await clic('Se cumplió');
    verdad(todos('.desafios .resultado').length === 2, 'responde la hipótesis');
  }],
  ['Cliente: plantilla, cotización, hitos, acta y cambio', async () => {
    await ir('cliente');
    escribir(uno('[aria-label="Plantilla por tipo de proyecto"]'), 'web', 'change');
    await clic('Aplicar');
    verdad(todos('textarea').some((t) => t.value.includes('Redacción de textos')), 'la plantilla llenó lo que no incluye');
    await pestana('Cotización');
    const valorHora = todos('input[type=number]')[0];
    escribir(valorHora, '0.5', 'change');
    await pausa(80);
    verdad(/UF/.test(todos('.cifra dd')[3].textContent), `hay total: ${todos('.cifra dd')[3].textContent}`);
    await pestana('Hitos de pago');
    await clic('Proponer 3 hitos');
    igual(todos('.hito').length, 3, 'hitos propuestos');
    copiado = '';
    todos('.compartir-md').find((g) => g.getAttribute('aria-label') === 'Acta de aceptación').querySelector('button').click();
    await esperar(() => copiado.startsWith('# Acta de aceptación'), 'se copió el acta');
    await pestana('Cambios');
    escribir(uno('[aria-label="Solicitud del cliente"]'), 'Agregar un blog de recetas');
    escribir(uno('[aria-label="Horas estimadas del cambio"]'), '8');
    await clic('Registrar y calcular impacto');
    copiado = '';
    todos('.compartir-md').find((g) => g.getAttribute('aria-label') === 'Respuesta al cliente').querySelector('button').click();
    await esperar(() => copiado.includes('Agregar un blog de recetas'), 'se copió la respuesta');
    await clic('El cliente aprobó');
    verdad(uno('.cambio--aprobado'), 'el cambio quedó aprobado');
  }],
  ['Inicio: ejemplo con recorrido de 4 pasos', async () => {
    await ir('inicio');
    verdad(doc().body.textContent.includes('Qué no es'), 'el inicio explica qué no es');
    await clic('Ver el ejemplo con un recorrido');
    await esperar(() => uno('.aviso-ejemplo') && uno('.recorrido'), 'se abrió el ejemplo con el recorrido');
    igual(uno('#proyecto-activo option:checked').textContent, 'Pastelería de Carla (ejemplo)', 'proyecto activo');
    for (const vista of ['backlog', 'cliente', 'sprint']) {
      await clic('Siguiente paso →');
      await esperar(() => ventana().location.hash === `#${vista}`, `el recorrido pasó a ${vista}`);
    }
    await clic('Terminar y comentar');
    await esperar(() => ventana().location.hash === '#comentar', 'terminó en Comentar');
    verdad(!uno('.recorrido'), 'el recorrido se cerró');
  }],
  ['Comentar: arma el texto y el enlace a GitHub', async () => {
    await ir('comentar');
    todos('input[name="nota"]')[3].click();
    todos('input[name="usaria"]')[0].click();
    escribir(todos('.encuesta textarea')[1], 'Firma electrónica');
    const enlace = todos('a').find((a) => a.textContent === 'Publicar en GitHub');
    verdad(enlace.href.includes('/issues/new') && decodeURIComponent(enlace.href).includes('Firma electrónica'), 'el enlace lleva el comentario');
    copiado = '';
    await clic('Copiar texto');
    await esperar(() => copiado.includes('**Nota (1 a 5):** 4'), 'se copió el comentario');
  }],
  ['Modo simple y cajas de ayuda', async () => {
    await ir('backlog');
    verdad(uno('.caja-info'), 'hay caja de ayuda');
    uno('.caja-info button').click();
    await esperar(() => !uno('.caja-info'), 'la caja se cerró');
    await ir('inicio');
    uno('.bienvenida input[type="checkbox"]').click();
    await esperar(() => !todos('#navegacion a').some((a) => a.textContent === 'Taller'), 'el modo simple oculta Taller');
    uno('.bienvenida input[type="checkbox"]').click();
    await esperar(() => todos('#navegacion a').some((a) => a.textContent === 'Taller'), 'Taller vuelve');
    await clic('Volver a mostrar las cajas de ayuda');
    await ir('backlog');
    verdad(uno('.caja-info'), 'la caja volvió');
  }],
  ['Sprint: doble clic abre la ficha y se edita', async () => {
    await ir('sprint');
    const ficha = uno('.ficha');
    ficha.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    await esperar(() => uno('dialog.dialogo-ficha[open]'), 'se abrió la ficha');
    escribir(doc().querySelectorAll('dialog.dialogo-ficha input')[1], 'pagar con Webpay');
    await clic('Listo');
    await esperar(() => !uno('dialog.dialogo-ficha') && todos('.ficha-titulo').some((t) => t.textContent.startsWith('Pagar con Webpay')), 'el tablero muestra el cambio');
  }],
  ['Sprint: mover con el teclado', async () => {
    await ir('sprint');
    const ficha = uno('.columna--todo .ficha');
    const id = ficha.dataset.id;
    ficha.focus();
    ficha.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await pausa(100);
    verdad(!uno(`.columna--todo .ficha[data-id="${id}"]`), 'la tarjeta salió de Por hacer');
    verdad(doc().activeElement?.dataset?.id === id, 'el foco sigue en la tarjeta');
  }],
  ['Buscador (Ctrl+K) y atajos de teclado', async () => {
    await ir('notas');
    const tecla = (key, extra = {}) => doc().body.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...extra }));
    tecla('b');
    await esperar(() => ventana().location.hash === '#backlog', 'la tecla B lleva al backlog');
    tecla('k', { ctrlKey: true });
    await esperar(() => uno('dialog.buscador[open]'), 'Ctrl+K abre el buscador');
    const entrada = uno('dialog.buscador input');
    escribir(entrada, 'cuotas');
    verdad(todos('.buscador-lista li').some((li) => li.textContent.includes('Pagar en cuotas')), 'encuentra la historia');
    entrada.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await esperar(() => !uno('dialog.buscador') && uno('.tarjeta.is-abierta'), 'abre la historia en el backlog');
    tecla('?');
    await esperar(() => uno('dialog .atajos'), 'el ? muestra los atajos');
    await clic('Entendido');
  }],
  ['Backlog: edición rápida y selección múltiple', async () => {
    await ir('backlog');
    uno('.tarjeta.is-abierta .tarjeta-abrir')?.click(); await pausa(80);
    const pts = uno('.tarjeta-rapido select');
    escribir(pts, '13', 'change');
    await esperar(() => uno('.tarjeta-rapido select').value === '13', 'cambió los puntos sin abrir la tarjeta');
    const casillas = todos('label.tarjeta-orden input');
    casillas[0].click(); await pausa(50);
    todos('label.tarjeta-orden input')[1].click(); await pausa(50);
    await esperar(() => uno('.barra-seleccion')?.textContent.includes('2 seleccionadas'), 'aparece la barra de selección');
    escribir(uno('.barra-seleccion select'), 'wont', 'change');
    await esperar(() => !uno('.barra-seleccion'), 'aplicó el cambio y limpió la selección');
    verdad(todos('.tarjeta-rapido select[aria-label^="Prioridad"]').filter((x) => x.value === 'wont').length >= 2, 'dos historias cambiaron de prioridad');
  }],
  ['Sprint: filtros y mover desde la ficha', async () => {
    await ir('sprint');
    uno('.filtros-tablero input[type="checkbox"]').click();
    await esperar(() => todos('.ficha').length === todos('.ficha.is-bloqueada').length && todos('.ficha').length > 0, 'solo muestra bloqueadas');
    await clic('Ver todo');
    const ficha = uno('.columna--todo .ficha') || uno('.columna--doing .ficha');
    const id = ficha.dataset.id;
    ficha.querySelector('.ficha-titulo').click();
    await esperar(() => uno('dialog.dialogo-ficha .mover-a'), 'la ficha ofrece mover');
    todos('.mover-a button').find((b) => b.textContent === 'Hecho').click();
    await esperar(() => uno(`.columna--done .ficha[data-id="${id}"]`), 'quedó en Hecho');
    verdad(/\d+%/.test(uno('#navegacion a[href="#sprint"]').textContent), 'el menú muestra el avance del sprint');
  }],
  ['Celular: sin desplazamiento horizontal', async () => {
    marco.style.width = '375px';
    await pausa(150);
    for (const vista of ['inicio', 'comentar', 'notas', 'backlog', 'cliente', 'sprint', 'retro', 'taller', 'ajustes']) {
      await ir(vista);
      const ancho = doc().documentElement.scrollWidth;
      verdad(ancho <= 376, `${vista} mide ${ancho}px en un celular de 375px`);
    }
    verdad(ventana().getComputedStyle(uno('#barra-inferior')).display !== 'none', 'en el celular se ve la barra inferior');
    marco.style.width = '';
  }],
];

async function correr() {
  await new Promise((r) => { const b = indexedDB.deleteDatabase('copiloto-po-prueba'); b.onsuccess = r; b.onerror = r; b.onblocked = r; });
  await cargar();
  for (const [nombre, prueba] of PRUEBAS) {
    const li = document.createElement('li');
    try {
      await prueba();
      li.className = 'ok';
      li.textContent = `✔ ${nombre}`;
      resultados.push({ nombre, ok: true });
    } catch (e) {
      li.className = 'falla';
      li.textContent = `✖ ${nombre}: ${e.message}`;
      resultados.push({ nombre, ok: false, error: e.message });
    }
    lista.append(li);
  }
  const fallas = resultados.filter((r) => !r.ok);
  document.getElementById('resultado').textContent = `RESULTADO ${JSON.stringify({ total: resultados.length, fallas })}`;
  document.title = fallas.length ? `FALLA (${fallas.length})` : 'OK';
}

correr();
