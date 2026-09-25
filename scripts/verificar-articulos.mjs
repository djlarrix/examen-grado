#!/usr/bin/env node
/**
 * Comprueba contra Ley Chile cada artículo citado en el temario.
 *
 * Un artículo mal citado en el temario se repite en cada clase que el tutor da
 * sobre ese tema, a miles de estudiantes. Este script falla si:
 *   - un artículo no existe en la norma (número equivocado);
 *   - un artículo figura derogado;
 * y con --texto imprime el comienzo de cada artículo para revisar a ojo que el
 * número corresponda a la materia (el error más probable no es un artículo
 * inexistente, sino uno que existe y trata de otra cosa).
 *
 *   npm run verificar-articulos            # sólo errores
 *   npm run verificar-articulos -- --texto # con extracto de cada artículo
 */
import { cargarTemario } from '../src/datos.mjs';
import { parsearReferencia, NORMAS } from '../src/fuentes/normas.mjs';
import { verArticulo, tituloNorma } from '../src/fuentes/leychile.mjs';

const conTexto = process.argv.includes('--texto');
const filtro = process.argv.find((a) => a.startsWith('--rama='))?.split('=')[1];
const temario = await cargarTemario();

// 1. Cada sigla apunta a la norma que dice.
const siglas = new Set();
for (const t of temario.temas.values()) for (const r of t.articulos) siglas.add(parsearReferencia(r).sigla);
let errores = 0;
for (const s of siglas) {
  const t = await tituloNorma(s);
  console.log(`${s.padEnd(7)} ${NORMAS[s].id.padEnd(8)} ${t.slice(0, 90)}`);
}
console.log();

// 2. Cada extremo de cada referencia existe y está vigente.
for (const t of temario.temas.values()) {
  if (filtro && t.rama !== filtro) continue;
  for (const ref of t.articulos) {
    const { sigla, desde, hasta } = parsearReferencia(ref);
    for (const n of hasta ? [desde, hasta] : [desde]) {
      const a = await verArticulo(sigla, n);
      if (!a.encontrado) {
        errores++;
        console.log(`✗ ${t.id}: ${sigla} ${n} NO EXISTE`);
      } else if (a.derogado) {
        errores++;
        console.log(`✗ ${t.id}: ${sigla} ${n} DEROGADO`);
      } else if (conTexto) {
        console.log(`  ${t.id} | ${sigla} ${n} | ${a.texto.replace(/\s+/g, ' ').slice(0, 150)}`);
      }
    }
  }
}
console.log(errores ? `\n${errores} problema(s).` : '\nTodos los artículos existen y están vigentes.');
process.exit(errores ? 1 : 0);
