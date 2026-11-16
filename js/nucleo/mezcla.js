// Mezcla de tres vías para trabajar en equipo: «base» es la última versión que ambos lados conocían,
// «local» lo que cambió aquí y «remoto» lo que llegó de otra persona. Lo que solo cambió un lado se
// conserva; si ambos cambiaron el mismo dato, gana el local (quien mezcla es quien guarda después).
// Las listas de objetos con `id` (historias, sprints, pasos…) se mezclan elemento por elemento, así
// dos personas pueden editar historias distintas, o campos distintos de la misma, sin pisarse.

const esObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const conId = (lista) => Array.isArray(lista) && lista.every((x) => esObjeto(x) && (typeof x.id === 'string' || typeof x.id === 'number'));

export function iguales(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((x, i) => iguales(x, b[i]));
  const ka = Object.keys(a).filter((k) => a[k] !== undefined);
  const kb = Object.keys(b).filter((k) => b[k] !== undefined);
  return ka.length === kb.length && ka.every((k) => iguales(a[k], b[k]));
}

/** Mezcla `local` y `remoto`, que partieron de `base`. */
export function mezclar(base, local, remoto) {
  if (iguales(local, remoto)) return local;
  if (iguales(base, local)) return remoto;
  if (iguales(base, remoto)) return local;
  if (esObjeto(local) && esObjeto(remoto)) return mezclarObjetos(esObjeto(base) ? base : {}, local, remoto);
  if (conId(local) && conId(remoto)) return mezclarPorId(conId(base) ? base : [], local, remoto);
  if (Array.isArray(local) && Array.isArray(remoto) && [local, remoto].every((l) => l.every((x) => typeof x !== 'object' || x === null))) {
    return mezclarSimples(Array.isArray(base) ? base : [], local, remoto);
  }
  return local;
}

function mezclarObjetos(base, local, remoto) {
  const salida = {};
  for (const k of new Set([...Object.keys(local), ...Object.keys(remoto)])) {
    const v = mezclar(base[k], local[k], remoto[k]);
    if (v !== undefined) salida[k] = v;
  }
  return salida;
}

/** Listas de valores simples (enlaces, etiquetas, reglas): se suman los agregados y se quitan los borrados de cualquier lado. */
function mezclarSimples(base, local, remoto) {
  const borrados = new Set(base.filter((x) => !local.includes(x) || !remoto.includes(x)));
  const salida = local.filter((x) => !borrados.has(x));
  for (const x of remoto) if (!base.includes(x) && !salida.includes(x)) salida.push(x);
  return salida;
}

function mezclarPorId(base, local, remoto) {
  const mapa = (l) => new Map(l.map((x) => [x.id, x]));
  const b = mapa(base);
  const l = mapa(local);
  const r = mapa(remoto);
  const resultado = new Map();
  for (const id of new Set([...l.keys(), ...r.keys(), ...b.keys()])) {
    const enB = b.get(id);
    const enL = l.get(id);
    const enR = r.get(id);
    if (enL && enR) resultado.set(id, mezclar(enB, enL, enR));
    else if (enL && !enR) {
      // Falta en remoto: si estaba en la base, el otro lo borró; se respeta salvo que aquí se haya editado
      if (!enB || !iguales(enB, enL)) resultado.set(id, enL);
    } else if (enR && !enL) {
      if (!enB || !iguales(enB, enR)) resultado.set(id, enR);
    }
  }
  // Orden: el del lado que reordenó; si los dos, el local. Lo que solo trae el otro va tras su vecino anterior.
  const ordenBase = base.map((x) => x.id).filter((id) => l.has(id) && r.has(id));
  const ordenLocal = local.map((x) => x.id).filter((id) => b.has(id) && r.has(id));
  const principal = iguales(ordenBase, ordenLocal) ? remoto : local;
  const secundario = principal === remoto ? local : remoto;
  const orden = principal.map((x) => x.id).filter((id) => resultado.has(id));
  secundario.forEach((x, i) => {
    if (!resultado.has(x.id) || orden.includes(x.id)) return;
    let pos = 0;
    for (let j = i - 1; j >= 0; j--) {
      const k = orden.indexOf(secundario[j].id);
      if (k >= 0) { pos = k + 1; break; }
    }
    orden.splice(pos, 0, x.id);
  });
  return orden.map((id) => resultado.get(id));
}
