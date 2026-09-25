/**
 * Ley Chile (BCN): texto oficial y vigente de los artículos.
 *
 * El tutor no cita un artículo de memoria: lo trae de aquí. Un manual de hace
 * diez años puede describir una norma que ya cambió (sociedad conyugal,
 * matrimonio, filiación), y para un estudiante eso es aprender algo falso.
 *
 * Servicio: opt=7&idNorma=… entrega la norma completa en XML estructurado. Se
 * descarga entera (opt=71, artículo suelto, es el primero en toparse con el
 * límite de la BCN) y queda en caché 7 días. Parseo tomado de Responsa.
 */
import { pedir } from '../lib/http.mjs';
import { conCache } from '../lib/cache.mjs';
import { NORMAS } from './normas.mjs';

const NORMA = 'https://www.leychile.cl/Consulta/obtxml?opt=7&idNorma=';
const BUSQUEDA = 'https://www.leychile.cl/Consulta/obtxml?opt=61&cadena=';
export const urlNavegar = (id) => `https://www.bcn.cl/leychile/navegar?idNorma=${id}`;

function decodificar(s) {
  return String(s ?? '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    // La BCN usa &#160; a destajo; decodificado rompe cualquier búsqueda.
    .replace(/ /g, ' ');
}

const etiqueta = (xml, tag) => decodificar(xml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`))?.[1] ?? '').trim();

/** Búsqueda de normas por texto. Sólo se usa para resolver siglas sin id fijo. */
export async function buscarNormas(consulta, limite = 8) {
  return conCache(`bcn:buscar:${consulta}:${limite}`, 86400 * 30, async () => {
    const res = await pedir(BUSQUEDA + encodeURIComponent(consulta), { headers: { Accept: 'application/xml' } });
    if (!res.ok) throw new Error(`Ley Chile respondió HTTP ${res.status} al buscar "${consulta}"`);
    return res.texto
      .split('<Norma>')
      .slice(1, limite + 1)
      .map((b) => ({
        idNorma: b.match(/<IdNorma>(\d+)<\/IdNorma>/)?.[1] ?? '',
        tipo: etiqueta(b, 'Descripcion'),
        numero: b.match(/<Numero>([^<]+)<\/Numero>/)?.[1] ?? '',
        titulo: etiqueta(b, 'TituloNorma'),
      }));
  });
}

/**
 * El texto de la BCN reproduce la edición impresa, con las notas de
 * modificación en el margen derecho de la misma línea:
 *
 *   "La nulidad absoluta puede y debe ser                L. 16.952\n
 *    declarada por el juez, aun sin petición de parte, cuando            Art. 1º"
 *
 * Leído de corrido queda "puede y debe ser L. 16.952 declarada por el juez",
 * que un estudiante puede memorizar tal cual. Se separan: el texto legal queda
 * limpio y en párrafos, y las notas se devuelven aparte.
 */
const NOTA_MARGEN = /^(.*\S)\s{3,}(\S.{0,45})$/;
const PARECE_NOTA = /\d|^(L\.|Ley|LEY|Art|ART|D\.?\s?L|D\.?F\.?L|D\.O|CPR|NOTA|Inc)/;

export function limpiarTexto(crudo) {
  const notas = [];
  const lineas = String(crudo).split('\n').map((l) => {
    const m = l.match(NOTA_MARGEN);
    if (m && PARECE_NOTA.test(m[2].trim())) {
      notas.push(m[2].trim());
      return m[1];
    }
    return l;
  });
  // Rearmar párrafos: la edición impresa corta cada ~60 caracteres. Una línea
  // con sangría (inciso nuevo, numeral) o precedida de una vacía abre párrafo.
  const parrafos = [];
  let nuevo = true;
  for (const l of lineas) {
    if (!l.trim()) {
      nuevo = true;
      continue;
    }
    if (nuevo || /^\s{2,}/.test(l) || !parrafos.length) parrafos.push(l.trim());
    else parrafos[parrafos.length - 1] += ` ${l.trim()}`;
    nuevo = false;
  }
  return { texto: parrafos.join('\n'), notas };
}

/** Norma completa, parseada y cacheada 7 días. */
async function normaCompleta(idNorma) {
  return conCache(`bcn:norma:${idNorma}`, 604800, async () => {
    const res = await pedir(NORMA + encodeURIComponent(idNorma), {
      headers: { Accept: 'application/xml' },
      timeoutMs: 90000,
      intentos: 5,
    });
    if (res.status === 429) throw new Error('Ley Chile alcanzó su límite de servicio. Reintenta en un minuto; después queda en caché.');
    if (!res.ok) throw new Error(`Ley Chile respondió HTTP ${res.status} para idNorma ${idNorma}`);
    const xml = res.texto;
    const articulos = [];
    for (const frag of xml.split('<EstructuraFuncional').slice(1)) {
      const cabecera = frag.slice(0, frag.indexOf('>') + 1);
      if (!/tipoParte="Art/.test(decodificar(cabecera))) continue;
      const crudo = decodificar(frag.match(/<Texto>([\s\S]*?)<\/Texto>/)?.[1] ?? '');
      const nombre = decodificar(frag.match(/<NombreParte[^>]*>([\s\S]*?)<\/NombreParte>/)?.[1] ?? '').trim();
      if (!crudo.trim()) continue;
      const { texto, notas } = limpiarTexto(crudo);
      articulos.push({ nombre, derogado: /derogado="derogado"/.test(cabecera), texto, notas });
    }
    const titulo = etiqueta(xml, 'TituloNorma');
    if (!titulo && !articulos.length) throw new Error(`Ley Chile no tiene una norma con idNorma ${idNorma}.`);
    return { idNorma: String(idNorma), titulo, version: xml.match(/fechaVersion="([^"]+)"/)?.[1] ?? '', articulos };
  });
}

/**
 * Los códigos se publican como texto refundido: el Código Civil es un DFL cuyo
 * artículo 2 CONTIENE el código. La BCN nombra "1545 (DEL ART. 2)" al artículo
 * 1545 del Código, y el DFL tiene además sus propios artículos 1 a 8.
 *
 * El contenedor también puede ir en palabras: la Ley de Matrimonio Civil está
 * entera dentro de su "Artículo primero" ("4 (DEL ART. PRIMERO)") y además
 * tiene artículos transitorios 1 a 8 sueltos. Si sólo se reconocieran dígitos,
 * el "art. 4" pedido sería el 4° TRANSITORIO, que trata de otra cosa: un
 * artículo real, vigente y equivocado.
 */
function partes(nombre) {
  const m = String(nombre).match(/^(.*?)\s*\(\s*DEL\s+ART\.?\s*([0-9A-ZÁÉÍÓÚÑ]+)\s*\)\s*$/i);
  return m ? { numero: m[1].trim(), cuerpo: m[2] } : { numero: String(nombre).trim(), cuerpo: '' };
}

const normalizar = (s) =>
  String(s ?? '').toLowerCase().replace(/^art[ií]culo\s*/, '').replace(/^art\.?\s*/, '').replace(/[°º]/g, '').replace(/\.$/, '').replace(/\s+/g, ' ').trim();

function elegir(articulos, buscado) {
  const objetivo = normalizar(buscado);
  const hits = articulos.filter((a) => normalizar(partes(a.nombre).numero) === objetivo);
  if (hits.length <= 1) return hits[0] ?? null;
  // Con homónimos, gana el del cuerpo con más artículos: el texto refundido.
  const porCuerpo = new Map();
  for (const a of articulos) {
    const c = partes(a.nombre).cuerpo;
    porCuerpo.set(c, (porCuerpo.get(c) ?? 0) + 1);
  }
  return hits.sort((x, y) => (porCuerpo.get(partes(y.nombre).cuerpo) ?? 0) - (porCuerpo.get(partes(x.nombre).cuerpo) ?? 0))[0];
}

/** Resuelve una sigla a su idNorma, buscando en la BCN si no está fijo. */
export async function idDeSigla(sigla) {
  const n = NORMAS[sigla];
  if (!n) throw new Error(`Sigla desconocida: ${sigla}`);
  if (n.id) return n.id;
  const res = await buscarNormas(n.buscar, 5);
  if (!res.length) throw new Error(`No se pudo ubicar en Ley Chile: ${n.titulo}`);
  return res[0].idNorma;
}

/**
 * Texto oficial de un artículo.
 * @param {string} sigla  p. ej. "CC", "CPC", "LMC"
 * @param {string} numero p. ej. "1545", "1792-1", "19"
 */
export async function verArticulo(sigla, numero) {
  const id = await idDeSigla(sigla);
  const norma = await normaCompleta(id);
  const hit = elegir(norma.articulos, numero);
  const base = { norma: NORMAS[sigla].titulo, sigla, idNorma: id, version: norma.version, url: urlNavegar(id) };
  if (!hit) return { ...base, encontrado: false, articulo: String(numero) };
  return {
    ...base,
    encontrado: true,
    articulo: partes(hit.nombre).numero,
    derogado: hit.derogado,
    ...(hit.derogado ? { advertencia: 'Este artículo figura DEROGADO en Ley Chile. No enseñarlo como vigente.' } : {}),
    ...(norma._desde_cache_vencida ? { nota_cache: `Ley Chile no respondió; texto de la copia del ${norma._desde_cache_vencida}.` } : {}),
    texto: hit.texto,
    ...(hit.notas?.length ? { modificado_por: hit.notas.join('; ') } : {}),
  };
}

/** Título oficial de la norma (para comprobar que la sigla apunta a la norma correcta). */
export async function tituloNorma(sigla) {
  const norma = await normaCompleta(await idDeSigla(sigla));
  return norma.titulo;
}
