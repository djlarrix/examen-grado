#!/usr/bin/env node
/**
 * Punto de arranque del servidor. Hace tres cosas antes de cargarlo:
 *
 * 1. Comprueba la versión de Node: con una más antigua falta node:sqlite y el
 *    error sería críptico. Aquí se explica qué instalar.
 * 2. Si faltan las dependencias (un plugin de Claude Code instalado desde
 *    GitHub llega sin node_modules), las instala una vez con npm. La salida va
 *    a stderr: stdout es el canal del protocolo MCP y no puede ensuciarse.
 * 3. Carga el servidor.
 */
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const aviso = (m) => process.stderr.write(`examen-grado: ${m}\n`);

const [mayor, menor] = process.versions.node.split('.').map(Number);
if (mayor < 22 || (mayor === 22 && menor < 13)) {
  aviso(`necesita Node.js 22.13 o superior y está corriendo en ${process.versions.node}. Instala la versión LTS desde https://nodejs.org y reinicia Claude.`);
  process.exit(1);
}
try {
  await import('node:sqlite');
} catch {
  aviso(`este Node.js (${process.versions.node}) no trae node:sqlite. Instala Node.js LTS desde https://nodejs.org y, en Claude Desktop, desactiva "Usar Node.js incorporado" en Configuración → Extensiones.`);
  process.exit(1);
}

if (!existsSync(join(raiz, 'node_modules', '@modelcontextprotocol', 'sdk', 'package.json'))) {
  aviso('instalando dependencias (sólo la primera vez, ~1 minuto)…');
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const r = spawnSync(npm, ['install', '--omit=dev', '--no-audit', '--no-fund'], { cwd: raiz, stdio: ['ignore', 2, 2], shell: process.platform === 'win32' });
  if (r.status !== 0) {
    aviso(`no se pudieron instalar las dependencias. Abre una terminal en ${raiz} y ejecuta "npm install".`);
    process.exit(1);
  }
}

// stdout es el canal del protocolo: si una dependencia escribiera ahí con
// console.log, el cliente recibiría basura en vez de JSON-RPC.
console.log = console.info = console.debug = (...args) => console.error(...args);

await import('./index.mjs');
