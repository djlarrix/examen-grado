# Examen de Grado

Preparador del examen de grado de Derecho en Chile, en **Derecho Civil y Derecho Procesal**. Es un servidor MCP más una skill para Claude: da clases, hace repasar con repetición espaciada, simula la comisión (oral o escrita según la universidad), prepara material de estudio y responde dudas con fuentes que se pueden verificar.

Creado por Joaquín Larraín Guimoye.

## Qué lo hace distinto

**Se adapta a cada universidad.** Cada universidad tiene su cedulario y su forma de examinar. En la U. de Chile el examen es oral, ante una comisión que interroga sobre "los principios fundamentales de las instituciones" y evalúa "comprensión, análisis y síntesis" (Reglamento, art. 16). En la UDP son dos pruebas escritas sobre un caso ficticio, con códigos a la vista. El tutor lee el perfil de la universidad del estudiante y cambia la forma de preguntar, de simular y de corregir.

**Un solo temario, muchos cedularios.** El progreso se lleva sobre un temario canónico de 272 temas. Cada cedulario oficial (721 cédulas transcritas de nueve universidades; la UDD aún no publica las suyas) enlaza sus cédulas con esos temas, así que el índice que ve el estudiante es el de su propia universidad, en su orden y con su numeración.

**Enseña con método, no sólo explica.** La práctica de recuperación y la repetición espaciada son las dos técnicas de estudio mejor respaldadas por la investigación (Dunlosky et al., 2013). El tutor hace que el estudiante recupere en vez de releer, agenda cada tema con FSRS (el algoritmo de Anki) antes de que se olvide, intercala Civil y Procesal, respeta prerrequisitos y corrige nombrando el error concreto. La base de cada decisión está en [`skills/examen-grado/referencias/metodologia.md`](skills/examen-grado/referencias/metodologia.md).

**No puede inventar la ley.** El texto de las normas viene siempre de Ley Chile, vigente, con las notas de modificación separadas. La doctrina sólo se atribuye a un autor si viene del manual que el propio estudiante cargó, con página. Cada artículo citado en el temario se comprueba contra Ley Chile con `npm run verificar-articulos`, y se revisó a mano que cada número corresponda a su materia.

## Universidades

Diez facultades: las presentes en el ranking QS de Law & Legal Studies 2025–2026 (UC, U. de Chile, UAI, PUCV, UdeC, USACH, U. de Talca, UACh y UDD) y la UDP. Cada perfil cita su fuente; lo que no está en una fuente oficial queda marcado "por confirmar".

| Universidad | Examen | Cedulario cargado |
|---|---|---|
| U. de Chile | Oral: exposición de cédula + interrogación de Civil y Procesal (Reglamento, arts. 15–16) | Civil 168 cédulas, Procesal 69 |
| UC | Oral: Civil, Procesal y una cédula electiva, ante tres profesores | Civil 34 capítulos, Procesal 30 (vigentes desde abril 2021), con exclusiones |
| UAI | Escrito: un caso de Civil (210 min) y dos de Procesal Civil (120 min cada uno), con pauta por ítems | Civil 41 temas; Procesal: pendiente (se usa el temario sin proceso penal) |
| UDP | Escrito: dos pruebas sobre un caso ficticio, con códigos | Civil 7 cursos, Procesal Civil 4, con incluidas, excluidas y bibliografía |
| PUCV | Oral ante cuatro o más profesores: Público, Civil y Procesal; régimen desagregado | Civil 36 apartados, Procesal 58 (Res. 23 y 24/2016-F) |
| USACH | Oral y público: Civil, Procesal y una cédula electiva | Civil 164 cédulas, Procesal 23 secciones |
| UACh | Oral: exposición de cédula de especialización + Civil, Procesal y Constitucional | Civil 35 unidades, Procesal 29 (temarios 2025) |
| U. de Talca | Oral: Civil, Procesal y una tercera disciplina (se elimina para quienes ingresen desde 2027) | Civil 9 temas (2025), Procesal 7 (2023) |
| UdeC | Oral y público: disertación (≤ 15 min) + interrogación de Civil y Procesal | Procesal 7 unidades (Res. 2023-006); Civil: pendiente |
| UDD | Mixto: disertación + caso escrito de Civil defendido oralmente + interrogación de Procesal | Pendiente (cedularios no publicados) |

**Si la universidad del estudiante no está, o tiene documentos más nuevos, los sube él.** El tutor lee su cedulario, lo transcribe literal, lo enlaza al temario y lo usa en el índice, el plan y los simulacros; de sus exámenes anteriores y pautas saca el formato (tiempo, instrucciones, tipo de preguntas, cómo se asigna el puntaje) para armar simulacros y pautas iguales. Todo queda en su computador.

## Cómo se usa

El estudiante sólo conversa. Al empezar, el tutor pregunta universidad, fecha del examen y horas por semana, y ofrece un diagnóstico. Desde ahí, cada día:

- **"¿Qué me toca hoy?"**: repasos vencidos (del más olvidado al menos), temas nuevos y, si corresponde, un simulacro, dentro de los minutos disponibles.
- **"Muéstrame el índice"**: el cedulario de su universidad con el estado de cada cédula (⚪ sin ver, 🔴 débil, 🟠 aprendiendo, 🟡 consolidando, 🟢 dominado). El estudiante elige qué ver y esos temas pasan primero.
- **"Hazme una clase de la cédula 40"**: pregunta de entrada, explicación por bloques con preguntas intermedias, caso resuelto, caso para el estudiante y reconstrucción del tema sin apoyo.
- **"Quiero un simulacro"**: sortea cédulas y hace de comisión (presidente, profesor de Civil, profesor de Procesal); o, si su examen es escrito, arma un caso nuevo al estilo de su universidad, con su pauta de corrección por ítems (como las de la UAI), lo corrige ítem por ítem y calcula la nota con la exigencia de su universidad.
- **"Te paso mi cedulario y un examen del año pasado"**: el tutor se adapta a ese examen.
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
| `guardar_material` / `ver_material` | Material de estudio guardado (fichas, casos, pautas) |
| `cargar_documento` / `leer_documento` / `listar_documentos` / `quitar_documento` | Documentos del estudiante: cedulario, reglamento, exámenes anteriores, pautas |
| `guardar_cedulario` / `guardar_perfil_examen` | Adaptar el tutor a su examen con esos documentos |
| `calcular_nota` | Puntaje → nota chilena con exigencia |
| `listar_universidades` / `perfil_examen` | Universidades y formato de su examen, con fuente |

Además expone *prompts* (`empezar`, `diagnostico`, `clase`, `repaso`, `simulacro`, `mi_examen`) con el mismo método, para clientes que no cargan skills.

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

1. **Completar cedularios pendientes** (Procesal de la UAI, Civil de la UdeC, ambos de la UDD) y sumar más facultades (Los Andes, Finis Terrae, Alberto Hurtado, Central, Andrés Bello, Autónoma, Valparaíso…). `scripts/importar-cedulario.mjs` convierte un cedulario oficial a datos sin reescribirlo.
2. **Derecho Público / Constitucional** como tercer ramo (lo examinan la PUCV y la UACh) y las cédulas electivas.
3. **Validación con estudiantes y profesores**: revisión del temario canónico y de los perfiles de comisión por docentes de cada facultad; piloto con estudiantes que rinden este semestre.
4. **Servidor remoto multiusuario**: para que los estudiantes lo usen como conector en claude.ai sin instalar nada. El esquema de datos ya separa por estudiante; falta el transporte HTTP con autenticación.
5. **Banco de casos** revisado por profesores para los exámenes escritos.
