// Revisión en dos voces: un Revisor (mirada de QA y desarrollo) critica la historia y un
// Redactor (mirada de PO) la corrige. Las reglas INVEST hacen de tercer juez para decidir si
// vale otra vuelta. Nada se aplica sin que la persona lo acepte.
import { revisarInvest, resumirTitulo } from './historias.js';

export const VUELTAS_MAXIMAS = 2;

/** Llamadas máximas que hará una revisión: revisar + (redactar + revisar) por vuelta. */
export const llamadasMaximas = (vueltas = VUELTAS_MAXIMAS) => 1 + vueltas * 2;

const avisosFuertes = (h) => revisarInvest(h).filter((a) => a.nivel === 'aviso');

/**
 * @param {object} historia
 * @param {{
 *   revisar: (h: object) => Promise<{aprobada: boolean, observaciones: string[]}>,
 *   redactar: (h: object, observaciones: string[]) => Promise<{rol?: string, quiero?: string, para?: string, criterios?: string[]}>,
 *   vueltas?: number,
 *   alPaso?: (paso: {voz: 'revisor'|'redactor'|'reglas', texto: string, detalle?: string[]}) => void,
 * }} voces
 * @returns {Promise<{final: object, pasos: object[], llamadas: number, cambio: boolean}>}
 */
export async function revisarEnDosVoces(historia, { revisar, redactar, vueltas = VUELTAS_MAXIMAS, alPaso = () => {} }) {
  const pasos = [];
  const anotar = (paso) => { pasos.push(paso); alPaso(paso); };
  let actual = { ...historia, criterios: [...(historia.criterios || [])] };
  let llamadas = 0;

  for (let vuelta = 0; vuelta <= vueltas; vuelta++) {
    const critica = await revisar(actual);
    llamadas++;
    const observaciones = (critica.observaciones || []).filter((o) => typeof o === 'string' && o.trim()).slice(0, 6);
    const reglas = avisosFuertes(actual).map((a) => a.texto);

    anotar({
      voz: 'revisor',
      texto: critica.aprobada && !observaciones.length ? 'La historia está clara y se puede probar.' : `${observaciones.length} observaciones.`,
      detalle: observaciones,
    });

    const terminar = (critica.aprobada && !reglas.length) || vuelta === vueltas;
    if (terminar) {
      if (reglas.length) anotar({ voz: 'reglas', texto: 'Las reglas INVEST aún marcan algo; revísalo tú.', detalle: reglas });
      break;
    }

    const propuesta = await redactar(actual, [...observaciones, ...reglas]);
    llamadas++;
    actual = aplicarPropuesta(actual, propuesta);
    anotar({ voz: 'redactor', texto: 'Corrigió la historia con esas observaciones.' });
  }

  return { final: actual, pasos, llamadas, cambio: huella(actual) !== huella(historia) };
}

/** Aplica solo campos válidos de la propuesta del redactor; lo demás queda igual. */
export function aplicarPropuesta(historia, p = {}) {
  const txt = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
  const quiero = txt(p.quiero, 1000)?.replace(/^poder\s+/i, '').replace(/[.\s]+$/, '');
  const criterios = Array.isArray(p.criterios) ? p.criterios.map((c) => txt(c, 1000)).filter(Boolean).slice(0, 8) : [];
  return {
    ...historia,
    rol: txt(p.rol, 120)?.toLowerCase() || historia.rol,
    quiero: quiero || historia.quiero,
    titulo: quiero ? resumirTitulo(quiero).replace(/^./, (c) => c.toUpperCase()) : historia.titulo,
    para: txt(p.para, 1000)?.replace(/^para\s+(que\s+)?/i, '').replace(/[.\s]+$/, '') ?? historia.para,
    criterios: criterios.length ? criterios : historia.criterios,
  };
}

const huella = (h) => JSON.stringify([h.rol, h.quiero, h.para, h.criterios]);
