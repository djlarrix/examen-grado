#!/usr/bin/env node
/**
 * Servidor MCP del preparador del examen de grado.
 *
 * Guarda el progreso del estudiante, agenda sus repasos (FSRS), conoce el
 * cedulario y el formato de examen de su universidad, trae normas vigentes de
 * Ley Chile y busca en sus manuales. La pedagogía va en la skill
 * (skills/examen-grado) y, para clientes sin skills, en los prompts de abajo.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, ListPromptsRequestSchema, GetPromptRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { Tutor, ErrorDeUso } from './herramientas.mjs';
import { DEFINICIONES } from './definiciones.mjs';
import { raizProyecto } from './lib/rutas.mjs';

const INSTRUCCIONES = `Preparador del examen de grado de Derecho en Chile (Civil y Procesal).

Al empezar una conversación sobre el examen de grado, llama a estado_estudiante. Si hay una skill "examen-grado" disponible, síguela; si no, usa los prompts de este servidor (empezar, clase, repaso, simulacro, diagnostico), que traen el método.

Reglas:
- El estudiante repetirá lo que digas frente a una comisión. No afirmes el contenido de un artículo sin traerlo con ver_articulo en esta conversación: los códigos cambian y los manuales envejecen.
- Doctrina atribuida a un autor, sólo desde buscar_en_manuales (con página). Sin manual, explica sin nombres de autores. No cites fallos de memoria.
- El estudiante recupera, no escucha: pregunta después de cada bloque de explicación y termina cada tema con el estudiante explicándolo solo.
- Registra cada respuesta evaluable con registrar_respuesta (1 otra vez, 2 difícil, 3 bien, 4 fácil; califica el primer intento y anota el error concreto). Sin registro no hay repaso espaciado.
- Adapta preguntas y simulacros al formato de su universidad (perfil_examen): oral con repreguntas, o escrito sobre un caso.
- Español de Chile, de tú, cercano y exigente.`;

const DIR_SKILL = join(raizProyecto(), 'skills', 'examen-grado');
const leer = (rel) => readFile(join(DIR_SKILL, rel), 'utf8');

/**
 * Prompts: la misma pedagogía de la skill, para clientes que no cargan skills
 * (por ejemplo, el servidor usado como conector remoto). Se leen de los mismos
 * archivos para que no haya dos versiones del método.
 */
const PROMPTS = {
  empezar: { descripcion: 'Empezar o retomar la preparación del examen de grado.', archivos: ['SKILL.md'], pedido: () => 'Quiero preparar mi examen de grado. Empecemos.' },
  diagnostico: { descripcion: 'Diagnóstico inicial para saber desde dónde parto.', archivos: ['SKILL.md', 'referencias/rubrica.md', 'referencias/modos/diagnostico.md'], pedido: () => 'Hazme un diagnóstico para saber cómo estoy.' },
  clase: {
    descripcion: 'Clase de un tema o cédula.',
    argumentos: [{ name: 'tema', description: 'Tema, cédula ("civil:40") o nombre de la materia.', required: true }],
    archivos: ['SKILL.md', 'referencias/fuentes.md', 'referencias/rubrica.md', 'referencias/modos/clase.md'],
    pedido: (a) => `Hazme una clase de: ${a.tema}`,
  },
  repaso: { descripcion: 'Repasar lo que toca hoy.', archivos: ['SKILL.md', 'referencias/rubrica.md', 'referencias/modos/repaso.md'], pedido: () => 'Hagamos los repasos de hoy.' },
  simulacro: { descripcion: 'Simulacro del examen con la comisión.', archivos: ['SKILL.md', 'referencias/rubrica.md', 'referencias/modos/simulacro.md'], pedido: () => 'Quiero hacer un simulacro del examen.' },
};

const servidor = new Server({ name: 'examen-grado', version: '0.1.0' }, { capabilities: { tools: {}, prompts: {} }, instructions: INSTRUCCIONES });
const tutor = new Tutor();

servidor.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: DEFINICIONES }));

servidor.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;
  const fn = tutor[name];
  if (!DEFINICIONES.some((d) => d.name === name) || typeof fn !== 'function') {
    return { isError: true, content: [{ type: 'text', text: `Herramienta desconocida: ${name}` }] };
  }
  try {
    const r = await fn.call(tutor, args);
    return { content: [{ type: 'text', text: JSON.stringify(r, null, 1) }] };
  } catch (e) {
    // Un error de uso se explica para que Claude corrija la llamada; uno
    // inesperado se informa tal cual, sin pretender que salió bien.
    const texto = e instanceof ErrorDeUso ? e.message : `Error interno en ${name}: ${e?.message ?? e}`;
    return { isError: true, content: [{ type: 'text', text: texto }] };
  }
});

servidor.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts: Object.entries(PROMPTS).map(([name, p]) => ({ name, description: p.descripcion, arguments: p.argumentos ?? [] })),
}));

servidor.setRequestHandler(GetPromptRequestSchema, async (req) => {
  const p = PROMPTS[req.params.name];
  if (!p) throw new Error(`Prompt desconocido: ${req.params.name}`);
  const textos = await Promise.all(p.archivos.map(async (f) => `<archivo nombre="${f}">\n${await leer(f)}\n</archivo>`));
  return {
    description: p.descripcion,
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `Actúa como el preparador descrito en estos archivos:\n\n${textos.join('\n\n')}\n\n---\n\n${p.pedido(req.params.arguments ?? {})}`,
        },
      },
    ],
  };
});

await servidor.connect(new StdioServerTransport());
