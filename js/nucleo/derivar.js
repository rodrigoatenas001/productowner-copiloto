// Del proceso al backlog, por reglas (sin IA): cada tarea del circuito propone una historia.
// El carril da el rol; la tarea, lo que se quiere; su «para qué», el beneficio. Las salidas de las
// decisiones, los dolores confirmados y las esperas del flujo de valor se vuelven criterios
// «Dado… cuando… entonces…». Los cuellos de botella y los dolores confirmados suben la prioridad.
import { aHistoria, resumirTitulo } from './historias.js';
import { flujoDeValor, formatoDuracion } from './proceso.js';

const ES_SISTEMA = /\b(sistema|erp|sap|plataforma|software|app)\b/i;

// Carriles que son áreas, no personas: la historia es de quien está a cargo
const AREA = /^(recepci[oó]n|control de calidad|calidad|bodega|mantenimiento|adquisiciones|oficina t[eé]cnica|finanzas|abastecimiento|log[ií]stica|despacho|producci[oó]n|operaciones)\b/;

/** Nombre de carril como rol: «Capataz / supervisor» → «capataz»; «Recepción (romana)» → «encargado de recepción». */
function rolDe(nombre) {
  const base = String(nombre || '').replace(/\(.*?\)/g, '').split('/')[0].trim().toLowerCase();
  if (!base) return 'usuario';
  if (base.startsWith('jefatura')) return base.replace(/^jefatura/, 'jefe');
  return AREA.test(base) ? `encargado de ${base}` : base;
}

/** Épica desde el carril: el área tal cual, sin el «encargado de». */
const epicaDe = (nombre) => capitalizar(String(nombre || '').replace(/\(.*?\)/g, '').split('/')[0].trim().toLowerCase());

const sinSignos = (t) => String(t).replace(/^¿|\?$/g, '').trim();
const minuscula = (t) => (t && !/^[A-ZÁÉÍÓÚÑ]{2,}/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t);
const capitalizar = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

/**
 * Historias candidatas desde el proceso. Por omisión, solo para las tareas que aún no tienen historias.
 * Cada candidata trae `pasoId` para enlazarla a su paso al agregarla.
 */
export function historiasDesdeProceso(proyecto, { todas = false } = {}) {
  const proceso = proyecto.proceso || { carriles: [], pasos: [] };
  const carril = new Map(proceso.carriles.map((c) => [c.id, c.nombre]));
  const porId = new Map(proceso.pasos.map((p) => [p.id, p]));
  const { cuello } = flujoDeValor(proceso);
  const candidatas = [];
  let rolAnterior = 'usuario';

  for (const paso of proceso.pasos) {
    if (paso.tipo !== 'tarea') continue;
    const nombreCarril = carril.get(paso.carril) || '';
    // Un carril «Sistema» no es quien se beneficia: la historia es de la persona del paso anterior
    const rol = ES_SISTEMA.test(nombreCarril) ? rolAnterior : rolDe(nombreCarril);
    if (!ES_SISTEMA.test(nombreCarril)) rolAnterior = rol;
    if (!todas && paso.historiaIds.length) continue;

    const quiero = minuscula(paso.texto || 'completar este paso');
    const criterios = [];

    // Las salidas de la decisión que sigue son criterios concretos: qué pasa con cada respuesta
    for (const s of paso.siguientes) {
      const decision = porId.get(s.a);
      if (decision?.tipo !== 'decision') continue;
      for (const salida of decision.siguientes) {
        const destino = porId.get(salida.a);
        if (!destino) continue;
        criterios.push(`Dado un caso en que la respuesta a «${sinSignos(decision.texto)}» es «${salida.etiqueta || 'otra'}», cuando se completa este paso, entonces el flujo sigue a «${destino.texto}».`);
      }
    }
    const confirmados = (paso.dolores || []).filter((d) => d.confirmado);
    for (const d of confirmados) {
      criterios.push(`Dado que hoy ocurre «${minuscula(d.texto)}», cuando ${rol} ${quiero} con el sistema, entonces eso ya no ocurre.`);
    }
    if (Number.isFinite(paso.espera) && paso.espera > (paso.trabajo || 0)) {
      criterios.push(`Dado que hoy este paso espera ${formatoDuracion(paso.espera)} antes de empezar, cuando el sistema esté en uso, entonces la espera baja a lo acordado con el cliente.`);
    }
    if (!criterios.length) {
      criterios.push(`Dado un caso real, cuando ${rol} ${quiero}, entonces queda registrado con fecha y responsable, a la vista de quien sigue en el proceso.`);
    }

    const base = aHistoria({ texto: quiero, epica: epicaDe(nombreCarril) }, { rolPorDefecto: rol });
    const urgente = paso.id === cuello || confirmados.length > 0 || (Number.isFinite(paso.espera) && paso.espera > (paso.trabajo || 0));
    candidatas.push({
      ...base,
      rol,
      quiero,
      para: minuscula(paso.valor || ''),
      titulo: capitalizar(resumirTitulo(quiero)),
      criterios,
      reglas: [...(paso.reglas || [])],
      epica: epicaDe(nombreCarril),
      prioridad: urgente ? 'must' : 'should',
      notaOriginal: `Paso del proceso: ${paso.texto}`,
      pasoId: paso.id,
    });
  }
  return candidatas;
}

/** Enlaza cada historia agregada a su paso del proceso (las candidatas traen `pasoId`). */
export function enlazarConPasos(proyecto, historias) {
  const porPaso = new Map();
  for (const h of historias) if (h.pasoId) (porPaso.get(h.pasoId) || porPaso.set(h.pasoId, []).get(h.pasoId)).push(h.id);
  if (!porPaso.size || !proyecto.proceso) return proyecto;
  return {
    ...proyecto,
    proceso: {
      ...proyecto.proceso,
      pasos: proyecto.proceso.pasos.map((p) => (porPaso.has(p.id) ? { ...p, historiaIds: [...new Set([...p.historiaIds, ...porPaso.get(p.id)])] } : p)),
    },
  };
}

/**
 * Mezcla la redacción propuesta por la IA con las candidatas por reglas, por `pasoId`.
 * Solo reemplaza lo que viene bien formado (textos no vacíos, criterios «Dado…»); la prioridad,
 * la épica y el enlace al paso siguen siendo los de las reglas.
 */
export function mejorarConIa(candidatas, datos) {
  const lista = Array.isArray(datos?.historias) ? datos.historias : [];
  const txt = (v, max) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');
  const porPaso = new Map(lista.filter((x) => x && typeof x.pasoId === 'string').map((x) => [x.pasoId, x]));
  return candidatas.map((c) => {
    const ia = porPaso.get(c.pasoId);
    if (!ia) return c;
    const quiero = txt(ia.quiero, 1000).replace(/^poder\s+/i, '').replace(/[.\s]+$/, '');
    const criterios = (Array.isArray(ia.criterios) ? ia.criterios : []).map((x) => txt(x, 1000)).filter((x) => /^dad[oa]s?\b/i.test(x)).slice(0, 6);
    const reglas = (Array.isArray(ia.reglas) ? ia.reglas : []).map((x) => txt(x, 200)).filter(Boolean).slice(0, 8);
    const nuevoQuiero = quiero ? minuscula(quiero) : c.quiero;
    return {
      ...c,
      rol: txt(ia.rol, 120).toLowerCase() || c.rol,
      quiero: nuevoQuiero,
      titulo: quiero ? capitalizar(resumirTitulo(nuevoQuiero)) : c.titulo,
      para: minuscula(txt(ia.para, 1000).replace(/^para\s+(que\s+)?/i, '').replace(/[.\s]+$/, '')) || c.para,
      criterios: criterios.length ? criterios : c.criterios,
      reglas: reglas.length ? [...new Set([...c.reglas, ...reglas])] : c.reglas,
    };
  });
}

/** Contexto que se le da a la IA por cada candidata: el paso y lo que lo rodea. */
export function contextoParaIa(proyecto, candidatas) {
  const proceso = proyecto.proceso || { carriles: [], pasos: [] };
  const carril = new Map(proceso.carriles.map((c) => [c.id, c.nombre]));
  const porId = new Map(proceso.pasos.map((p) => [p.id, p]));
  return candidatas.map((c) => {
    const paso = porId.get(c.pasoId);
    const decisiones = (paso?.siguientes || []).map((s) => porId.get(s.a)).filter((d) => d?.tipo === 'decision')
      .map((d) => ({ pregunta: d.texto, salidas: d.siguientes.map((s) => ({ respuesta: s.etiqueta, va_a: porId.get(s.a)?.texto || '' })) }));
    return {
      pasoId: c.pasoId,
      actor: carril.get(paso?.carril) || '',
      paso: paso?.texto || '',
      para_que: paso?.valor || '',
      dolores_confirmados: (paso?.dolores || []).filter((d) => d.confirmado).map((d) => d.texto),
      reglas: paso?.reglas || [],
      decision_siguiente: decisiones,
      borrador: { rol: c.rol, quiero: c.quiero, para: c.para, criterios: c.criterios },
    };
  });
}
