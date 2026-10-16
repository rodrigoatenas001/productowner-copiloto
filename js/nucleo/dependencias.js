// Dependencias entre ítems: "esta no puede empezar sin aquella". Causa típica de sprints que se caen.

/** Ítems de los que depende, que aún no están terminados. */
export function dependenciasPendientes(proyecto, historia) {
  const ids = new Set(historia.dependeDe || []);
  return proyecto.historias.filter((x) => ids.has(x.id) && x.estado !== 'done');
}

/** ¿Agregar "id depende de nueva" crearía un ciclo (A → B → … → A)? */
export function creaCiclo(proyecto, id, nueva) {
  if (id === nueva) return true;
  const porId = new Map(proyecto.historias.map((h) => [h.id, h]));
  const pendientes = [nueva];
  const vistos = new Set();
  while (pendientes.length) {
    const actual = pendientes.pop();
    if (actual === id) return true;
    if (vistos.has(actual)) continue;
    vistos.add(actual);
    pendientes.push(...(porId.get(actual)?.dependeDe || []));
  }
  return false;
}

export function agregarDependencia(proyecto, id, nueva) {
  if (creaCiclo(proyecto, id, nueva)) throw new Error('Esa dependencia formaría un ciclo: una esperaría a la otra para siempre.');
  return { ...proyecto, historias: proyecto.historias.map((h) => (h.id === id ? { ...h, dependeDe: [...new Set([...(h.dependeDe || []), nueva])] } : h)) };
}

export function quitarDependencia(proyecto, id, quitar) {
  return { ...proyecto, historias: proyecto.historias.map((h) => (h.id === id ? { ...h, dependeDe: (h.dependeDe || []).filter((d) => d !== quitar) } : h)) };
}

/**
 * Problemas de un sprint: historias que dependen de algo no terminado que tampoco está en este sprint.
 * (Si la dependencia está en el mismo sprint, el equipo puede ordenarlas; no se avisa.)
 * @returns {{historia: object, espera: object[]}[]}
 */
export function bloqueosDelSprint(proyecto, sprintId) {
  return proyecto.historias
    .filter((h) => h.sprintId === sprintId && h.estado !== 'done')
    .map((h) => ({ historia: h, espera: dependenciasPendientes(proyecto, h).filter((d) => d.sprintId !== sprintId) }))
    .filter((x) => x.espera.length);
}

/** Limpia dependencias de un respaldo: solo ids existentes, sin sí misma y sin ciclos. */
export function normalizarDependencias(historias) {
  const ids = new Set(historias.map((h) => h.id));
  let lista = historias.map((h) => ({ ...h, dependeDe: [...new Set((Array.isArray(h.dependeDe) ? h.dependeDe : []).filter((d) => typeof d === 'string' && ids.has(d) && d !== h.id))].slice(0, 20) }));
  // Rompe ciclos quitando la dependencia que los cierra
  for (const h of lista) {
    for (const d of [...h.dependeDe]) {
      const sinEsta = lista.map((x) => (x.id === h.id ? { ...x, dependeDe: x.dependeDe.filter((y) => y !== d) } : x));
      if (creaCiclo({ historias: sinEsta }, h.id, d)) lista = sinEsta;
    }
  }
  return lista;
}
