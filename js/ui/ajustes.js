// Ajustes: proyecto, IA opcional, respaldo y exportaciones.
import { h, campo, selector, descargar } from './dom.js';
import { normalizarProyecto } from '../nucleo/proyecto.js';
import { aCsv, aJiraCsv, aMarkdown, nombreArchivo, GUIA_JQL } from '../nucleo/exportar.js';
import { PROVEEDORES, probarConexion, iaConfigurada } from '../ia.js';
import { importarCsv } from '../nucleo/importar.js';
import { repoGithub } from '../nucleo/issues.js';
import { botonesMarkdown } from './compartir.js';
import { reporteEpicas, notasDeVersion } from '../nucleo/reportes.js';
import { definicionesDe, listaDesdeTexto, NOMBRES, DEFINICIONES_INICIALES } from '../nucleo/definiciones.js';

export function vistaAjustes(app) {
  const p = app.proyecto;
  return h('div', { class: 'vista' },
    h('header', { class: 'vista-cabecera' },
      h('p', { class: 'eyebrow' }, p.nombre),
      h('h1', {}, 'Ajustes')),
    seccionProyecto(app),
    seccionDefiniciones(app),
    seccionRespaldo(app),
    seccionIa(app),
    iaConfigurada(app.ia) ? seccionIa(app, 'iaRevisor') : null,
    seccionAcerca());
}

function seccionProyecto(app) {
  const p = app.proyecto;
  return h('section', { class: 'panel', 'aria-labelledby': 'aj-proyecto' },
    h('h2', { id: 'aj-proyecto' }, 'Proyecto'),
    h('div', { class: 'editor-fila' },
      campo('Nombre', h('input', {
        type: 'text', value: p.nombre, maxlength: 120,
        onchange: (e) => { const v = e.target.value.trim(); if (v) app.cambiar((x) => ({ ...x, nombre: v })); },
      })),
      campo('Rol por defecto', h('input', {
        type: 'text', value: p.rolPorDefecto, maxlength: 120,
        onchange: (e) => app.cambiar((x) => ({ ...x, rolPorDefecto: e.target.value.trim() || 'usuario' }), { redibujar: false }),
      }), 'Se usa cuando una nota no dice quién se beneficia.'),
      campo('Repositorio de GitHub (opcional)', h('input', {
        type: 'text', value: p.github || '', placeholder: 'dueño/repositorio', maxlength: 160,
        onchange: (e) => {
          const valor = e.target.value.trim();
          const repo = repoGithub(valor);
          if (valor && !repo) { app.avisar('Escríbelo como dueño/repositorio, por ejemplo antox/grc.', 'error'); return; }
          app.cambiar((x) => ({ ...x, github: repo || '' }), { redibujar: false });
        },
      }), 'Para abrir cada historia como issue nueva en GitHub, ya completa.')),
    h('div', { class: 'acciones' },
      h('button', {
        type: 'button', class: 'btn-texto btn-peligro',
        onclick: async () => {
          if (!confirm(`¿Eliminar el proyecto "${p.nombre}" de este navegador? Descarga un respaldo antes si lo quieres conservar.`)) return;
          await app.borrarProyectoActual();
          app.avisar('Proyecto eliminado.');
        },
      }, 'Eliminar este proyecto')));
}

function seccionRespaldo(app) {
  const p = app.proyecto;
  const entrada = h('input', {
    type: 'file', accept: 'application/json,.json', class: 'sr-only', id: 'importar',
    onchange: async (e) => {
      const archivo = e.target.files[0];
      e.target.value = '';
      if (!archivo) return;
      if (archivo.size > 20 * 1024 * 1024) { app.avisar('El archivo es demasiado grande para ser un respaldo.', 'error'); return; }
      try {
        const proyecto = normalizarProyecto(JSON.parse(await archivo.text()));
        await app.importarProyecto(proyecto);
        app.avisar(`Proyecto "${proyecto.nombre}" importado.`);
      } catch (err) {
        app.avisar(err instanceof SyntaxError ? 'El archivo no es un JSON válido.' : err.message, 'error');
      }
    },
  });

  return h('section', { class: 'panel', 'aria-labelledby': 'aj-respaldo' },
    h('h2', { id: 'aj-respaldo' }, 'Respaldo y exportación'),
    h('p', { class: 'ayuda' }, 'Tus datos están solo en este navegador. Si borras los datos del navegador o cambias de equipo, se pierden: descarga un respaldo de vez en cuando.',
      p.respaldado ? ` Último respaldo: ${new Date(p.respaldado).toLocaleDateString('es-CL')}.` : ' Aún no descargas ninguno.'),
    h('div', { class: 'acciones' },
      h('button', { type: 'button', class: 'btn', onclick: () => app.descargarRespaldo() }, 'Descargar respaldo (.json)'),
      entrada,
      h('label', { for: 'importar', class: 'btn btn--secundario', tabindex: '0', onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); entrada.click(); } } }, 'Importar respaldo')),
    h('h3', {}, 'Traer un backlog que ya tienes'),
    h('p', { class: 'ayuda' }, 'Desde un CSV de Jira, Excel u otra herramienta. Reconocemos columnas como Summary, Título, Description, Story Points, Priority, Labels o Épica. Lo terminado no se importa.'),
    entradaCsv(app),
    h('h3', {}, 'Exportar el backlog'),
    h('div', { class: 'acciones' },
      h('button', { type: 'button', class: 'btn btn--secundario', onclick: () => descargar(nombreArchivo(p, 'md'), aMarkdown(p), 'text/markdown') }, 'Markdown'),
      h('button', { type: 'button', class: 'btn btn--secundario', onclick: () => descargar(nombreArchivo(p, 'csv'), aCsv(p), 'text/csv') }, 'CSV (Excel)'),
      h('button', { type: 'button', class: 'btn btn--secundario', onclick: () => descargar(nombreArchivo(p, 'jira.csv'), aJiraCsv(p), 'text/csv') }, 'CSV para Jira')),
    h('div', { class: 'compartir' },
      botonesMarkdown(app, 'Avance por épica', 'avance-epicas', () => reporteEpicas(app.proyecto)),
      botonesMarkdown(app, 'Notas de versión (todo lo terminado)', 'notas-de-version', () => notasDeVersion(app.proyecto))),
    h('p', { class: 'ayuda' }, 'En Jira: Configuración del sistema → Importación externa → CSV. Asocia "Issue ID" y "Parent ID" para que las historias queden dentro de sus épicas. El sprint solo se asigna si ya existe uno con ese nombre en Jira; si no, deja esa columna sin mapear.'),
    h('details', { class: 'guia-jql' },
      h('summary', {}, 'Guía rápida de JQL'),
      h('p', { class: 'ayuda' }, 'Pégalas en la búsqueda avanzada de Jira. Cambia PROJ-123 y los usuarios por los tuyos.'),
      h('ul', {}, GUIA_JQL.map((q) => h('li', {},
        h('span', { class: 'guia-para' }, q.para),
        h('code', {}, q.jql),
        h('button', {
          type: 'button', class: 'btn-texto',
          onclick: async () => {
            try { await navigator.clipboard.writeText(q.jql); app.avisar('Consulta copiada.'); } catch { app.avisar('No se pudo copiar; selecciónala a mano.', 'error'); }
          },
        }, 'Copiar'))))));
}

function seccionIa(app, clave = 'ia') {
  const esRevisor = clave === 'iaRevisor';
  const c = { proveedor: esRevisor ? 'misma' : 'ninguno', ...app[clave] };
  const opciones = esRevisor
    ? { misma: 'La misma IA de arriba', ...Object.fromEntries(Object.entries(PROVEEDORES).filter(([k]) => k !== 'ninguno').map(([k, v]) => [k, v.nombre])) }
    : Object.fromEntries(Object.entries(PROVEEDORES).map(([k, v]) => [k, v.nombre]));
  const def = PROVEEDORES[c.proveedor] || PROVEEDORES.ninguno;
  const estado = h('p', { class: 'ayuda', 'aria-live': 'polite' });

  const guardar = async (cambios, redibujar = false) => {
    await app.guardarIa({ ...c, ...cambios }, clave);
    if (redibujar) app.render();
  };

  const campos = [];
  if (c.proveedor !== 'ninguno' && c.proveedor !== 'misma') {
    campos.push(h('div', { class: 'editor-fila' },
      campo('Dirección', h('input', { type: 'url', value: c.url || def.url, onchange: (e) => guardar({ url: e.target.value.trim() }) })),
      campo('Modelo', h('input', { type: 'text', value: c.modelo || def.modelo, onchange: (e) => guardar({ modelo: e.target.value.trim() }) }))));
    if (c.proveedor !== 'ollama') {
      campos.push(campo('Clave de API', h('input', {
        type: 'password', value: c.clave || '', autocomplete: 'off', spellcheck: 'false',
        onchange: (e) => guardar({ clave: e.target.value.trim() }),
      }), 'Se guarda solo en este navegador y se envía únicamente a ese servicio. Usa una clave con límite de gasto.'));
    } else {
      campos.push(h('div', { class: 'nota-tecnica' },
        h('p', {}, 'Ollama corre en tu equipo: tus notas no salen de él. Para que el copiloto pueda hablarle, ábrelo permitiendo este sitio:'),
        h('pre', {}, h('code', {}, `OLLAMA_ORIGINS=${location.origin} ollama serve`)),
        h('p', {}, 'Y descarga un modelo, por ejemplo: ', h('code', {}, 'ollama pull llama3.1'))));
    }
    campos.push(h('div', { class: 'acciones' },
      h('button', {
        type: 'button', class: 'btn btn--secundario',
        onclick: async (e) => {
          const boton = e.currentTarget; // currentTarget deja de existir después del await
          boton.disabled = true;
          estado.textContent = 'Probando…';
          try {
            await probarConexion({ ...c, url: c.url || def.url, modelo: c.modelo || def.modelo });
            estado.textContent = '✓ Conexión correcta.';
          } catch (err) {
            estado.textContent = err.message;
          } finally {
            boton.disabled = false;
          }
        },
      }, 'Probar conexión')), estado);
  }

  const id = esRevisor ? 'aj-ia-revisor' : 'aj-ia';
  return h('section', { class: 'panel', 'aria-labelledby': id },
    h('h2', { id }, esRevisor ? 'IA revisora (opcional)' : 'IA (opcional)'),
    h('p', { class: 'ayuda' }, esRevisor
      ? 'En "Revisar en dos voces", una IA revisa la historia como lo haría QA o desarrollo y la principal la corrige. Dos modelos distintos se equivocan de formas distintas: por ejemplo, Ollama redacta gratis y una API revisa.'
      : 'El copiloto funciona completo sin IA. Si conectas una, la usarás en Notas y en el Backlog. No tenemos servidor: la conexión es directa entre tu navegador y el servicio que elijas.'),
    campo('Servicio', selector(opciones, c.proveedor, {
      onchange: (e) => {
        const nuevo = PROVEEDORES[e.target.value] || {};
        guardar({ proveedor: e.target.value, url: nuevo.url || '', modelo: nuevo.modelo || '', clave: e.target.value === c.proveedor ? c.clave : '' }, true);
      },
    })),
    campos);
}

function seccionAcerca() {
  return h('section', { class: 'panel', 'aria-labelledby': 'aj-acerca' },
    h('h2', { id: 'aj-acerca' }, 'Acerca del copiloto'),
    h('p', {}, 'Herramienta libre (licencia MIT) para Product Owners y equipos independientes. Funciona sin conexión y sin cuentas.'),
    h('p', {}, 'Hecha por la comunidad de ', h('a', { href: 'https://productowner.cl', rel: 'noopener' }, 'ProductOwner.cl'), '.'));
}

function entradaCsv(app) {
  const entrada = h('input', {
    type: 'file', accept: '.csv,text/csv', class: 'sr-only', id: 'importar-csv',
    onchange: async (e) => {
      const archivo = e.target.files[0];
      e.target.value = '';
      if (!archivo) return;
      if (archivo.size > 10 * 1024 * 1024) { app.avisar('El archivo es demasiado grande.', 'error'); return; }
      try {
        const { historias, omitidas, sinTitulo } = importarCsv(await archivo.text(), { rolPorDefecto: app.proyecto.rolPorDefecto });
        if (!historias.length) { app.avisar('No encontramos historias pendientes en el archivo.', 'error'); return; }
        const notas = [
          omitidas ? `${omitidas} ${omitidas === 1 ? 'terminada omitida' : 'terminadas omitidas'}` : '',
          sinTitulo ? `${sinTitulo} ${sinTitulo === 1 ? 'fila vacía' : 'filas vacías'}` : '',
        ].filter(Boolean).join(', ');
        app.ir('backlog');
        app.cambiarConDeshacer(`${historias.length} ${historias.length === 1 ? 'historia importada' : 'historias importadas'}${notas ? ` (${notas})` : ''}.`, (x) => ({ ...x, historias: [...x.historias, ...historias] }));
      } catch (err) {
        app.avisar(err.message, 'error');
      }
    },
  });
  return h('div', { class: 'acciones' }, entrada,
    h('label', { for: 'importar-csv', class: 'btn btn--secundario', tabindex: '0', onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); entrada.click(); } } }, 'Importar CSV'));
}

function seccionDefiniciones(app) {
  const d = definicionesDe(app.proyecto);
  const editor = (tipo, ayuda) => campo(NOMBRES[tipo], h('textarea', {
    rows: 6,
    onchange: (e) => {
      const lista = listaDesdeTexto(e.target.value);
      app.cambiar((x) => ({ ...x, definiciones: { ...definicionesDe(x), [tipo]: lista.length ? lista : DEFINICIONES_INICIALES[tipo] } }));
    },
  }, d[tipo].join('\n')), ayuda);
  return h('section', { class: 'panel', 'aria-labelledby': 'aj-definiciones' },
    h('h2', { id: 'aj-definiciones' }, 'Definiciones del equipo'),
    h('p', { class: 'ayuda' }, 'Un punto por línea. Acuérdenlas en equipo y revísenlas en las retrospectivas.'),
    h('div', { class: 'editor-fila' },
      editor('ready', 'Lo que debe cumplir una historia para entrar a un sprint. Se marca en el backlog.'),
      editor('done', 'Lo que debe cumplir para considerarse terminada. Se marca en el tablero del sprint.')));
}
