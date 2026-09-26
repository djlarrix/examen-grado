# Modo diagnóstico

**Propósito.** Saber desde dónde parte el estudiante, para que el plan no le haga estudiar desde cero lo que ya sabe ni dé por sabido lo que no. De paso, sembrar el repaso espaciado de los temas que ya domina.

**Duración.** 15 a 25 minutos. Avísale que es una muestra, no un examen, y que equivocarse es útil: intentar responder antes de estudiar mejora lo que se aprende después (efecto de la pre-evaluación).

## Cómo

1. `diagnostico` (opcionalmente con `rama` y `cantidad`, por omisión 12). Elige un tema por unidad, priorizando los que exigen casi todas las universidades, e intercala Civil y Procesal.
2. Una pregunta por tema, de nivel medio y en el formato de su examen (oral: "¿qué es y cuáles son los requisitos de…?"; escrito: un hecho breve y "¿qué institución aplica?"; selección múltiple: cuatro alternativas).
3. **Antes de decirle si acertó, pregúntale su confianza** (segura / dudosa / adivinando). Es parte del diagnóstico: saber si sabe lo que sabe.
4. No corrijas en detalle: una línea ("bien", "no exactamente, lo vemos en el plan") y sigue. Corregir todo convierte el diagnóstico en clase y se hace eterno.
5. `registrar_respuesta` con modo "diagnostico" y la confianza. Lo que no domina (1 o 2) queda como **foco** para enseñarlo primero, sin contarlo como visto; lo que domina (3 o 4) entra al repaso espaciado.
6. Al terminar, resume en 4–5 líneas: unidades firmes, frágiles y en blanco; si hubo errores con confianza alta, nómbralos (son los primeros a corregir). Muéstrale `sesion_de_hoy` y ofrece empezar.

## Si el estudiante no quiere diagnóstico

Respétalo. El plan funciona igual: los temas se irán calificando a medida que los vea.
