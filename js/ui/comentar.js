// Comentar: una encuesta corta. Nada se envía solo: la persona elige dónde publicarla (GitHub o ProductOwner.cl).
import { h, avisar } from './dom.js';
import { PRODUCTOWNER } from './bienvenida.js';

export const REPO = 'https://github.com/rodrigoatenas001/productowner-copiloto';

const ROLES = ['Product Owner independiente', 'Desarrollador/a o QA independiente', 'PO o líder en una empresa', 'Estudiante o en bootcamp', 'Cliente que contrata proyectos TI', 'Otro'];
const SECCIONES = ['Notas a historias', 'Backlog y priorización', 'Roadmap y OKR', 'Cliente: alcance, cotización e hitos', 'Sprint y tablero', 'Retro', 'Taller', 'Informes y exportaciones', 'IA'];
const borrador = { rol: '', nota: 0, usaria: '', porque: '', sirvio: [], sobra: '', falta: '' };

/** Texto en Markdown con las respuestas (sin datos del proyecto). */
export function textoComentario(r) {
  const lista = (xs) => (xs.length ? xs.join(', ') : '—');
  return [
    '## Comentario sobre Copiloto PO',
    '',
    `- **Rol:** ${r.rol || '—'}`,
    `- **Nota (1 a 5):** ${r.nota || '—'}`,
    `- **¿Lo usarías en tu próximo proyecto?** ${r.usaria || '—'}`,
    r.porque ? `- **Por qué:** ${r.porque}` : null,
    `- **Lo que más sirvió:** ${lista(r.sirvio)}`,
    '',
    '**Le sobra o confunde:**', r.sobra || '—', '',
    '**Le falta:**', r.falta || '—',
  ].filter((l) => l !== null).join('\n');
}

export function vistaComentar() {
  const r = borrador;
  const salida = h('div', { class: 'comentar-salida' });
  const actualizar = () => {
    const texto = textoComentario(r);
    const url = `${REPO}/issues/new?labels=comentario&title=${encodeURIComponent(`Comentario: ${r.rol || 'sin rol'} · nota ${r.nota || '—'}`)}&body=${encodeURIComponent(texto)}`;
    salida.replaceChildren(
      h('h2', {}, 'Envíalo donde prefieras'),
      h('p', { class: 'ayuda' }, 'El copiloto no envía nada por su cuenta. Tú eliges dónde publicarlo; no incluye datos de tus proyectos.'),
      h('div', { class: 'acciones' },
        h('a', { class: 'btn', href: url, target: '_blank', rel: 'noopener', title: 'Abre GitHub con el comentario ya escrito. Necesitas una cuenta gratuita.' }, 'Publicar en GitHub'),
        h('button', {
          type: 'button', class: 'btn btn--secundario',
          title: 'Copia el texto para pegarlo en Sugerencias de ProductOwner.cl, un correo o donde quieras.',
          onclick: async () => {
            try { await navigator.clipboard.writeText(texto); avisar('Comentario copiado. Pégalo en ProductOwner.cl → Sugerencias.'); } catch { avisar('No se pudo copiar. Selecciona el texto de abajo y cópialo.', 'error'); }
          },
        }, 'Copiar texto'),
        h('a', { class: 'btn-texto', href: PRODUCTOWNER, target: '_blank', rel: 'noopener' }, 'Ir a ProductOwner.cl')),
      h('details', {}, h('summary', {}, 'Ver el texto'), h('pre', { class: 'bloque-texto' }, texto)));
  };

  const opciones = (nombre, valores, actual, alCambiar) => h('div', { class: 'opciones', role: 'radiogroup' },
    valores.map((v) => h('label', { class: 'opcion' },
      h('input', { type: 'radio', name: nombre, value: String(v), checked: actual === v, onchange: () => { alCambiar(v); actualizar(); } }), h('span', {}, String(v)))));

  const form = h('form', { class: 'panel encuesta', onsubmit: (e) => e.preventDefault() },
    h('fieldset', {}, h('legend', {}, '¿Cuál es tu rol?'), opciones('rol', ROLES, r.rol, (v) => { r.rol = v; })),
    h('fieldset', {}, h('legend', {}, '¿Qué nota le pones, de 1 a 5?'), opciones('nota', [1, 2, 3, 4, 5], r.nota, (v) => { r.nota = v; })),
    h('fieldset', {}, h('legend', {}, '¿Lo usarías en tu próximo proyecto?'), opciones('usaria', ['Sí', 'Tal vez', 'No'], r.usaria, (v) => { r.usaria = v; })),
    h('label', {}, '¿Por qué?', h('input', { type: 'text', maxlength: 300, value: r.porque, oninput: (e) => { r.porque = e.target.value; actualizar(); } })),
    h('fieldset', {}, h('legend', {}, '¿Qué te sirvió más? (puedes marcar varias)'),
      h('div', { class: 'opciones' }, SECCIONES.map((s) => h('label', { class: 'opcion' },
        h('input', { type: 'checkbox', checked: r.sirvio.includes(s), onchange: (e) => { r.sirvio = e.target.checked ? [...r.sirvio, s] : r.sirvio.filter((x) => x !== s); actualizar(); } }), h('span', {}, s))))),
    h('label', {}, '¿Qué te sobra o te confunde?', h('textarea', { rows: 3, maxlength: 1500, oninput: (e) => { r.sobra = e.target.value; actualizar(); } }, r.sobra)),
    h('label', {}, '¿Qué te falta?', h('textarea', { rows: 3, maxlength: 1500, oninput: (e) => { r.falta = e.target.value; actualizar(); } }, r.falta)));
  actualizar();

  return h('div', { class: 'vista' },
    h('header', { class: 'vista-cabecera' },
      h('p', { class: 'eyebrow' }, 'Versión inicial'),
      h('h1', {}, 'Cuéntanos qué te pareció'),
      h('p', { class: 'bajada' }, 'Copiloto PO es abierto y gratuito porque queremos que crezca con lo que aportan quienes lo usan. Si no calza con tu forma de trabajar, también nos sirve saberlo.')),
    form, h('section', { class: 'panel' }, salida));
}
