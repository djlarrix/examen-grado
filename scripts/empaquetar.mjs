#!/usr/bin/env node
/**
 * Arma los dos archivos que instala un estudiante sin tocar la terminal:
 *
 *   dist/examen-grado.mcpb               extensión de Claude Desktop (doble clic)
 *   dist/examen-grado-skill.zip          la skill, para Configuración → Capacidades
 *
 * El manifiesto de la extensión se genera desde package.json y desde las
 * definiciones reales de las herramientas, para que nunca describa algo que el
 * servidor no hace.
 *
 *   npm run empaquetar
 */
import { cp, mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { execFileSync, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { raizProyecto } from '../src/lib/rutas.mjs';
import { DEFINICIONES } from '../src/definiciones.mjs';
import { pdfConTexto } from '../test/pdf-prueba.mjs';

const raiz = raizProyecto();
const pkg = JSON.parse(await readFile(join(raiz, 'package.json'), 'utf8'));
const dist = join(raiz, 'dist');
const paquete = join(dist, 'paquete');
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const correr = (cmd, args, cwd = raiz) => execFileSync(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });

await rm(dist, { recursive: true, force: true });
await mkdir(paquete, { recursive: true });

// 1. Lo que corre: código, datos y la pedagogía (los prompts leen la skill).
for (const x of ['src', 'datos', 'skills', 'package.json', 'package-lock.json', 'README.md', 'LICENSE']) await cp(join(raiz, x), join(paquete, x), { recursive: true });
await cp(join(raiz, 'recursos', 'icono.png'), join(paquete, 'icono.png'));
correr(npm, ['ci', '--omit=dev', '--no-audit', '--no-fund'], paquete);
// Fuera lo que no se usa: el canvas nativo (sólo sirve para dibujar páginas y
// es un binario de una plataforma: el .mcpb armado en un Mac no le serviría a
// Windows), la versión moderna de pdfjs (se usa la legacy) y los mapas de fuente.
const sobra = ['node_modules/@napi-rs', 'node_modules/pdfjs-dist/build', 'node_modules/pdfjs-dist/web', 'node_modules/pdfjs-dist/types', 'node_modules/pdfjs-dist/image_decoders'];
for (const x of sobra) await rm(join(paquete, x), { recursive: true, force: true });
for (const f of ['pdf.mjs.map', 'pdf.worker.mjs.map', 'pdf.sandbox.mjs.map', 'pdf.sandbox.mjs', 'pdf.min.mjs', 'pdf.worker.min.mjs', 'pdf.sandbox.min.mjs']) await rm(join(paquete, 'node_modules/pdfjs-dist/legacy/build', f), { force: true });

const primeraOracion = (s) => s.split(/(?<=\.)\s/)[0];
const manifiesto = {
  manifest_version: '0.2',
  name: pkg.name,
  display_name: 'Examen de Grado (Derecho, Chile)',
  version: pkg.version,
  description: 'Preparador del examen de grado de Derecho en Chile: clases, repaso espaciado y simulacros de Civil y Procesal según el cedulario de tu universidad.',
  long_description:
    'Tutor para el examen de grado (licenciatura) de Derecho en Chile. Conoce el cedulario y el formato de examen de 15 universidades ' +
    '(oral, caso escrito, selección múltiple o mixto), agenda cada tema con repetición espaciada (FSRS), simula la comisión, arma casos con pauta ' +
    'y trae el texto vigente de las normas desde Ley Chile. Si tu universidad no está, sube tu cedulario y tus exámenes anteriores. ' +
    'Tu progreso queda en tu computador. Instala también la skill "examen-grado" para la experiencia completa.',
  author: { name: pkg.author, url: 'https://github.com/djlarrix' },
  icon: 'icono.png',
  homepage: pkg.homepage,
  repository: { type: 'git', url: pkg.repository.url.replace(/^git\+/, '') },
  support: pkg.bugs.url,
  license: pkg.license,
  keywords: pkg.keywords,
  server: {
    type: 'node',
    entry_point: 'src/arrancar.mjs',
    mcp_config: { command: 'node', args: ['${__dirname}/src/arrancar.mjs'], env: {} },
  },
  tools: DEFINICIONES.map((d) => ({ name: d.name, description: primeraOracion(d.description) })),
  compatibility: { platforms: ['darwin', 'win32', 'linux'], runtimes: { node: pkg.engines.node.replace(/^>=\s*/, '>=') + (pkg.engines.node.split('.').length < 3 ? '.0' : '') } },
};
// Pruebas de humo antes de empaquetar: el servidor de la carpeta arranca por el
// protocolo real y lee un PDF aun sin el canvas nativo.
const muestra = join(dist, 'muestra.pdf');
await writeFile(muestra, pdfConTexto(['Art. 1. Texto de prueba del paquete.']));
const leido = execFileSync(process.execPath, ['--input-type=module', '-e', `const m = await import(${JSON.stringify(pathToFileURL(join(paquete, 'src/lib/pdf.mjs')).href)}); const r = await m.extraerPaginas(${JSON.stringify(muestra)}); process.stdout.write(r.paginas[0].texto);`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
if (!leido.includes('Texto de prueba')) throw new Error(`El paquete no extrae texto de PDF: "${leido}"`);
const saludo = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'empaquetar', version: '1' } } });
const respuesta = spawnSync(process.execPath, [join(paquete, 'src', 'arrancar.mjs')], { input: saludo + '\n', encoding: 'utf8', timeout: 20000, env: { ...process.env, EXAMEN_GRADO_DIR: join(dist, 'datos-prueba'), EXAMEN_GRADO_SIN_PRECARGA: '1' } });
if (!respuesta.stdout.includes('"serverInfo"')) throw new Error(`El servidor empaquetado no respondió: ${respuesta.stderr}`);
await rm(muestra, { force: true });
await rm(join(dist, 'datos-prueba'), { recursive: true, force: true });
console.log('Pruebas de humo del paquete: PDF y protocolo MCP, OK.');

await writeFile(join(paquete, 'manifest.json'), JSON.stringify(manifiesto, null, 2) + '\n');
correr(npx, ['-y', '@anthropic-ai/mcpb', 'validate', join(paquete, 'manifest.json')]);
// Nombre estable: el README enlaza a releases/latest/download/examen-grado.mcpb.
const mcpb = join(dist, 'examen-grado.mcpb');
correr(npx, ['-y', '@anthropic-ai/mcpb', 'pack', paquete, mcpb]);

// 2. La skill, como la pide Claude: un .zip con la carpeta de la skill adentro.
const skill = join(dist, 'skill');
await cp(join(raiz, 'skills', 'examen-grado'), join(skill, 'examen-grado'), { recursive: true });
correr('zip', ['-qr', join(dist, 'examen-grado-skill.zip'), 'examen-grado'], skill);

await rm(paquete, { recursive: true, force: true });
await rm(skill, { recursive: true, force: true });
console.log(`\nListo:\n  ${mcpb}\n  ${join(dist, 'examen-grado-skill.zip')}`);
