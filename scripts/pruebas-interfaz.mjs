// Corre las pruebas de interfaz (tests/ui.html) en Chrome o Edge sin ventana. Sin dependencias.
// (No se llama test-*.mjs para que `node --test` no lo ejecute como prueba.)
// Uso: npm run test:ui   (o CHROME=/ruta/al/navegador npm run test:ui)
import { servir, abrir, pausa } from './navegador.mjs';

const servidor = await servir();
let codigo = 1;
let navegador = null;
try {
  navegador = await abrir(`http://127.0.0.1:${servidor.address().port}/tests/ui.html`);
  let titulo = '';
  const fin = Date.now() + 240000;
  while (Date.now() < fin && !/^(OK|FALLA)/.test(titulo)) {
    await pausa(1000);
    titulo = (await navegador.evaluar('document.title')) || '';
  }
  const lineas = (await navegador.evaluar('[...document.querySelectorAll("#lista li")].map((l) => l.textContent)')) || [];
  lineas.forEach((l) => console.log(l));
  if (!/^(OK|FALLA)/.test(titulo)) throw new Error('Las pruebas no terminaron a tiempo.');
  const fallas = lineas.filter((l) => l.startsWith('✖')).length;
  console.log(`\n${lineas.length - fallas} de ${lineas.length} pruebas de interfaz pasaron.`);
  codigo = fallas ? 1 : 0;
} catch (e) {
  console.error(e.message);
} finally {
  await navegador?.cerrar();
  servidor.close();
}
process.exit(codigo);
