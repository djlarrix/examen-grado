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

const dir = process.env.EXAMEN_GRADO_DIR || mkdtempSync(join(tmpdir(), 'examen-grado-'));
const transporte = new StdioClientTransport({
  command: process.execPath,
  args: [new URL('../src/index.mjs', import.meta.url).pathname],
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
try {
  await llamar('registrar_respuesta', { tema: 'no.existe', calificacion: 3 });
} catch (err) {
  console.log('error de uso bien informado:', err.message.slice(0, 80));
}
await cliente.close();
console.log('OK');
