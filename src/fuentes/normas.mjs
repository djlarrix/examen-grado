/**
 * Siglas de las normas que usa el temario, con su idNorma en Ley Chile.
 *
 * Todas verificadas contra la BCN (`npm run verificar-articulos` falla si un
 * id deja de corresponder al título esperado). Agregar una norma nueva aquí
 * antes de usar su sigla en los YAML.
 */
export const NORMAS = {
  CC: { id: '172986', titulo: 'Código Civil' },
  CCOM: { id: '1974', titulo: 'Código de Comercio' },
  CPC: { id: '22740', titulo: 'Código de Procedimiento Civil' },
  COT: { id: '25563', titulo: 'Código Orgánico de Tribunales' },
  CPP: { id: '176595', titulo: 'Código Procesal Penal' },
  CPR: { id: '242302', titulo: 'Constitución Política de la República' },
  LPC: { id: '61438', titulo: 'Ley 19.496 sobre protección de los derechos de los consumidores' },
  L18010: { id: '29438', titulo: 'Ley 18.010 sobre operaciones de crédito de dinero' },
  L18101: { id: '29526', titulo: 'Ley 18.101 sobre arrendamiento de predios urbanos' },
  L18120: { id: '29544', titulo: 'Ley 18.120 sobre comparecencia en juicio' },
  L19968: { id: '229557', titulo: 'Ley 19.968 que crea los Tribunales de Familia' },
  L20830: { id: '1075210', titulo: 'Ley 20.830 que crea el Acuerdo de Unión Civil' },
  LMC: { id: '225128', titulo: 'Ley 19.947 de Matrimonio Civil' },
  LERL: { id: '225521', titulo: 'Ley sobre el efecto retroactivo de las leyes (1861)' },
  DL2695: { id: '6982', titulo: 'Decreto Ley 2.695 sobre regularización de la posesión de la pequeña propiedad raíz' },
};

/**
 * Expande una referencia del temario ("CC 1681-1683", "CPR 19") a sus partes.
 * Los rangos se guardan como extremos: no se inventan los artículos del medio,
 * que pueden no existir (hay "bis", derogados, numeración "1792-1"...).
 *
 * @param {string} ref
 * @returns {{sigla: string, desde: string, hasta: string|null, texto: string}}
 */
export function parsearReferencia(ref) {
  const m = String(ref).trim().match(/^([A-Z0-9]+)\s+(.+)$/);
  if (!m) throw new Error(`Referencia ilegible: "${ref}"`);
  const [, sigla, resto] = m;
  if (!NORMAS[sigla]) throw new Error(`Sigla desconocida "${sigla}" en "${ref}". Agrégala en src/fuentes/normas.mjs.`);
  // "1792-1" es un artículo (participación en los gananciales), no un rango.
  // Un rango tiene extremos numéricos de más de un dígito a ambos lados, o el
  // segundo mayor que el primero.
  const r = resto.match(/^(\d+)\s*-\s*(\d+)$/);
  if (r && Number(r[2]) > Number(r[1])) return { sigla, desde: r[1], hasta: r[2], texto: ref };
  return { sigla, desde: resto.trim(), hasta: null, texto: ref };
}

/** Cita legible: "arts. 1681 a 1683 del Código Civil". */
export function citaLegible(ref) {
  const { sigla, desde, hasta } = parsearReferencia(ref);
  const norma = NORMAS[sigla].titulo;
  return hasta ? `arts. ${desde} a ${hasta} — ${norma}` : `art. ${desde} — ${norma}`;
}
