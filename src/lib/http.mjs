/**
 * Cliente HTTP mínimo para Ley Chile.
 *
 * La BCN responde 401 sin User-Agent de navegador y 429 ("Service limit has
 * been reached") ante ráfagas modestas; por eso las peticiones al mismo host se
 * serializan con un intervalo mínimo y se reintentan con espera. Lo aprendido
 * en Responsa (src/lib/http.mjs), reducido a lo que este servidor necesita.
 */
export const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/** Intervalo mínimo entre peticiones por host, en ms. */
const RITMO = { 'www.leychile.cl': 2500 };
const ultima = new Map();
const colas = new Map();

function turno(host) {
  const min = RITMO[host];
  if (!min) return Promise.resolve();
  const previo = colas.get(host) ?? Promise.resolve();
  const propio = previo.then(async () => {
    const falta = min - (Date.now() - (ultima.get(host) ?? 0));
    if (falta > 0) await espera(falta);
    ultima.set(host, Date.now());
  });
  colas.set(host, propio.catch(() => {}));
  return propio;
}

/**
 * @param {string} url
 * @param {{headers?: Record<string,string>, timeoutMs?: number, intentos?: number}} [opts]
 * @returns {Promise<{ok: boolean, status: number, texto: string}>}
 */
export async function pedir(url, { headers = {}, timeoutMs = 30000, intentos = 3 } = {}) {
  const host = new URL(url).host;
  let ultimo = { ok: false, status: 0, texto: '' };
  for (let i = 0; i < intentos; i++) {
    await turno(host);
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: { 'User-Agent': UA, 'Accept-Language': 'es-CL,es;q=0.9', ...headers },
      });
      ultimo = { ok: res.ok, status: res.status, texto: await res.text() };
      // El 429 de la BCN no se suelta con esperas cortas: necesita segundos.
      if ((res.status === 429 || res.status >= 500) && i < intentos - 1) {
        await espera(res.status === 429 ? 4000 * (i + 1) : 800 * 2 ** i);
        continue;
      }
      return ultimo;
    } catch (e) {
      const causa = e?.cause?.message ? `: ${e.cause.message}` : '';
      ultimo = { ok: false, status: 0, texto: `${String(e?.message ?? e)}${causa}` };
      if (i < intentos - 1) await espera(500 * 2 ** i);
    } finally {
      clearTimeout(t);
    }
  }
  return ultimo;
}
