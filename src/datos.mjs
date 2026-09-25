/**
 * Carga y valida el contenido: temario canónico y perfiles de universidades.
 *
 * El contenido vive en YAML (datos/) para que lo puedan revisar y corregir
 * abogados y profesores sin tocar código. Por lo mismo se valida al cargar:
 * un id mal escrito en un mapa de cédulas no puede llegar al estudiante como
 * un tema fantasma.
 */
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'yaml';
import { raizProyecto } from './lib/rutas.mjs';
import { parsearReferencia } from './fuentes/normas.mjs';

const RAMAS = ['civil', 'procesal'];

const leerYaml = async (ruta) => parse(await readFile(ruta, 'utf8'));

/**
 * @typedef {{id: string, titulo: string, rama: string, unidad: string, unidadTitulo: string,
 *   articulos: string[], requiere: string[], relacionados: string[], orden: number}} Tema
 */

/** @returns {Promise<{ramas: Record<string, {titulo: string, unidades: {id: string, titulo: string, temas: string[]}[]}>, temas: Map<string, Tema>}>} */
export async function cargarTemario(dir = join(raizProyecto(), 'datos', 'temario')) {
  const ramas = {};
  const temas = new Map();
  let orden = 0;
  for (const rama of RAMAS) {
    const doc = await leerYaml(join(dir, `${rama}.yaml`));
    ramas[rama] = { titulo: doc.titulo, unidades: [] };
    for (const u of doc.unidades) {
      const ids = [];
      for (const t of u.temas) {
        if (temas.has(t.id)) throw new Error(`Tema duplicado en el temario: ${t.id}`);
        temas.set(t.id, {
          id: t.id,
          titulo: t.titulo,
          rama,
          unidad: u.id,
          unidadTitulo: u.titulo,
          articulos: t.articulos ?? [],
          requiere: t.requiere ?? [],
          relacionados: t.relacionados ?? [],
          orden: orden++,
        });
        ids.push(t.id);
      }
      ramas[rama].unidades.push({ id: u.id, titulo: u.titulo, temas: ids });
    }
  }
  return { ramas, temas };
}

/**
 * Una universidad = perfil + cedularios por ramo + mapa cédula→temas.
 * Una universidad sin cedulario transcrito igual sirve: el perfil describe el
 * examen y el índice se arma con el temario canónico completo.
 */
export async function cargarUniversidades(dir = join(raizProyecto(), 'datos', 'universidades')) {
  const universidades = new Map();
  for (const id of (await readdir(dir, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name)) {
    const base = join(dir, id);
    const perfil = await leerYaml(join(base, 'perfil.yaml'));
    if (perfil.id !== id) throw new Error(`El perfil de ${id} dice id "${perfil.id}"`);
    const cedularios = {};
    const c = perfil.cedulario ?? {};
    const mapa = c.mapa ? await leerYaml(join(base, c.mapa)) : {};
    for (const rama of RAMAS) {
      if (!c[rama]) continue;
      const doc = await leerYaml(join(base, c[rama]));
      cedularios[rama] = doc.cedulas.map((ced) => ({
        ...ced,
        contenido: (ced.contenido ?? '').trimEnd(),
        temas: mapa[rama]?.[ced.numero] ?? [],
      }));
    }
    universidades.set(id, { perfil, cedularios });
  }
  return universidades;
}

/** Todos los errores de consistencia del contenido. Vacío = contenido sano. */
export function validar(temario, universidades) {
  const errores = [];
  const existe = (id) => temario.temas.has(id);

  for (const t of temario.temas.values()) {
    for (const r of t.requiere) if (!existe(r)) errores.push(`${t.id}: requiere un tema inexistente (${r})`);
    for (const r of t.relacionados) if (!existe(r)) errores.push(`${t.id}: relacionado con un tema inexistente (${r})`);
    if (t.requiere.includes(t.id)) errores.push(`${t.id}: se requiere a sí mismo`);
    for (const a of t.articulos) {
      try {
        parsearReferencia(a);
      } catch (e) {
        errores.push(`${t.id}: ${e.message}`);
      }
    }
  }

  // Prerrequisitos sin ciclos: con un ciclo, el plan de estudio no tiene por dónde empezar.
  const estado = new Map();
  const visitar = (id, camino) => {
    if (estado.get(id) === 'listo') return;
    if (estado.get(id) === 'visitando') {
      errores.push(`Ciclo de prerrequisitos: ${[...camino, id].join(' → ')}`);
      return;
    }
    estado.set(id, 'visitando');
    for (const r of temario.temas.get(id)?.requiere ?? []) visitar(r, [...camino, id]);
    estado.set(id, 'listo');
  };
  for (const id of temario.temas.keys()) visitar(id, []);

  for (const [uid, u] of universidades) {
    for (const [rama, cedulas] of Object.entries(u.cedularios)) {
      const vistos = new Set();
      for (const c of cedulas) {
        if (vistos.has(c.numero)) errores.push(`${uid}/${rama}: cédula ${c.numero} repetida`);
        vistos.add(c.numero);
        if (!c.tema) errores.push(`${uid}/${rama}: cédula ${c.numero} sin tema`);
        if (!c.temas.length) errores.push(`${uid}/${rama}: cédula ${c.numero} no está enlazada a ningún tema`);
        for (const t of c.temas) {
          if (!existe(t)) errores.push(`${uid}/${rama}: cédula ${c.numero} → tema inexistente ${t}`);
          else if (temario.temas.get(t).rama !== rama) errores.push(`${uid}/${rama}: cédula ${c.numero} → ${t} es de otra rama`);
        }
      }
    }
  }
  return errores;
}

let cache;
/** Contenido cargado y validado, una sola vez por proceso. */
export async function contenido() {
  if (!cache) {
    cache = (async () => {
      const temario = await cargarTemario();
      const universidades = await cargarUniversidades();
      const errores = validar(temario, universidades);
      if (errores.length) throw new Error(`Contenido inválido:\n- ${errores.join('\n- ')}`);
      return { temario, universidades };
    })();
  }
  return cache;
}
