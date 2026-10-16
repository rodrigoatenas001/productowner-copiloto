// Trivia para proyectar: el facilitador muestra la pregunta, corre el tiempo, revela la respuesta
// y marca qué equipos acertaron. Sin celulares ni servidor.
import { h, campo, descargar, confirmar } from './dom.js';
import { TEMAS } from '../nucleo/preguntas.js';
import {
  BANCO_INCLUIDO, crearPartida, registrarRespuestas, siguientePregunta, ranking, validarPreguntas,
} from '../nucleo/trivia.js';

const FORMAS = ['▲', '◆', '●', '■'];
const config = { equipos: 'Equipo rojo, Equipo azul', temas: Object.keys(TEMAS), cantidad: 10, segundos: 20 };
let partida = null;
let restante = 0;
let reloj = null;
let aciertos = new Set();

function detenerReloj() {
  clearInterval(reloj);
  reloj = null;
}

export function vistaTrivia(app) {
  detenerReloj();
  if (!partida) return configuracion(app);
  if (partida.fase === 'final') return final(app);
  return jugar(app);
}

function banco(app) {
  return [...BANCO_INCLUIDO, ...(app.preguntasPropias || [])];
}

function configuracion(app) {
  const propias = app.preguntasPropias || [];
  const temas = { ...TEMAS, ...(propias.length ? { propias: 'Mis preguntas' } : {}) };
  const disponibles = banco(app).filter((p) => config.temas.includes(p.tema)).length;

  const importar = h('input', {
    type: 'file', accept: '.json,application/json', class: 'sr-only', id: 'importar-preguntas',
    onchange: async (e) => {
      const archivo = e.target.files[0];
      e.target.value = '';
      if (!archivo) return;
      try {
        const { preguntas, descartadas } = validarPreguntas(JSON.parse(await archivo.text()));
        await app.guardarPreguntas([...propias, ...preguntas]);
        if (!config.temas.includes('propias')) config.temas.push('propias');
        app.avisar(`${preguntas.length} preguntas agregadas${descartadas ? `, ${descartadas} descartadas por estar incompletas` : ''}.`);
        app.render();
      } catch (err) {
        app.avisar(err instanceof SyntaxError ? 'El archivo no es un JSON válido.' : err.message, 'error');
      }
    },
  });

  return h('div', { class: 'trivia' },
    h('section', { class: 'panel', 'aria-labelledby': 'trivia-config' },
      h('h2', { id: 'trivia-config' }, 'Preparar la trivia'),
      h('p', { class: 'ayuda' }, 'Proyecta esta pantalla. Los equipos responden en voz alta o levantando la mano; tú marcas quién acertó. Más rápido, más puntos.'),
      campo('Equipos o participantes', h('input', {
        type: 'text', value: config.equipos,
        oninput: (e) => { config.equipos = e.target.value; },
      }), 'Separados por coma. Hasta 12.'),
      h('fieldset', { class: 'temas' },
        h('legend', {}, 'Temas'),
        Object.entries(temas).map(([clave, nombre]) => h('label', { class: 'opcion' },
          h('input', {
            type: 'checkbox', checked: config.temas.includes(clave),
            onchange: (e) => {
              config.temas = e.target.checked ? [...config.temas, clave] : config.temas.filter((t) => t !== clave);
              app.render();
            },
          }),
          `${nombre} (${banco(app).filter((p) => p.tema === clave).length})`))),
      h('div', { class: 'editor-fila' },
        campo('Preguntas', h('input', { type: 'number', min: 1, max: 50, value: config.cantidad, onchange: (e) => { config.cantidad = Number(e.target.value) || 10; } }),
          `${disponibles} disponibles con estos temas.`),
        campo('Segundos por pregunta', h('input', { type: 'number', min: 5, max: 120, value: config.segundos, onchange: (e) => { config.segundos = Number(e.target.value) || 20; } }))),
      h('div', { class: 'acciones' },
        h('button', {
          type: 'button', class: 'btn btn--cobre',
          onclick: () => {
            try {
              partida = crearPartida(banco(app), { ...config, equipos: config.equipos.split(',') });
              empezarPregunta();
              app.render();
            } catch (err) {
              app.avisar(err.message, 'error');
            }
          },
        }, 'Empezar la trivia'))),
    h('section', { class: 'panel', 'aria-labelledby': 'mis-preguntas' },
      h('h2', { id: 'mis-preguntas' }, 'Mis preguntas'),
      h('p', { class: 'ayuda' }, 'Agrega preguntas de tu curso o de tu producto con un archivo JSON. Formato: ',
        h('code', {}, '[{"tema":"propias","texto":"¿…?","opciones":["A","B","C","D"],"correcta":1,"explicacion":"…"}]'),
        ` (correcta empieza en 0). Tienes ${propias.length}.`),
      h('div', { class: 'acciones' },
        importar,
        h('label', { for: 'importar-preguntas', class: 'btn btn--secundario', tabindex: '0', onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); importar.click(); } } }, 'Importar preguntas'),
        h('button', {
          type: 'button', class: 'btn btn--secundario',
          onclick: () => descargar('preguntas-trivia.json', JSON.stringify(banco(app).map(({ propia, ...p }) => p), null, 2), 'application/json'),
        }, 'Descargar todas como plantilla'),
        propias.length ? h('button', {
          type: 'button', class: 'btn-texto btn-peligro',
          onclick: async () => {
            if (!(await confirmar(`¿Borrar tus ${propias.length} preguntas propias?`, { aceptar: 'Borrar', peligro: true }))) return;
            await app.guardarPreguntas([]);
            config.temas = config.temas.filter((t) => t !== 'propias');
            app.render();
          },
        }, 'Borrar mis preguntas') : null)));
}

function empezarPregunta() {
  restante = partida.segundos;
  aciertos = new Set();
}

function jugar(app) {
  const pregunta = partida.preguntas[partida.indice];
  const enRespuesta = partida.fase === 'respuesta' || partida.fase === 'revelada';
  const revelada = partida.fase !== 'pregunta';
  const contador = h('span', { class: 'trivia-tiempo', 'aria-live': 'off' }, String(restante));
  const barra = h('span', { class: `relleno-${Math.round((restante / partida.segundos) * 20) * 5}` });

  if (partida.fase === 'pregunta' && restante > 0) {
    reloj = setInterval(() => {
      if (!contador.isConnected) { detenerReloj(); return; }
      restante = Math.max(0, restante - 1);
      contador.textContent = String(restante);
      barra.className = `relleno-${Math.round((restante / partida.segundos) * 20) * 5}`;
      if (restante === 0) { detenerReloj(); partida = { ...partida, fase: 'revelada' }; app.render(); }
    }, 1000);
  }

  return h('div', { class: 'trivia trivia--juego' },
    h('div', { class: 'trivia-cabecera' },
      h('span', { class: 'eyebrow' }, `Pregunta ${partida.indice + 1} de ${partida.preguntas.length} · ${TEMAS[pregunta.tema] || 'Mis preguntas'}`),
      h('span', { class: 'trivia-acciones' },
        h('button', { type: 'button', class: 'btn-texto', onclick: () => pantallaCompleta() }, 'Pantalla completa'),
        h('button', { type: 'button', class: 'btn-texto', onclick: async () => { if (await confirmar('¿Terminar la trivia?', { aceptar: 'Terminar' })) { partida = { ...partida, fase: 'final' }; app.render(); } } }, 'Terminar'))),
    h('div', { class: 'capacidad-barra trivia-barra', 'aria-hidden': 'true' }, barra),
    h('h2', { class: 'trivia-pregunta' }, pregunta.texto),
    h('ol', { class: 'trivia-opciones' }, pregunta.opciones.map((o, i) => h('li', {
      class: `opcion-trivia opcion-trivia--${i}${revelada ? (i === pregunta.correcta ? ' is-correcta' : ' is-incorrecta') : ''}`,
    }, h('span', { class: 'forma', 'aria-hidden': 'true' }, FORMAS[i]), h('span', {}, o), revelada && i === pregunta.correcta ? h('span', { class: 'sr-only' }, ' (correcta)') : null))),

    !revelada ? h('div', { class: 'acciones trivia-pie' },
      contador,
      h('button', { type: 'button', class: 'btn btn--cobre', onclick: () => { detenerReloj(); partida = { ...partida, fase: 'revelada' }; app.render(); } }, 'Mostrar respuesta'))
      : null,

    partida.fase === 'revelada' ? h('section', { class: 'panel trivia-marcar', 'aria-labelledby': 'quien-acerto' },
      pregunta.explicacion ? h('p', { class: 'trivia-explicacion' }, pregunta.explicacion) : null,
      h('h3', { id: 'quien-acerto' }, '¿Quién acertó?'),
      h('div', { class: 'equipos-marcar' }, partida.equipos.map((e) => h('label', { class: 'opcion' },
        h('input', { type: 'checkbox', checked: aciertos.has(e.nombre), onchange: (ev) => { if (ev.target.checked) aciertos.add(e.nombre); else aciertos.delete(e.nombre); } }),
        e.nombre))),
      h('div', { class: 'acciones' },
        h('button', {
          type: 'button', class: 'btn btn--cobre',
          onclick: () => {
            partida = registrarRespuestas({ ...partida, fase: 'pregunta' }, [...aciertos], restante);
            app.render();
          },
        }, 'Sumar puntos'))) : null,

    enRespuesta && partida.fase === 'respuesta' ? h('section', { class: 'panel', 'aria-labelledby': 'marcador' },
      h('h3', { id: 'marcador' }, 'Marcador'),
      tablaRanking(),
      h('div', { class: 'acciones' },
        h('button', {
          type: 'button', class: 'btn',
          onclick: () => { partida = siguientePregunta(partida); empezarPregunta(); app.render(); },
        }, partida.indice < partida.preguntas.length - 1 ? 'Siguiente pregunta' : 'Ver resultados'))) : null);
}

function tablaRanking() {
  return h('ol', { class: 'ranking' }, ranking(partida).map((e) => h('li', {},
    h('span', { class: 'ranking-nombre' }, e.nombre),
    e.racha >= 2 ? h('span', { class: 'chip' }, `racha ×${e.racha}`) : null,
    h('span', { class: 'ranking-puntos' }, `${e.puntos.toLocaleString('es-CL')} pts`))));
}

function final(app) {
  const orden = ranking(partida);
  const total = partida.preguntas.length;
  return h('div', { class: 'trivia' },
    h('section', { class: 'panel podio', 'aria-labelledby': 'resultados' },
      h('p', { class: 'eyebrow' }, 'Resultados'),
      h('h2', { id: 'resultados' }, orden[0].puntos ? `¡Gana ${orden[0].nombre}!` : 'Fin de la trivia'),
      tablaRanking(),
      h('p', { class: 'ayuda' }, orden.map((e) => `${e.nombre}: ${e.aciertos} de ${total}`).join(' · ')),
      h('div', { class: 'acciones' },
        h('button', { type: 'button', class: 'btn btn--cobre', onclick: () => { partida = null; app.render(); } }, 'Nueva trivia'))));
}

function pantallaCompleta() {
  const el = document.documentElement;
  if (document.fullscreenElement) document.exitFullscreen?.();
  else el.requestFullscreen?.().catch(() => {});
}
