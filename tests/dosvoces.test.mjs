import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aHistoria } from '../js/nucleo/historias.js';
import { revisarEnDosVoces, aplicarPropuesta, llamadasMaximas } from '../js/nucleo/dosvoces.js';

const buena = () => aHistoria({ texto: 'Como contadora, quiero descargar las boletas del mes en un ZIP, para declarar a tiempo' });
const floja = () => aHistoria({ texto: 'hacer el login rápido' });

test('si el revisor aprueba y las reglas no marcan nada, termina con una sola llamada', async () => {
  const r = await revisarEnDosVoces(buena(), {
    revisar: async () => ({ aprobada: true, observaciones: [] }),
    redactar: async () => { throw new Error('no debería redactar'); },
  });
  assert.equal(r.llamadas, 1);
  assert.equal(r.cambio, false);
  assert.deepEqual(r.pasos.map((p) => p.voz), ['revisor']);
});

test('critica, corrige y vuelve a revisar hasta que queda bien', async () => {
  let rondas = 0;
  const r = await revisarEnDosVoces(floja(), {
    revisar: async (h) => (h.para ? { aprobada: true, observaciones: [] } : { aprobada: false, observaciones: ['¿Para qué sirve?', '"rápido" no se puede probar'] }),
    redactar: async (h, obs) => {
      rondas++;
      assert.ok(obs.includes('¿Para qué sirve?'));
      assert.ok(obs.some((o) => o.includes('para qué')), 'también recibe los avisos de las reglas');
      return { rol: 'Cliente', quiero: 'poder iniciar sesión con correo y clave en menos de 2 segundos', para: 'comprar sin esperas', criterios: ['Dado un correo válido…', 'Dado una clave incorrecta…'] };
    },
  });
  assert.equal(rondas, 1);
  assert.equal(r.llamadas, 3);
  assert.equal(r.cambio, true);
  assert.equal(r.final.rol, 'cliente');
  assert.equal(r.final.quiero, 'iniciar sesión con correo y clave en menos de 2 segundos');
  assert.deepEqual(r.pasos.map((p) => p.voz), ['revisor', 'redactor', 'revisor']);
});

test('nunca pasa del máximo de vueltas aunque el revisor nunca apruebe', async () => {
  const r = await revisarEnDosVoces(floja(), {
    revisar: async () => ({ aprobada: false, observaciones: ['otra cosa más'] }),
    redactar: async () => ({}),
    vueltas: 2,
  });
  assert.equal(r.llamadas, llamadasMaximas(2));
  assert.equal(r.llamadas, 5);
  assert.equal(r.pasos.at(-1).voz, 'reglas', 'avisa que las reglas aún marcan algo');
});

test('aplicarPropuesta ignora campos vacíos o inválidos', () => {
  const h = buena();
  const r = aplicarPropuesta(h, { rol: '', quiero: 42, para: '   ', criterios: ['', 5] });
  assert.deepEqual([r.rol, r.quiero, r.para, r.criterios], [h.rol, h.quiero, h.para, h.criterios]);
});

test('los errores de la IA se propagan para que la interfaz los muestre', async () => {
  await assert.rejects(revisarEnDosVoces(buena(), { revisar: async () => { throw new Error('La IA tardó demasiado'); }, redactar: async () => ({}) }), /tardó/);
});
