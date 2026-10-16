// Historias como issues de GitHub o Linear: Markdown para copiar, o un enlace que abre
// el formulario de "nueva issue" ya lleno (sin tokens ni API: la persona revisa y crea).
import { enunciado, PRIORIDADES } from './historias.js';
import { definicionesDe } from './definiciones.js';

/** Las URLs muy largas fallan en algunos navegadores y servidores. */
export const LARGO_MAXIMO_URL = 7000;

export function issueDe(proyecto, historia) {
  const { done } = definicionesDe(proyecto);
  const cuerpo = [
    `> ${enunciado(historia)}`,
    '',
    '### Criterios de aceptación',
    '',
    ...(historia.criterios.length ? historia.criterios.map((c) => `- [ ] ${c}`) : ['- [ ] _Por definir_']),
    '',
    '### Definition of Done',
    '',
    ...done.map((d) => `- [ ] ${d}`),
    '',
    `_${[historia.epica && `Épica: ${historia.epica}`, `Prioridad: ${PRIORIDADES[historia.prioridad]}`, historia.puntos && `${historia.puntos} puntos`].filter(Boolean).join(' · ')}_`,
  ].join('\n');
  const etiquetas = ['historia', historia.epica ? historia.epica.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase() : null].filter(Boolean);
  return { titulo: historia.titulo, cuerpo, etiquetas };
}

/** Markdown completo (título + cuerpo) para pegar donde sea. */
export function issueMarkdown(issue) {
  return `## ${issue.titulo}\n\n${issue.cuerpo}\n`;
}

/** Valida "dueño/repositorio" (o una URL de GitHub) y lo normaliza. */
export function repoGithub(texto) {
  const m = String(texto || '').trim().replace(/\.git$/, '').match(/^(?:https?:\/\/github\.com\/)?([A-Za-z0-9-]{1,39})\/([A-Za-z0-9._-]{1,100})\/?$/);
  return m ? `${m[1]}/${m[2]}` : null;
}

/** Enlace a "nueva issue" de GitHub con título, cuerpo y etiquetas (las etiquetas deben existir en el repo). */
export function urlGithub(repo, issue) {
  const r = repoGithub(repo);
  if (!r) throw new Error('Indica el repositorio de GitHub como dueño/repositorio en Ajustes.');
  const params = new URLSearchParams({ title: issue.titulo, body: issue.cuerpo });
  if (issue.etiquetas.length) params.set('labels', issue.etiquetas.join(','));
  return recortar(`https://github.com/${r}/issues/new?${params}`);
}

/** Enlace a una issue nueva de Linear (linear.new) con título y descripción. */
export function urlLinear(issue) {
  return recortar(`https://linear.new?${new URLSearchParams({ title: issue.titulo, description: issue.cuerpo })}`);
}

function recortar(url) {
  if (url.length <= LARGO_MAXIMO_URL) return url;
  throw new Error('La historia es demasiado larga para abrirla con un enlace. Usa "Copiar" y pégala.');
}
