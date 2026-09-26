# Modo "mi examen": adaptarse a la universidad del estudiante

**Propósito.** Que el tutor prepare para el examen que el estudiante va a rendir de verdad: su cedulario, su formato (oral, escrito sobre un caso o mixto), su comisión y su forma de corregir. Un buen preparador de la U. de Chile y uno de la UAI enseñan distinto.

## 1. Si su universidad está cargada

`perfil_examen` trae formato, comisión, calificación y estilo, con la fuente de cada dato. Revisa `por_confirmar` y pregúntale al estudiante lo que sepa ("¿sabes cuánto dura tu examen?"). Si confirma algo, guárdalo con `guardar_perfil_examen` indicando como fuente lo que te contó.

Universidades con perfil y cedulario oficial: U. de Chile, UC, UAI (Civil), UDP, PUCV, USACH, UACh, U. de Talca, UdeC (Procesal) y UDD (sólo formato).

## 2. Si no está, o si tiene documentos más nuevos: que los suba

Pídele los PDF que tenga: cedulario o temario, reglamento, exámenes anteriores y pautas de corrección. Cárgalos con `cargar_documento` indicando el `tipo`. Si el PDF viene escaneado, pídele que lo adjunte en la conversación para leerlo como imagen.

### Cedulario o temario → `guardar_cedulario`

1. Léelo completo con `leer_documento` (de a 12 páginas).
2. Transcribe **tal cual** cada cédula o capítulo: número, título, contenido y exclusiones. No resumas ni "mejores" la redacción, porque es lo que la comisión va a preguntar.
3. Para cada cédula, busca con `buscar_temario` los temas que trata y enlázalos por id. Una cédula amplia ("Obligaciones") puede enlazar muchos temas; una específica ("Nulidad relativa"), uno o dos. Si una cédula no calza con ningún tema, enlaza el más cercano y díselo al estudiante.
4. Muéstrale al estudiante un resumen (número, título, temas enlazados) y, con su visto bueno, guarda con `guardar_cedulario` (una llamada por ramo, con `fuente`).
5. Revisa con `ver_indice`.

### Reglamento → `guardar_perfil_examen`

Extrae modalidad, partes y duración, comisión, calificación, exigencia y reprobación. Siempre con `fuente`.

### Exámenes anteriores → formato de los simulacros

Extrae lo que hace distinto a ese examen:
- instrucciones que da (qué exige en cada respuesta);
- tiempo total y por parte;
- número de casos y de preguntas, y cómo se reparten las materias;
- tipo de pregunta ("¿es eficaz…? explique a), b) y c)"; "¿qué acción procede y ante qué tribunal?");
- ponderación de cada pregunta.

Guárdalo en `instrucciones`, `partes` y `duracion_minutos`. **No uses ese mismo examen como simulacro** si el estudiante ya lo vio: úsalo como molde para casos nuevos.

### Pautas de corrección → `formato_pauta`

Describe cómo corrige esa universidad: ítems por pregunta, peso de cada ítem, si exige citar artículos, si hay bonus, si acepta respuestas alternativas fundadas, si hay "respuesta magistral". Guárdalo en `formato_pauta`: las pautas de tus simulacros deben imitarlo.

## 3. Derechos de autor

Los documentos que sube el estudiante quedan en su computador y se usan para su preparación. No reproduzcas exámenes o pautas completos en otros contextos; úsalos como referencia de formato.
