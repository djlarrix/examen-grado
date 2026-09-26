#!/usr/bin/env node
/**
 * Comprueba contra Ley Chile cada plazo de datos/plazos.yaml: las frases de
 * `literal` deben aparecer en el texto vigente del artículo citado.
 *
 * Un plazo mal dicho es peor que ninguno: el estudiante lo memoriza. Si una
 * reforma cambia un plazo, este script falla y el plazo se corrige antes de
 * que llegue a nadie.
 *
 *   npm run verificar-plazos
 */
import { cargarPlazos } from '../src/datos.mjs';
import { parsearReferencia } from '../src/fuentes/normas.mjs';
import { verArticulo } from '../src/fuentes/leychile.mjs';

const normal = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
let errores = 0;
for (const p of await cargarPlazos()) {
  const { sigla, desde } = parsearReferencia(p.articulo);
  try {
    const a = await verArticulo(sigla, desde);
    const texto = normal(a.texto ?? '');
    const faltan = p.literal.filter((l) => !texto.includes(normal(l)));
    if (faltan.length) {
      errores++;
      console.log(`✗ ${p.id} (${p.articulo}): no dice ${faltan.map((f) => `"${f}"`).join(', ')}\n    ${(a.texto ?? '').replace(/\s+/g, ' ').slice(0, 300)}`);
    } else console.log(`✓ ${p.id} (${p.articulo})`);
  } catch (e) {
    errores++;
    console.log(`✗ ${p.id} (${p.articulo}): ${e.message}`);
  }
}
console.log(errores ? `\n${errores} plazo(s) con problemas.` : '\nTodos los plazos coinciden con el texto vigente.');
process.exit(errores ? 1 : 0);
