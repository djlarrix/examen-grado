#!/usr/bin/env node
/**
 * Propone, para cada cédula de un cedulario importado, los temas del temario
 * canónico que trata. Es una AYUDA para quien arma el mapa: lo que propone se
 * revisa a mano antes de guardarlo en mapa-temas.yaml.
 *
 *   node scripts/sugerir-mapa.mjs <cedulario.yaml> [umbral]
 *
 * Puntaje: qué fracción del título de cada tema (ponderada por lo raro de cada
 * palabra en el temario) aparece en el texto de la cédula; el título de la
 * cédula pesa el doble que su contenido.
 */
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { cargarTemario } from '../src/datos.mjs';
import { tokens } from './importar-cedulario.mjs';

const [, , archivo, umbralTxt] = process.argv;
const umbral = Number(umbralTxt ?? 0.55);
const doc = parse(readFileSync(archivo, 'utf8'));
const temario = await cargarTemario();
const temas = [...temario.temas.values()].filter((t) => t.rama === doc.ramo);

// Palabras que no distinguen un tema de otro dentro del temario.
const GENERICAS = new Set(['concepto', 'general', 'generalidade', 'clasificacion', 'efecto', 'requisito', 'caracteristica', 'regimen', 'derecho', 'teoria']);
const df = new Map();
for (const t of temas) for (const w of tokens(t.titulo)) df.set(w, (df.get(w) ?? 0) + 1);
const peso = (w) => (GENERICAS.has(w) ? 0.2 : Math.log(1 + temas.length / (df.get(w) ?? 1)));

export function sugerir(cedula) {
  const enTitulo = tokens(cedula.tema);
  const enTexto = tokens(`${cedula.tema} ${cedula.contenido ?? ''}`);
  return temas
    .map((t) => {
      const ws = [...tokens(t.titulo)];
      const total = ws.reduce((a, w) => a + peso(w), 0) || 1;
      const texto = ws.filter((w) => enTexto.has(w)).reduce((a, w) => a + peso(w), 0) / total;
      const titulo = ws.filter((w) => enTitulo.has(w)).reduce((a, w) => a + peso(w), 0) / total;
      return { id: t.id, p: 0.6 * texto + 0.4 * titulo * 1.5 };
    })
    .filter((x) => x.p >= umbral)
    .sort((a, b) => b.p - a.p)
    .slice(0, 8);
}

for (const c of doc.cedulas) {
  const s = sugerir(c);
  console.log(`${c.numero}. ${c.tema}  ::  ${s.map((x) => `${x.id.split('.').slice(1).join('.')}(${x.p.toFixed(2)})`).join(' ')}`);
}
