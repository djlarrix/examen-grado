# Guía para estudiantes

Todo lo que necesitas para preparar tu examen de grado con el tutor. No hace falta saber programar.

## 1. Instalar (un minuto)

Necesitas **Claude Desktop** (la aplicación de Claude para Mac o Windows, gratis en [claude.ai/download](https://claude.ai/download)) y tu cuenta de Claude.

1. Descarga **[examen-grado.mcpb](https://github.com/djlarrix/examen-grado/releases/latest/download/examen-grado.mcpb)**.
2. Ábrelo con doble clic. Claude Desktop muestra la extensión "Examen de Grado": pulsa **Instalar**.
3. Abre una conversación nueva y escribe: **"Quiero preparar mi examen de grado"**.

Eso es todo. No necesitas instalar Node ni nada más: Claude Desktop trae lo necesario.

**Opcional, recomendado:** descarga también **[examen-grado-skill.zip](https://github.com/djlarrix/examen-grado/releases/latest/download/examen-grado-skill.zip)** y súbelo en Claude Desktop en **Configuración → Capacidades → Skills**. El tutor funciona sin ella (el método le llega por la extensión), pero con la skill arranca más rápido en cada conversación.

## 2. La primera conversación

El tutor te pregunta tres cosas: tu universidad, la fecha aproximada de tu examen y cuántas horas por semana puedes estudiar. Con eso arma tu plan hasta el día del examen. Después te ofrece un **diagnóstico** de 15–20 minutos: una pregunta por unidad, para no estudiar desde cero lo que ya sabes. Equivocarte en el diagnóstico es útil: lo que falles queda marcado para verlo primero.

## 3. Cosas que puedes pedirle

| Quieres… | Dile |
|---|---|
| Saber qué estudiar hoy | "¿Qué me toca hoy?" |
| Ver tu cedulario con tu avance | "Muéstrame el índice de Civil" |
| Una clase | "Hazme una clase de la cédula 12" o "Explícame la nulidad relativa" |
| Repasar lo que se te está olvidando | "Hagamos los repasos" |
| Ensayar el examen | "Quiero un simulacro" (oral, caso escrito o alternativas, según tu universidad) |
| Plazos | "Pregúntame plazos de Procesal" |
| No confundir instituciones | "No distingo la apelación de la casación" |
| Ensayar tu exposición | "Quiero ensayar la exposición de la cédula 3 en 8 minutos" |
| Material | "Hazme un cuadro de nulidad absoluta y relativa", "tarjetas de sucesorio" |
| Una duda | Pregúntala como a un ayudante |
| Llevarte tarjetas a Anki | "Expórtame las tarjetas a Anki" |
| El plan en tu calendario | "Ponme el plan en el calendario a las 19:00" |
| Ver tu avance | "¿Cómo voy?" |

Consejos que marcan la diferencia:

- **Responde antes de mirar.** El tutor pregunta mucho a propósito: intentar recordar es lo que fija la materia. Si no sabes, di lo que creas; equivocarse y corregir enseña más que leer la respuesta.
- **Dile qué tan seguro estás** cuando te lo pregunte. Un acierto "a la suerte" vuelve pronto al repaso; un error del que estabas seguro se corrige en el momento.
- **Un poco cada día** rinde más que maratones: el calendario de repasos está hecho para eso.

## 4. Si tu universidad no está (o tu cedulario es más nuevo)

**Adjunta en la conversación** tu cedulario, tu reglamento o exámenes y pautas de años anteriores (PDF, Word o fotos) y dile: "este es mi cedulario". El tutor lo lee, lo guarda y desde ahí usa tu índice, tu formato de examen y tu forma de corregir. Queda sólo en tu computador.

Si quieres que tu universidad quede cargada para todos, abre un [issue](https://github.com/djlarrix/examen-grado/issues/new/choose) con el link a los documentos oficiales.

## 5. Tu progreso

- Queda guardado en tu computador (carpeta `.examen-grado` de tu usuario), no en internet. Cada conversación nueva retoma donde quedaste.
- **Respaldo o cambio de computador:** pídele "hazme un respaldo de mi progreso". Deja un archivo en tu carpeta Descargas; en el otro computador, instala el tutor y copia ese archivo como `.examen-grado/estudio.sqlite` dentro de tu carpeta de usuario (con Claude cerrado).
- Los manuales y documentos que cargues no se suben a ninguna parte: sólo los pasajes que consulta pasan a la conversación.

## 6. Problemas frecuentes

**No aparece la extensión después del doble clic.** Actualiza Claude Desktop (menú Claude → Buscar actualizaciones) y vuelve a abrir el archivo. También puedes instalarla desde **Configuración → Extensiones → Instalar extensión…** eligiendo el `.mcpb`.

**Claude no usa el tutor.** Revisa en **Configuración → Extensiones** que "Examen de Grado" esté activada, abre una conversación nueva y menciona el examen de grado ("quiero preparar mi examen de grado").

**La extensión muestra un error de Node.js.** Pasa en instalaciones antiguas de Claude Desktop. Actualízalo; si sigue, instala Node.js LTS desde [nodejs.org](https://nodejs.org) y reinicia Claude.

**¿Funciona en el celular o en claude.ai en el navegador?** Por ahora no: el tutor corre en tu computador (Claude Desktop o Claude Code).

**¿El tutor puede equivocarse?** Sí. Por eso trae el texto de cada artículo desde Ley Chile en vez de citarlo de memoria, y no atribuye opiniones a autores sin el manual con la página. Si detectas un error, [avísanos](https://github.com/djlarrix/examen-grado/issues/new/choose): se corrige para todos. Y confirma siempre con tu facultad el formato de tu examen.

**Desinstalar.** Configuración → Extensiones → Examen de Grado → Desinstalar. Tu progreso sigue en la carpeta `.examen-grado` por si vuelves; bórrala si no.
