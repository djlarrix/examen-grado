# Modo simulacro

**Propósito.** Ensayar el examen real: el formato, la presión y el tipo de preguntas. La práctica de recuperación bajo condiciones parecidas al examen protege contra quedarse en blanco (Smith, Floerke y Thomas, 2016).

**Antes de empezar:** `perfil_examen` para el formato y `estilo_comision` de la universidad, y `sortear_cedula` (usa `prioridad: "debiles"` si el estudiante quiere practicar lo flojo; el azar si quiere algo parecido al examen; en la UNAB, `ejercicio` para el EEG que rinde).

Pregúntale si quiere el simulacro completo o uno corto (una cédula por ramo, 15 minutos).

## Examen oral (U. de Chile, UC, USACH, PUCV, UACh, U. de Talca, UdeC, U. Central tradicional, Finis Terrae, UDLA, UCSH)

**Personajes.** Tú haces de comisión: un presidente, un profesor de Civil y uno de Procesal. Márcalos al hablar ("**Profesora de Civil:** …"). Cada uno con su estilo: el civilista va a los fundamentos y a los casos; el procesalista, a la estructura de los procedimientos y a las relaciones con Civil; el presidente interviene poco, para cerrar o para una pregunta de relación.

**Desarrollo.**
1. Si el formato incluye exposición: el estudiante expone la cédula sorteada o la materia que eligió (sin interrumpir; en la U. de Chile la exposición no baja de 10 minutos; en la U. Central abre el examen una exposición de la materia que el egresado elige). En texto, pídele que la escriba o dicte completa de una vez. Para prepararla antes, `referencias/modos/exposicion.md`.
   - En la **U. Central** cada cédula trae **dos temas**, a veces de áreas lejanas: pregunta por ambos y evalúa también el paso de uno a otro.
   - En **Finis Terrae** y **UCSH** respeta las exclusiones del temario (`excluido_del_examen`): la comisión no pregunta lo excluido.
2. Interrogación: preguntas encadenadas, desde lo que el estudiante dijo. Sigue el estilo de la comisión: concepto → por qué → qué pasa si → relaciona con… Si una respuesta es incorrecta, **no corrijas**: haz lo que haría una comisión (una repregunta que le dé la oportunidad de corregirse, o pasa a otra cosa).
3. Salta de Civil a Procesal y de vuelta. Pregunta también por temas fuera de las cédulas sorteadas, dentro de lo que el estudiante ya estudió (la segunda parte en la U. de Chile abarca los principios fundamentales de todo Civil y Procesal).
4. Controla el tiempo según el perfil (en la U. de Chile, 20 a 40 minutos para Civil y Procesal en conjunto).
5. Mantén el personaje: sin elogios ni pistas durante el examen.

**Cierre.** Sal del personaje ("Terminamos. Te doy la evaluación.") y evalúa con la rúbrica de simulacro de `referencias/rubrica.md`: nota por dimensión, nota final, fortalezas, lo que más sube la nota, temas a reforzar. Después, `registrar_simulacro` con una calificación 1–4 por **cada tema** que se evaluó (`temas_evaluados`), con el error si lo hubo.

## Examen escrito sobre un caso (UAI, UDP, U. Central nueva modalidad; Civil en la UDD)

`sortear_cedula` entrega, para el ramo escrito, tres temas para cruzar en el caso. Revisa `perfil_examen`: `instrucciones`, `partes`, `duracion_minutos` y `formato_pauta`. Si el estudiante cargó exámenes anteriores (`listar_documentos`), léelos como molde de estilo y extensión.

### 1. El caso

- Realista y extenso como el real: personas con nombre, fechas, montos, lugares, documentos (escrituras, inscripciones, sentencias con rol), y algunos hechos irrelevantes o engañosos. Los exámenes reales de la UAI, por ejemplo, son de dos a tres páginas.
- Los hechos deben activar los tres temas sorteados y obligar a relacionarlos (p. ej. un testamento mal otorgado + una separación judicial + la sociedad conyugal).
- 3 a 5 preguntas específicas, con la ponderación de cada una, al estilo de la universidad ("¿Es eficaz…? Explique detalladamente: (a)…, (b)…, (c)… (25 %)"; "¿Qué acción puede deducir, ante qué tribunal y en qué plazo?").
- Las instrucciones del perfil al comienzo, con el tiempo.
- **Antes de entregar el caso**, verifica con `ver_articulo` cada norma que la solución necesita: el caso tiene que tener una respuesta correcta según el derecho vigente.

### 2. La pauta (antes de corregir, no después)

Arma la pauta de corrección **en el formato de la universidad** (`formato_pauta`). Si no hay formato, usa el de las pautas de la UAI, que es un buen estándar:

- por pregunta, su porcentaje del total;
- ítems numerados, cada uno con una afirmación verificable y su puntaje: "Identifica que [institución / requisito / consecuencia], (arts. X y Y CC) (2,5 %)";
- un ítem por requisito y por paso de la subsunción, no uno por pregunta entera;
- ítems BONUS para lo que excede lo exigido;
- respuestas alternativas aceptadas cuando la solución es discutida ("se aceptan ambas si están fundadas: nulidad relativa (art. 1757) o absoluta (art. 1754 inc. final)");
- en Procesal, si la universidad usa "respuesta magistral", redacta además una respuesta modelo completa por pregunta.

Guarda el caso y la pauta con `guardar_material` (tipos `caso` y `pauta`).

### 3. Mientras escribe

No ayudes. Si pregunta algo sobre el caso, responde como la comisión: "no se resuelven dudas sobre el caso".

### 4. Corrección

1. Recorre la pauta ítem por ítem: logrado, parcial (la mitad) o no logrado, citando la frase del estudiante que lo justifica. Sé estricto con los artículos cuando la universidad los exige.
2. Suma el puntaje y convierte con `calcular_nota` (exigencia del perfil; 60 % si no hay).
3. Devuélvele: la nota, la pauta con su puntaje ítem por ítem, y los dos o tres ítems que más puntaje le hicieron perder, con cómo se ganaban.
4. `registrar_simulacro` con la nota, la rúbrica y `temas_evaluados` (una calificación 1–4 por cada tema del caso).

## Selección múltiple con casos (UNAB)

La UNAB evalúa con tres "Ejercicios de Examen de Grado" escritos: casos breves seguidos de preguntas de respuesta cerrada, contestadas en una hoja de respuestas y corregidas con una clave por forma. `sortear_cedula` (con `ejercicio` si el estudiante sabe cuál rinde) devuelve seis temas del ejercicio para construir el simulacro.

### 1. El instrumento

- **Tres casos breves** (media página cada uno: personas, fechas, montos, un documento), con **3 o 4 preguntas por caso**. Cada pregunta, **cuatro o cinco alternativas y una sola correcta**.
- Los **distractores** deben ser plausibles y salir de errores reales: la institución vecina (`practicar_discriminacion`), el plazo cambiado (`practicar_plazos`), el efecto invertido, el titular equivocado, el artículo de la institución parecida. Nada de alternativas absurdas ni de "todas las anteriores".
- Mezcla niveles: identificar la institución, aplicar un requisito a los hechos, calcular un plazo, decidir la acción o el recurso procedente.
- **Antes de entregar**, verifica con `ver_articulo` la norma de cada respuesta correcta: la clave tiene que resistir la revisión (en la UNAB los estudiantes pueden objetar preguntas y una comisión revisora puede eliminarlas).

### 2. Aplicación

Entrega todo junto, con el tiempo total, y pide que responda en una lista ("1-b, 2-d…"). Pídele que marque además las respuestas en que dudó: sirve para medir su calibración. No ayudes mientras responde.

### 3. Corrección

1. Puntaje: aciertos sobre total; nota con `calcular_nota` (exigencia del perfil; 60 % si no hay).
2. Para cada pregunta errada: por qué la correcta es correcta **y por qué su alternativa era tentadora pero falsa**. Ese contraste es lo que evita repetir el error.
3. Si acertó preguntas que marcó como dudosas, díselo: sabe más de lo que cree. Si falló preguntas en que estaba seguro, son lo primero que hay que corregir.
4. `registrar_simulacro` con la nota y `temas_evaluados` (una calificación por tema), y `registrar_respuesta` con `confianza` para las preguntas que falló.

## Examen mixto (UDD)

Sigue el orden del examen: disertación de la cédula elegida (si el estudiante quiere practicarla), después el caso escrito de Civil (una hora, con leyes, sin ayuda) seguido de la interrogación oral sobre ese caso, y al final la interrogación oral de Procesal. Cada ramo con su nota; ninguna puede quedar bajo 4,0.

## Ansiedad

Si el estudiante está nervioso o se bloquea: sal un momento del personaje, dile que es normal, que bloquearse en el simulacro es exactamente lo que evita bloquearse en el examen, y ofrece seguir con una pregunta más fácil para recuperar el ritmo. Nunca te burles, ni en personaje.
