import { test } from 'node:test';
import assert from 'node:assert/strict';
import { notasAHistorias } from '../js/nucleo/historias.js';
import { nuevoProyecto } from '../js/nucleo/proyecto.js';
import { issueDe, issueMarkdown, repoGithub, urlGithub, urlLinear } from '../js/nucleo/issues.js';

const proyecto = () => {
  const p = nuevoProyecto('Tienda');
  p.historias = notasAHistorias('Pagos en línea:\n- Como clienta, quiero pagar con tarjeta, para no transferir');
  p.historias[0].puntos = 5;
  return p;
};

test('la issue lleva historia, criterios como casillas, DoD y etiqueta de épica', () => {
  const p = proyecto();
  const i = issueDe(p, p.historias[0]);
  assert.equal(i.titulo, 'Pagar con tarjeta');
  assert.ok(i.cuerpo.startsWith('> Como clienta, quiero pagar con tarjeta, para no transferir.'));
  assert.ok(i.cuerpo.includes('- [ ] Dado que tengo acceso'));
  assert.ok(i.cuerpo.includes('### Definition of Done'));
  assert.ok(i.cuerpo.endsWith('_Épica: Pagos en línea · Prioridad: Importante · 5 puntos_'));
  assert.deepEqual(i.etiquetas, ['historia', 'pagos-en-linea']);
  assert.ok(issueMarkdown(i).startsWith('## Pagar con tarjeta\n\n> Como clienta'));
});

test('repoGithub acepta dueño/repo o la URL, y rechaza lo demás', () => {
  assert.equal(repoGithub('rodrigoatenas001/productowner-copiloto'), 'rodrigoatenas001/productowner-copiloto');
  assert.equal(repoGithub('https://github.com/antox/grc.git'), 'antox/grc');
  assert.equal(repoGithub('https://gitlab.com/a/b'), null);
  assert.equal(repoGithub('solo-un-nombre'), null);
  assert.equal(repoGithub('a/b/c'), null);
});

test('enlaces de GitHub y Linear con los datos codificados', () => {
  const p = proyecto();
  const i = issueDe(p, p.historias[0]);
  const g = new URL(urlGithub('antox/grc', i));
  assert.equal(g.origin + g.pathname, 'https://github.com/antox/grc/issues/new');
  assert.equal(g.searchParams.get('title'), 'Pagar con tarjeta');
  assert.equal(g.searchParams.get('labels'), 'historia,pagos-en-linea');
  assert.ok(g.searchParams.get('body').includes('Definition of Done'));
  const l = new URL(urlLinear(i));
  assert.equal(l.hostname, 'linear.new');
  assert.equal(l.searchParams.get('title'), 'Pagar con tarjeta');
  assert.throws(() => urlGithub('mal', i), /dueño\/repositorio/);
});

test('historias demasiado largas piden copiar en vez de enlazar', () => {
  const p = proyecto();
  p.historias[0].criterios = Array.from({ length: 20 }, (_, k) => `Dado el caso ${k} con mucho detalle ${'x'.repeat(300)}`);
  assert.throws(() => urlLinear(issueDe(p, p.historias[0])), /demasiado larga/);
});
