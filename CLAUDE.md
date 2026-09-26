# Examen de Grado — notas para trabajar en este repo

Servidor MCP (Node, ESM, `.mjs`) + skill para preparar el examen de grado de Derecho en Chile.

## Mapa

- `datos/temario/{civil,procesal}.yaml` — temario canónico. El progreso se guarda por `id` de tema: **nunca cambies un id existente** (el progreso guardado de los estudiantes lo usa). Para renombrar, cambia `titulo`.
- `datos/universidades/<id>/` — `perfil.yaml` (formato del examen, con fuente por afirmación), `cedulario-<rama>.yaml` (transcripción fiel; `exclusiones` para las que el documento declara para todo el ramo; `ejercicios` por cédula si la universidad examina por ejercicios, como la UNAB), `mapa-temas.yaml` (cédula → temas).
- `datos/plazos.yaml` — plazos para practicar; cada uno con el artículo y las frases literales que `npm run verificar-plazos` busca en el texto vigente.
- `datos/confusiones.yaml` — pares de instituciones que se confunden, con los ejes para compararlas (sólo ejes: el contenido lo construye el estudiante con la norma).
- `src/herramientas.mjs` — las herramientas (clase `Tutor`); `src/definiciones.mjs` — sus esquemas; `src/index.mjs` — servidor MCP y prompts.
- `src/repaso.mjs` (FSRS-4.5), `src/plan.mjs` (fases, sesión del día y su agenda), `src/didactica.mjs` (guion de exposición, Anki, .ics), `src/almacen.mjs` (SQLite, con migraciones en `migrar()`), `src/fuentes/leychile.mjs` (BCN).
- `skills/examen-grado/` — la pedagogía. Los prompts MCP leen estos mismos archivos.

## Reglas de contenido

Este material lo van a memorizar estudiantes que rinden ante una comisión. Un error aquí se repite en cada clase.

1. **Artículos**: toda referencia del temario pasa `npm run verificar-articulos` y se revisa con `-- --texto` que el artículo trate de la materia (el error típico no es un número inexistente, sino uno que existe y trata de otra cosa).
   **Plazos**: todo plazo pasa `npm run verificar-plazos`. No escribas plazos de memoria: varios cambiaron con reformas recientes (contestación 18 días, excepciones en el ejecutivo 8 días, nulidad penal 15 días).
2. **Cedularios**: transcripción fiel del documento oficial, con su URL en la cabecera. No se "mejora" la redacción.
3. **Perfiles**: cada afirmación con fuente. Lo que no está en una fuente oficial va en `por_confirmar`.
4. **Doctrina**: no va en los datos. Viene de los manuales que carga cada estudiante.

## Agregar una universidad

1. Descargar cedulario y reglamento oficiales. Extraer el texto (`src/lib/pdf.mjs`); si el PDF es escaneado, leerlo como imagen y transcribir a mano.
2. Crear `datos/universidades/<id>/perfil.yaml` (copiar la estructura de uno existente: `uchile` oral, `uai` escrito, `udd` mixto). Cada dato con su fuente; lo demás en `por_confirmar`.
3. Convertir el cedulario con `node scripts/importar-cedulario.mjs <texto.txt> <formato> <rama> <salida.yaml> "<fuente>"`. Formatos: `puc`, `usach_seccion`, `uach`, `utalca`, `uai`, `pucv_civil`, `pucv_procesal`, `ucentral` (cédulas de dos temas), `numerado` (temario "1. / 1.1."), `udla` (numeración correlativa con ítems que reinician), `ucsh` (con limpieza de OCR), `unab` (funde los ejercicios EEG), y `referencia` (para un cedulario que reproduce otro ya cargado: se pasa el YAML de referencia en el último argumento y cada cédula queda con `_referencia` para heredar el mapa). Si ningún formato sirve, agregar uno en `FORMATOS`.
4. Enlazar en `mapa-temas.yaml` leyendo cada cédula (`python3 scripts/dev/mapa.py` escribe el YAML a partir de ids cortos) (`node scripts/dev/compacto.mjs <cedulario.yaml>` muestra los ítems; `node scripts/sugerir-mapa.mjs <cedulario.yaml>` propone temas, sólo como pista). Si una cédula trata algo que el temario no tiene, agregar el tema al temario (con artículos verificados), no forzar el enlace.
5. Si el examen excluye unidades completas y no hay cedulario de ese ramo, usar `alcance_excluye` en el perfil. Si la modalidad cambia por ramo, `examen.modalidad_por_ramo`.
6. `npm run validar && npm test && npm run verificar-articulos`.

## Estilo de código

Nombres y comentarios en español. Los comentarios explican el porqué (qué falla sin eso), no el qué. Sin dependencias nativas: el estudiante típico no tiene compiladores.
