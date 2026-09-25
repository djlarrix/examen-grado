# Examen de Grado

Preparador del examen de grado de Derecho en Chile, en **Derecho Civil y Derecho Procesal**. Es un servidor MCP más una skill para Claude: da clases, hace repasar con repetición espaciada, simula la comisión (oral o escrita según la universidad), prepara material de estudio y responde dudas con fuentes que se pueden verificar.

Creado por Joaquín Larraín Guimoye.

## Qué lo hace distinto

**Se adapta a cada universidad.** Cada universidad tiene su cedulario y su forma de examinar. En la U. de Chile el examen es oral, ante una comisión que interroga sobre "los principios fundamentales de las instituciones" y evalúa "comprensión, análisis y síntesis" (Reglamento, art. 16). En la UDP son dos pruebas escritas sobre un caso ficticio, con códigos a la vista. El tutor lee el perfil de la universidad del estudiante y cambia la forma de preguntar, de simular y de corregir.

**Un solo temario, muchos cedularios.** El progreso se lleva sobre un temario canónico de 272 temas. Cada cedulario enlaza sus cédulas con esos temas, así que el índice que ve el estudiante es el de su propia universidad, en su orden y con su numeración.

**Enseña con método, no sólo explica.** La práctica de recuperación y la repetición espaciada son las dos técnicas de estudio mejor respaldadas por la investigación (Dunlosky et al., 2013). El tutor hace que el estudiante recupere en vez de releer, agenda cada tema con FSRS (el algoritmo de Anki) antes de que se olvide, intercala Civil y Procesal, respeta prerrequisitos y corrige nombrando el error concreto. La base de cada decisión está en [`skills/examen-grado/referencias/metodologia.md`](skills/examen-grado/referencias/metodologia.md).

**No puede inventar la ley.** El texto de las normas viene siempre de Ley Chile, vigente, con las notas de modificación separadas. La doctrina sólo se atribuye a un autor si viene del manual que el propio estudiante cargó, con página. Cada artículo citado en el temario se comprueba contra Ley Chile con `npm run verificar-articulos`, y se revisó a mano que cada número corresponda a su materia.

## Universidades

| Universidad | Examen | Cedulario | Fuente |
|---|---|---|---|
| Universidad de Chile | Oral ante comisión | 168 cédulas de Civil, 69 de Procesal (civil, orgánico y penal), transcritas del cedulario oficial | [Cedulario](https://weblex.derecho.uchile.cl/FTP/comunicaciones/documentos/Sec_estudio/8_Cedulario_Pregrado.pdf), [Reglamento](https://weblex.derecho.uchile.cl/FTP/comunicaciones/documentos/Sec_estudio/6_ReglamentoParaOptarAlGrado.pdf) |
| Universidad Diego Portales | Dos pruebas escritas sobre un caso | 7 cursos de Civil y 4 de Procesal Civil, con materias incluidas, excluidas y bibliografía | [Examen de Grado UDP](https://derecho.udp.cl/facultad/examen-de-grado/) |

Una universidad sin perfil también funciona: se usa el temario completo y el estudiante cuenta cómo es su examen. Agregar una universidad es agregar una carpeta en `datos/universidades/` (ver [CLAUDE.md](CLAUDE.md)).

## Cómo se usa

El estudiante sólo conversa. Al empezar, el tutor pregunta universidad, fecha del examen y horas por semana, y ofrece un diagnóstico. Desde ahí, cada día:

- **"¿Qué me toca hoy?"**: repasos vencidos (del más olvidado al menos), temas nuevos y, si corresponde, un simulacro, dentro de los minutos disponibles.
- **"Muéstrame el índice"**: el cedulario de su universidad con el estado de cada cédula (⚪ sin ver, 🔴 débil, 🟠 aprendiendo, 🟡 consolidando, 🟢 dominado). El estudiante elige qué ver y esos temas pasan primero.
- **"Hazme una clase de la cédula 40"**: pregunta de entrada, explicación por bloques con preguntas intermedias, caso resuelto, caso para el estudiante y reconstrucción del tema sin apoyo.
- **"Quiero un simulacro"**: sortea cédulas y hace de comisión (presidente, profesor de Civil, profesor de Procesal), o arma un caso escrito según su universidad. Al final, nota de 1 a 7 con rúbrica.
- **"Hazme un cuadro de nulidad absoluta y relativa"**: fichas, cuadros comparativos, líneas de tiempo procesales, tarjetas.
- **Cualquier duda**, respondida con la norma vigente y, si cargó su manual, con la cita de página.

## Herramientas del servidor

| Herramienta | Para qué |
|---|---|
| `estado_estudiante` | Punto de entrada: configuración, plan, racha y sesión sugerida |
| `configurar_estudiante` | Universidad, fecha de examen, horas y días de estudio |
| `sesion_de_hoy` / `plan_estudio` | Qué estudiar hoy; fases y ritmo hasta el examen, con advertencia si no alcanza |
| `ver_indice` / `buscar_temario` / `elegir_temas` | Índice con estado, búsqueda y selección de contenidos |
| `ver_tema` | Cédula, normas, prerrequisitos, relaciones y errores anteriores del estudiante |
| `registrar_respuesta` | Califica una recuperación (1–4) y reprograma el repaso |
| `sortear_cedula` / `registrar_simulacro` | Simulacros por universidad |
| `progreso` | Dominio por unidad, simulacros, temas que más se olvidan, errores |
| `ver_articulo` | Texto vigente de un artículo desde Ley Chile |
| `agregar_manual` / `buscar_en_manuales` / `listar_manuales` / `quitar_manual` | Manuales propios del estudiante, con búsqueda y cita de página |
| `guardar_material` / `ver_material` | Material de estudio guardado |
| `listar_universidades` / `perfil_examen` | Universidades y formato de su examen, con fuente |

Además expone *prompts* (`empezar`, `diagnostico`, `clase`, `repaso`, `simulacro`) con el mismo método, para clientes que no cargan skills.

## Instalación

Requiere Node.js 22.13 o superior (usa el SQLite incluido en Node; no hay nada que compilar).

```bash
git clone <repo> ~/examen-grado
cd ~/examen-grado
npm install
```

**Claude Code**: registra el servidor y copia la skill.

```bash
claude mcp add examen-grado -- node ~/examen-grado/src/index.mjs
```

```bash
cp -R ~/examen-grado/skills/examen-grado ~/.claude/skills/
```

**Claude Desktop**: agrega el servidor a `claude_desktop_config.json` y agrega la skill `skills/examen-grado` (comprimida en .zip) desde la sección de Skills de la configuración.

```json
{
  "mcpServers": {
    "examen-grado": { "command": "node", "args": ["/Users/<tu-usuario>/examen-grado/src/index.mjs"] }
  }
}
```

La carpeta también es un plugin de Claude Code (`.claude-plugin/plugin.json`). Abierta como proyecto en Claude Code, `.mcp.json` levanta el servidor y `.claude/skills` expone la skill.

## Privacidad y derechos de autor

- El progreso del estudiante vive en su computador, en `~/.examen-grado/estudio.sqlite` (se puede mover con `EXAMEN_GRADO_DIR`).
- Los manuales no se distribuyen con el proyecto: cada estudiante carga los suyos. Los PDF no se suben a ningún servidor; se indexa su texto localmente y sólo los pasajes que se consultan pasan a la conversación con Claude.

## Desarrollo

```bash
npm test                       # pruebas (sin red)
npm run validar                # consistencia de temario, cedularios y mapas
npm run verificar-articulos    # cada artículo del temario contra Ley Chile (con red)
node scripts/probar-servidor.mjs   # recorrido por el protocolo MCP real
```

## Hoja de ruta

1. **Más universidades**: PUC, Concepción, PUCV, Valparaíso, Los Andes, UAI, Finis Terrae, Central, Andrés Bello y Autónoma, entre otras, según cuáles mantengan examen de grado. Cada una necesita su cedulario oficial y su reglamento.
2. **Validación con estudiantes y profesores**: revisión del temario canónico y de los perfiles de comisión por docentes de cada facultad; piloto con estudiantes que rinden este semestre.
3. **Servidor remoto multiusuario**: para que los estudiantes lo usen como conector en claude.ai sin instalar nada. El esquema de datos ya separa por estudiante; falta el transporte HTTP con autenticación.
4. **Cédulas electivas** de la U. de Chile y ramos adicionales de otras facultades.
5. **Banco de casos** revisado por profesores para los exámenes escritos.
