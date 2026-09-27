# Examen de Grado

<img src="recursos/icono.png" alt="" width="96" align="right">

[![Pruebas](https://github.com/djlarrix/examen-grado/actions/workflows/ci.yml/badge.svg)](https://github.com/djlarrix/examen-grado/actions/workflows/ci.yml) [![Vigencia de normas y plazos](https://github.com/djlarrix/examen-grado/actions/workflows/vigencia.yml/badge.svg)](https://github.com/djlarrix/examen-grado/actions/workflows/vigencia.yml) [![Licencia MIT](https://img.shields.io/badge/licencia-MIT-blue.svg)](LICENSE)

Preparador del examen de grado de Derecho en Chile, en **Derecho Civil y Derecho Procesal**. Es un servidor MCP más una skill para Claude: da clases, hace repasar con repetición espaciada, simula la comisión (oral o escrita según la universidad), prepara material de estudio y responde dudas con fuentes que se pueden verificar.

Creado por Joaquín Larraín Guimoye.

## Qué lo hace distinto

**Se adapta a cada universidad.** Cada universidad tiene su cedulario y su forma de examinar. En la U. de Chile el examen es oral, ante una comisión que interroga sobre "los principios fundamentales de las instituciones" y evalúa "comprensión, análisis y síntesis" (Reglamento, art. 16). En la UDP son dos pruebas escritas sobre un caso ficticio, con códigos a la vista. El tutor lee el perfil de la universidad del estudiante y cambia la forma de preguntar, de simular y de corregir.

**Un solo temario, muchos cedularios.** El progreso se lleva sobre un temario canónico de 273 temas. Cada cedulario oficial (1.057 cédulas transcritas de catorce universidades; la UDD aún no publica las suyas) enlaza sus cédulas con esos temas, así que el índice que ve el estudiante es el de su propia universidad, en su orden, con su numeración y con sus exclusiones. Como se sabe qué temas exige cada universidad, el tutor también sabe cuáles exigen casi todas: si el tiempo no alcanza, esos van primero.

**Enseña con método, no sólo explica.** La práctica de recuperación y la repetición espaciada son las dos técnicas de estudio mejor respaldadas por la investigación (Dunlosky et al., 2013). El tutor hace que el estudiante recupere en vez de releer, agenda cada tema con FSRS (el algoritmo de Anki) antes de que se olvide, intercala Civil y Procesal, respeta prerrequisitos y corrige nombrando el error concreto. La base de cada decisión está en [`skills/examen-grado/referencias/metodologia.md`](skills/examen-grado/referencias/metodologia.md).

**No puede inventar la ley.** El texto de las normas viene siempre de Ley Chile, vigente, con las notas de modificación separadas. La doctrina sólo se atribuye a un autor si viene del manual que el propio estudiante cargó, con página. Cada artículo citado en el temario se comprueba contra Ley Chile con `npm run verificar-articulos`, y se revisó a mano que cada número corresponda a su materia. Los 49 plazos para practicar se comprueban igual (`npm run verificar-plazos`): la primera verificación detectó cuatro reglas cambiadas por reformas que un apunte o manual anterior todavía trae con el texto antiguo: los 18 días para contestar la demanda (antes 15), los 8 días para oponer excepciones en el juicio ejecutivo (antes 4), los 15 días del recurso de nulidad penal (antes 10) y el control de la acción ejecutiva prescrita (antes, un título de más de tres años).

**Entrena lo que el examen mide.** Además de clases, repasos y simulacros:
- **Plazos** verificados, preguntados con repetición espaciada.
- **Instituciones que se confunden** (50 pares: nulidad absoluta y relativa, apelación y casación…), con cuadro comparativo de memoria y casos en que hay que decidir cuál aplica.
- **Exposición de cédula** con guion de tiempos, los puntos que exige el texto oficial y una segunda versión corregida.
- **Calibración**: el estudiante dice qué tan seguro está antes de la corrección. Un acierto adivinado vuelve pronto al repaso, y un error cometido con seguridad se corrige en el momento.
- **Agenda de cada sesión**: bloques con tiempos (repaso → pretest → clase → práctica → explicación propia), pausas y un cierre.
- **Exportar** tarjetas y plazos a Anki, y el plan de estudio a un calendario (.ics).

## Universidades

Quince facultades: las presentes en el ranking QS de Law & Legal Studies 2025–2026 (UC, U. de Chile, UAI, PUCV, UdeC, USACH, U. de Talca, UACh y UDD), la UDP y cinco de las que más egresados presentan cada año (U. Central, UNAB, Finis Terrae, UDLA y UCSH). Cada perfil cita su fuente; lo que no está en una fuente oficial queda marcado "por confirmar".

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
| U. Central | Oral (exposición inicial de una materia elegida + interrogación) o, en la nueva modalidad, caso escrito de 3 horas + defensa oral | Civil 40 cédulas, Procesal 40 (2025), dos temas por cédula |
| UNAB | Tres ejercicios escritos (EEG) de preguntas cerradas sobre casos prácticos | Civil 33 temas, Procesal 30 (malla 2011, período 2026-20), con el ejercicio en que se evalúa cada uno |
| Finis Terrae | Oral: temarios obligatorios de Civil y Procesal + un tema sorteado de un cedulario electivo | Civil 48 puntos, Procesal 16, con exclusiones |
| UDLA | Oral, por ramo en meses distintos (Civil; Procesal y Constitucional) | Civil 55 temas (2024), Procesal 55 (2023) |
| UCSH | Oral y público (Res. 001/2020) | Civil 11 secciones, Procesal 8, con la lista oficial de exclusiones |

**Si la universidad del estudiante no está, o tiene documentos más nuevos, los adjunta en la conversación** (PDF, Word o fotos). El tutor lee su cedulario, lo transcribe literal, lo enlaza al temario y lo usa en el índice, el plan y los simulacros; de sus exámenes anteriores y pautas saca el formato (tiempo, instrucciones, tipo de preguntas, cómo se asigna el puntaje) para armar simulacros y pautas iguales. Todo queda en su computador.

## Cómo se usa

El estudiante sólo conversa. Al empezar, el tutor pregunta universidad, fecha del examen y horas por semana, y ofrece un diagnóstico. Desde ahí, cada día:

- **"¿Qué me toca hoy?"**: repasos vencidos (del más olvidado al menos), temas nuevos y, si corresponde, un simulacro, dentro de los minutos disponibles.
- **"Muéstrame el índice"**: el cedulario de su universidad con el estado de cada cédula (⚪ sin ver, 🔴 débil, 🟠 aprendiendo, 🟡 consolidando, 🟢 dominado). El estudiante elige qué ver y esos temas pasan primero.
- **"Hazme una clase de la cédula 40"**: pregunta de entrada, explicación por bloques con preguntas intermedias, caso resuelto, caso para el estudiante y reconstrucción del tema sin apoyo.
- **"Quiero un simulacro"**: sortea cédulas y hace de comisión (presidente, profesor de Civil, profesor de Procesal); o, si su examen es escrito, arma un caso nuevo al estilo de su universidad, con su pauta de corrección por ítems (como las de la UAI), lo corrige ítem por ítem y calcula la nota con la exigencia de su universidad.
- **"Te paso mi cedulario y un examen del año pasado"**: el tutor se adapta a ese examen.
- **"Hazme un cuadro de nulidad absoluta y relativa"**: fichas, cuadros comparativos, líneas de tiempo procesales, tarjetas.
- **"Pregúntame plazos"** o **"no distingo apelación de casación"**: práctica de plazos verificados y de instituciones que se confunden.
- **"Quiero ensayar mi exposición de la cédula 12"**: guion con tiempos, exposición contra el reloj, devolución y segunda versión.
- **"Pásame esto a Anki"** / **"ponme el plan en el calendario"**.
- **Cualquier duda**, respondida con la norma vigente y, si cargó su manual, con la cita de página.

## Herramientas del servidor

| Herramienta | Para qué |
|---|---|
| `estado_estudiante` | Punto de entrada: configuración, plan, racha y sesión sugerida |
| `guia_del_tutor` | El método pedagógico de cada modo, para usar el tutor sin la skill |
| `configurar_estudiante` | Universidad, fecha de examen, horas y días de estudio |
| `sesion_de_hoy` / `plan_estudio` | Qué estudiar hoy; fases y ritmo hasta el examen, con advertencia si no alcanza |
| `ver_indice` / `buscar_temario` / `elegir_temas` | Índice con estado, búsqueda y selección de contenidos |
| `ver_tema` | Cédula, normas, prerrequisitos, relaciones, plazos, instituciones con que se confunde, en cuántos cedularios se exige y errores anteriores del estudiante |
| `registrar_respuesta` | Califica una recuperación (1–4) con la confianza declarada y reprograma el repaso |
| `diagnostico` | Un tema por unidad para el diagnóstico inicial; lo que no domina queda como foco |
| `practicar_plazos` / `practicar_discriminacion` | Plazos verificados e instituciones que se confunden |
| `preparar_exposicion` | Guion, puntos obligatorios y rúbrica para ensayar una exposición |
| `exportar` | Tarjetas y plazos para Anki; plan de estudio en .ics; respaldo del progreso (a la carpeta Descargas) |
| `sortear_cedula` / `registrar_simulacro` | Simulacros por universidad |
| `progreso` | Dominio por unidad, simulacros, temas que más se olvidan, errores y calibración |
| `ver_articulo` | Texto vigente de un artículo desde Ley Chile |
| `agregar_manual` / `buscar_en_manuales` / `listar_manuales` / `quitar_manual` | Manuales propios del estudiante, con búsqueda y cita de página |
| `guardar_material` / `ver_material` | Material de estudio guardado (fichas, casos, pautas) |
| `cargar_documento` / `leer_documento` / `listar_documentos` / `quitar_documento` | Documentos del estudiante (adjuntos en la conversación o por ruta): cedulario, reglamento, exámenes anteriores, pautas |
| `guardar_cedulario` / `guardar_perfil_examen` | Adaptar el tutor a su examen con esos documentos |
| `calcular_nota` | Puntaje → nota chilena con exigencia |
| `listar_universidades` / `perfil_examen` | Universidades y formato de su examen, con fuente |

Además expone *prompts* (`empezar`, `diagnostico`, `clase`, `repaso`, `simulacro`, `plazos`, `confusiones`, `exposicion`, `mi_examen`) con el mismo método, para clientes que no cargan skills.

## Instalación

### Claude Desktop (Mac o Windows): un minuto

1. Descarga **[examen-grado.mcpb](https://github.com/djlarrix/examen-grado/releases/latest/download/examen-grado.mcpb)** y ábrelo con doble clic → **Instalar**.
2. En una conversación nueva escribe: *"Quiero preparar mi examen de grado"*.

No hay que instalar nada más: Claude Desktop trae el Node.js que usa la extensión. Opcional: sube también la skill **[examen-grado-skill.zip](https://github.com/djlarrix/examen-grado/releases/latest/download/examen-grado-skill.zip)** en **Configuración → Capacidades → Skills**; sin ella el tutor funciona igual, porque el método le llega por la extensión (`guia_del_tutor`).

**[Guía para estudiantes](docs/GUIA.md)**: primera conversación, qué pedirle, cómo subir tu cedulario, respaldo del progreso y problemas frecuentes.

### Claude Code

```
/plugin marketplace add djlarrix/examen-grado
/plugin install examen-grado@examen-grado
```

El plugin trae el servidor y la skill; la primera vez instala sus dependencias solo.

### Desde el código

Requiere Node.js 22.13 o superior (usa el SQLite incluido en Node; no hay nada que compilar).

```bash
git clone https://github.com/djlarrix/examen-grado.git
cd examen-grado && npm install
claude mcp add examen-grado -- node "$PWD/src/arrancar.mjs"
cp -R skills/examen-grado ~/.claude/skills/
```

Para Claude Desktop sin la extensión, agrega el servidor a `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "examen-grado": { "command": "node", "args": ["/ruta/a/examen-grado/src/arrancar.mjs"] }
  }
}
```

## Privacidad y derechos de autor

- El progreso del estudiante vive en su computador, en `~/.examen-grado/estudio.sqlite` (se puede mover con `EXAMEN_GRADO_DIR`).
- Los manuales, exámenes y pautas no se distribuyen con el proyecto: cada estudiante carga los suyos. Los PDF no se suben a ningún servidor; se indexa su texto localmente y sólo los pasajes que se consultan pasan a la conversación con Claude.
- Los cedularios y temarios de `datos/universidades/` son documentos de cada universidad, reproducidos con su fuente para fines de estudio.

## Aviso

Proyecto independiente: no es un producto oficial de ninguna universidad ni reemplaza las indicaciones de tu facultad. Los cedularios y formatos de examen vienen de documentos oficiales publicados, con su fuente y fecha de revisión, pero cambian: confirma con tu facultad antes de rendir. El tutor enseña; no presta asesoría legal.

## Contribuir

Errores de contenido, universidades que faltan o cedularios nuevos: [issues](https://github.com/djlarrix/examen-grado/issues) (hay plantillas) o ver [`CONTRIBUTING.md`](CONTRIBUTING.md). Cada lunes una revisión automática compara el temario y los plazos con Ley Chile y abre un issue si una reforma cambió algo.

## Licencia

Código y material propio del proyecto bajo [licencia MIT](LICENSE).

## Desarrollo

```bash
npm test                       # pruebas (sin red)
npm run empaquetar             # dist/: extensión .mcpb para Claude Desktop y skill .zip
npm run validar                # consistencia de temario, cedularios y mapas
npm run verificar-articulos    # cada artículo del temario contra Ley Chile (con red)
npm run verificar-plazos       # cada plazo contra el texto vigente de su artículo (con red)
node scripts/probar-servidor.mjs   # recorrido por el protocolo MCP real
```

## Hoja de ruta

1. **Completar cedularios pendientes** (Procesal de la UAI, Civil de la UdeC, ambos de la UDD) y sumar las facultades que no publican sus cedularios en línea (Los Andes, Autónoma, Valparaíso, Mayor, San Sebastián, UCN, UCSC…); mientras tanto, el estudiante sube el suyo. `scripts/importar-cedulario.mjs` convierte un cedulario oficial a datos sin reescribirlo.
2. **Derecho Público / Constitucional y Laboral** como ramos adicionales (los examinan la PUCV, la UACh, la UDLA y la UNAB) y las cédulas electivas.
3. **Validación con estudiantes y profesores**: revisión del temario canónico y de los perfiles de comisión por docentes de cada facultad; piloto con estudiantes que rinden este semestre.
4. **Servidor remoto multiusuario**: para que los estudiantes lo usen como conector en claude.ai sin instalar nada. El esquema de datos ya separa por estudiante; falta el transporte HTTP con autenticación.
5. **Banco de casos** revisado por profesores para los exámenes escritos.
