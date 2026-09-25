/**
 * Caché en disco para lo que viene de fuera (Ley Chile).
 *
 * Imprescindible, no un lujo: la BCN corta con 429 a la tercera petición
 * seguida y un código completo pesa varios MB de XML. Con la caché, una norma
 * se descarga una vez por semana y el resto de las consultas son locales.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { directorioDatos } from './rutas.mjs';

/** Subir cuando cambie la forma de lo que se guarda, para no servir formatos viejos. */
const VERSION = 2;

const dir = () => join(directorioDatos(), 'cache');
const ruta = (clave) => join(dir(), createHash('sha256').update(`v${VERSION}:${clave}`).digest('hex').slice(0, 32) + '.json');

/**
 * @template T
 * @param {string} clave
 * @param {number} ttlSegundos
 * @param {() => Promise<T>} produce
 * @returns {Promise<T>}
 */
export async function conCache(clave, ttlSegundos, produce) {
  await mkdir(dir(), { recursive: true });
  const f = ruta(clave);
  let viejo;
  try {
    viejo = JSON.parse(await readFile(f, 'utf8'));
    if (Date.now() - viejo.t < ttlSegundos * 1000) return viejo.v;
  } catch {
    // sin caché o corrupta
  }
  try {
    const v = await produce();
    await writeFile(f, JSON.stringify({ t: Date.now(), v }), 'utf8').catch(() => {});
    return v;
  } catch (e) {
    // Si Ley Chile está caída o limitando, una copia vencida es mejor que nada:
    // los códigos cambian poco de una semana a otra. Se marca para avisarlo.
    if (viejo) return { ...viejo.v, _desde_cache_vencida: new Date(viejo.t).toISOString().slice(0, 10) };
    throw e;
  }
}
