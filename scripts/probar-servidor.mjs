#!/usr/bin/env node
/**
 * Prueba de humo por el protocolo MCP real: levanta el servidor por stdio,
 * lista herramientas y prompts, y hace un recorrido corto. Usa un directorio
 * de datos temporal para no tocar el progreso real del estudiante.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const dir = process.env.EXAMEN_GRADO_DIR || mkdtempSync(join(tmpdir(), 'examen-grado-'));
const transporte = new StdioClientTransport({
  command: process.execPath,
  args: [fileURLToPath(new URL('../src/arrancar.mjs', import.meta.url))],
  env: { ...process.env, EXAMEN_GRADO_DIR: dir },
});
const cliente = new Client({ name: 'prueba', version: '1.0.0' });
await cliente.connect(transporte);

const llamar = async (name, args = {}) => {
  const r = await cliente.callTool({ name, arguments: args });
  const texto = r.content[0].text;
  if (r.isError) throw new Error(`${name}: ${texto}`);
  return JSON.parse(texto);
};

const { tools } = await cliente.listTools();
const { prompts } = await cliente.listPrompts();
console.log(`${tools.length} herramientas, ${prompts.length} prompts`);
console.log('instrucciones:', (cliente.getInstructions() ?? '').split('\n')[0]);

console.log('estado inicial configurado =', (await llamar('estado_estudiante')).configurado);
await llamar('configurar_estudiante', { universidad: 'uchile', fecha_examen: '2027-04-30', horas_semana: 12 });
const e = await llamar('estado_estudiante');
console.log('hoy:', e.sesion_de_hoy.temas_nuevos.map((t) => t.titulo).join(' | '));
const a = await llamar('ver_articulo', { norma: 'Código Civil', articulo: '1683' });
console.log('art. 1683 CC:', a.texto.replace(/\s+/g, ' ').slice(0, 120));
const lmc = await llamar('ver_articulo', { norma: 'Ley 19.947', articulo: '4' });
console.log('art. 4 LMC:', lmc.texto.replace(/\s+/g, ' ').slice(0, 90));
const p = await cliente.getPrompt({ name: 'clase', arguments: { tema: 'civil:40' } });
console.log('prompt clase:', p.messages[0].content.text.length, 'caracteres');

// Recorrido de un estudiante de la UNAB (selección múltiple por ejercicios), sin red.
await llamar('configurar_estudiante', { universidad: 'unab', fecha_examen: '2026-12-15', horas_semana: 10 });
const d = await llamar('diagnostico', { cantidad: 6 });
assert.equal(d.temas.length, 6);
await llamar('registrar_respuesta', { tema: d.temas[0].id, calificacion: 1, modo: 'diagnostico', confianza: 'alta' });
await llamar('registrar_respuesta', { tema: d.temas[1].id, calificacion: 4, modo: 'diagnostico', confianza: 'media' });
const s = await llamar('sesion_de_hoy', {});
assert.ok(s.agenda.length > 1 && s.temas_nuevos[0].id === d.temas[0].id);
console.log('agenda:', s.agenda.map((b) => `${b.minuto}' ${b.bloque}`).join(' · ').slice(0, 160));
await llamar('elegir_temas', { agregar: ['ejercicio:1'] });
const sorteo = await llamar('sortear_cedula', { ejercicio: 1 });
assert.ok(sorteo.sorteo.every((x) => x.modalidad === 'seleccion_multiple'));
const pl = await llamar('practicar_plazos', { rama: 'procesal', cantidad: 3 });
console.log('plazo:', pl.preguntas[0].pregunta.slice(0, 70), '→', pl.preguntas[0].respuesta);
const disc = await llamar('practicar_discriminacion', { tema: 'procesal.recursos.apelacion' });
console.log('par:', disc.pares[0].par, '—', disc.pares[0].comparar_por.length, 'ejes');
const expo = await llamar('preparar_exposicion', { rama: 'civil', numero: 1, minutos: 8 });
console.log('exposición:', expo.debe_cubrir.length, 'puntos,', expo.guion.bloques.length, 'bloques');
const anki = await llamar('exportar', { formato: 'anki' });
const ics = await llamar('exportar', { formato: 'calendario', hora: '19:30' });
console.log('exportado:', anki.tarjetas, 'tarjetas;', ics.sesiones, 'sesiones en el calendario');
const prog = await llamar('progreso', {});
assert.ok(prog.calibracion.por_confianza);
for (const nombre of ['plazos', 'confusiones', 'exposicion', 'simulacro', 'diagnostico']) {
  const pr = await cliente.getPrompt({ name: nombre, arguments: nombre === 'exposicion' ? { cedula: 'civil:1' } : {} });
  assert.ok(pr.messages[0].content.text.length > 1000, nombre);
}
console.log('prompts nuevos: OK');

try {
  await llamar('registrar_respuesta', { tema: 'no.existe', calificacion: 3 });
} catch (err) {
  console.log('error de uso bien informado:', err.message.slice(0, 80));
}
await cliente.close();
console.log('OK');
