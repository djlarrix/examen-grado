# Examen de Grado — notas para trabajar en este repo

Servidor MCP (Node, ESM, `.mjs`) + skill para preparar el examen de grado de Derecho en Chile.

## Mapa

- `datos/temario/{civil,procesal}.yaml` — temario canónico. El progreso se guarda por `id` de tema: **nunca cambies un id existente** (el progreso guardado de los estudiantes lo usa). Para renombrar, cambia `titulo`.
- `datos/universidades/<id>/` — `perfil.yaml` (formato del examen, con fuente por afirmación), `cedulario-<rama>.yaml` (transcripción fiel), `mapa-temas.yaml` (cédula → temas).
- `src/herramientas.mjs` — las herramientas (clase `Tutor`); `src/definiciones.mjs` — sus esquemas; `src/index.mjs` — servidor MCP y prompts.
- `src/repaso.mjs` (FSRS-4.5), `src/plan.mjs` (fases, sesión del día), `src/almacen.mjs` (SQLite), `src/fuentes/leychile.mjs` (BCN).
- `skills/examen-grado/` — la pedagogía. Los prompts MCP leen estos mismos archivos.

## Reglas de contenido

Este material lo van a memorizar estudiantes que rinden ante una comisión. Un error aquí se repite en cada clase.

1. **Artículos**: toda referencia del temario pasa `npm run verificar-articulos` y se revisa con `-- --texto` que el artículo trate de la materia (el error típico no es un número inexistente, sino uno que existe y trata de otra cosa).
2. **Cedularios**: transcripción fiel del documento oficial, con su URL en la cabecera. No se "mejora" la redacción.
3. **Perfiles**: cada afirmación con fuente. Lo que no está en una fuente oficial va en `por_confirmar`.
4. **Doctrina**: no va en los datos. Viene de los manuales que carga cada estudiante.

## Agregar una universidad

1. Descargar cedulario y reglamento oficiales.
2. Crear `datos/universidades/<id>/perfil.yaml` (copiar la estructura de `uchile` o `udp`).
3. Transcribir `cedulario-civil.yaml` y `cedulario-procesal.yaml`.
4. Enlazar en `mapa-temas.yaml`. Si una cédula trata algo que el temario no tiene, agregar el tema al temario (con artículos verificados), no forzar el enlace.
5. `npm run validar && npm test && npm run verificar-articulos`.

## Estilo de código

Nombres y comentarios en español. Los comentarios explican el porqué (qué falla sin eso), no el qué. Sin dependencias nativas: el estudiante típico no tiene compiladores.
