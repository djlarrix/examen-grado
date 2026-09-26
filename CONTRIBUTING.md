# Cómo contribuir

Este tutor lo van a usar estudiantes que repetirán frente a una comisión lo que aprendan con él. Por eso la regla que ordena todo es simple: **cada dato, con su fuente**.

## Si estudias o enseñas Derecho (no necesitas programar)

- **¿Encontraste un error?** Abre un issue con la plantilla "Error de contenido": qué dice el tutor, qué debería decir y la fuente (el cedulario oficial o el artículo en Ley Chile).
- **¿Tu universidad no está o cambió su cedulario?** Abre un issue con la plantilla "Agregar o actualizar mi universidad" y el link a los documentos oficiales. Mientras tanto, puedes subir tus propios documentos al tutor ("te paso mi cedulario"): se adapta en tu computador.
- **¿Eres profesor o ayudante?** Revisar el mapa entre las cédulas de tu universidad y el temario (`datos/universidades/<id>/mapa-temas.yaml`) o el perfil de la comisión (`perfil.yaml`) es la contribución más valiosa.

No subas exámenes, pautas ni manuales con derechos de terceros: el tutor sólo guarda el formato (tiempo, tipo de preguntas, cómo se asigna el puntaje), y cada estudiante carga los suyos localmente.

## Si programas

Lee [`CLAUDE.md`](CLAUDE.md): tiene el mapa del código, las reglas de contenido y el procedimiento para agregar una universidad con `scripts/importar-cedulario.mjs`.

Antes de un pull request:

```bash
npm test
npm run validar
npm run verificar-articulos   # si tocaste artículos del temario (usa la red)
npm run verificar-plazos      # si tocaste plazos (usa la red)
```

- **Nunca cambies el `id` de un tema**: el progreso de los estudiantes está guardado con él. Para corregir un nombre, cambia `titulo`.
- Los cedularios se transcriben tal cual, con la URL del documento en la cabecera.
- Todo plazo va en `datos/plazos.yaml` con las frases literales que el verificador busca en el artículo.
- Código y comentarios en español; los comentarios explican por qué, no qué.
