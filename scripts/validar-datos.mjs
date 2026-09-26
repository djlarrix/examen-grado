#!/usr/bin/env node
/** Valida el contenido (temario, cedularios, mapas) sin red. Corre en cada commit. */
import { cargarTemario, cargarUniversidades, validar, contenido } from '../src/datos.mjs';

const temario = await cargarTemario();
const universidades = await cargarUniversidades();
const errores = validar(temario, universidades);

const porRama = {};
for (const t of temario.temas.values()) porRama[t.rama] = (porRama[t.rama] ?? 0) + 1;
console.log(`Temario: ${temario.temas.size} temas (${Object.entries(porRama).map(([r, n]) => `${r} ${n}`).join(', ')})`);

for (const [id, u] of universidades) {
  const cubiertos = new Set(Object.values(u.cedularios).flat().flatMap((c) => c.temas));
  const n = Object.entries(u.cedularios).map(([r, c]) => `${r} ${c.length}`).join(', ') || 'sin cedulario';
  console.log(`${u.perfil.sigla}: ${n} cédulas; cubre ${cubiertos.size} temas del temario`);
  const fuera = [...temario.temas.values()].filter((t) => cubiertos.size && !cubiertos.has(t.id));
  if (fuera.length) console.log(`  temas fuera de su cedulario (${fuera.length}): ${fuera.map((t) => t.id.split('.').slice(1).join('.')).join(', ')}`);
}
if (errores.length) {
  console.log(`\n${errores.length} error(es):\n- ${errores.join('\n- ')}`);
  process.exit(1);
}
// Plazos y confusiones se validan al armar el contenido completo.
try {
  const { plazos, confusiones } = await contenido();
  console.log(`Plazos: ${plazos.length} · Pares de instituciones que se confunden: ${confusiones.length}`);
} catch (e) {
  console.log(`\n${e.message}`);
  process.exit(1);
}
console.log('\nContenido válido.');
