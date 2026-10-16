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
  w.fetch = async (_url, op) => {
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
  ['Celular: sin desplazamiento horizontal', async () => {
    marco.style.width = '375px';
    await pausa(150);
    for (const vista of ['notas', 'backlog', 'sprint', 'retro', 'taller', 'ajustes']) {
      await ir(vista);
      const ancho = doc().documentElement.scrollWidth;
      verdad(ancho <= 376, `${vista} mide ${ancho}px en un celular de 375px`);
    }
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
