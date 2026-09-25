/**
 * Esquemas de las herramientas. Las descripciones son para Claude: dicen
 * cuándo usar cada una, no sólo qué hace.
 */
const TEMA = { type: 'string', description: 'Id de tema del temario (p. ej. "civil.acto.nulidad_relativa").' };
const RAMA = { type: 'string', enum: ['civil', 'procesal'] };

export const DEFINICIONES = [
  {
    name: 'estado_estudiante',
    description:
      'PUNTO DE ENTRADA. Llámala al comenzar cada conversación. Dice si el estudiante está configurado, ' +
      'cuántos días faltan, en qué fase del plan va, su racha y la sesión sugerida para hoy (repasos, temas nuevos, simulacro).',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'configurar_estudiante',
    description:
      'Guarda o actualiza el perfil del estudiante: universidad, fecha del examen, horas y días de estudio por semana. ' +
      'Todos los campos son opcionales; sólo se cambian los que vengan. Si su universidad no está en `listar_universidades`, usa "otra" y guarda en `notas` cómo es su examen.',
    inputSchema: {
      type: 'object',
      properties: {
        universidad: { type: 'string', description: 'Id de `listar_universidades`, u "otra".' },
        fecha_examen: { type: 'string', description: 'AAAA-MM-DD. Si no la sabe, déjala vacía.' },
        horas_semana: { type: 'number', description: 'Horas de estudio por semana (1–80).' },
        dias_semana: { type: 'integer', description: 'Días de estudio por semana (1–7). Default 6.' },
        nombre: { type: 'string' },
        notas: { type: 'string', description: 'Lo que el estudiante cuente de su examen o de sí mismo que sirva para enseñarle.' },
      },
    },
  },
  {
    name: 'listar_universidades',
    description: 'Universidades con perfil de examen cargado, su modalidad (oral/escrita) y si tienen cedulario transcrito.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'perfil_examen',
    description:
      'Cómo es el examen de grado de una universidad: partes, duración, comisión, calificación, estilo de la comisión y ' +
      'puntos por confirmar, con fuente. Consúltalo antes de preparar un simulacro o de decidir qué tipo de preguntas hacer.',
    inputSchema: { type: 'object', properties: { universidad: { type: 'string', description: 'Default: la del estudiante.' } } },
  },
  {
    name: 'sesion_de_hoy',
    description:
      'Qué estudiar hoy: repasos vencidos (del más olvidado al menos), temas nuevos (primero los elegidos por el estudiante, ' +
      'luego el orden del plan intercalando Civil y Procesal) y si toca simulacro, dentro de los minutos disponibles.',
    inputSchema: { type: 'object', properties: { minutos: { type: 'number', description: 'Minutos disponibles hoy, si difieren de lo habitual.' } } },
  },
  {
    name: 'plan_estudio',
    description: 'Plan completo hasta el examen: fases con fechas, temas vistos/pendientes, ritmo necesario de temas nuevos por día y advertencia si no alcanza el tiempo.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'ver_indice',
    description:
      'Índice de contenidos con el estado de cada tema (⚪ sin ver, 🔴 débil, 🟠 aprendiendo, 🟡 consolidando, 🟢 dominado, ⭐ elegido). ' +
      'Sin `rama`: resumen por unidad. Con `rama`: cada cédula del cedulario de su universidad (o cada tema del temario). ' +
      'Úsalo cuando el estudiante quiera elegir qué estudiar.',
    inputSchema: {
      type: 'object',
      properties: {
        rama: RAMA,
        unidad: { type: 'string', description: 'Filtrar por unidad (p. ej. "civil.bienes").' },
        vista: { type: 'string', enum: ['cedulario', 'temario'], description: 'Default: cedulario si la universidad lo tiene.' },
      },
    },
  },
  {
    name: 'ver_tema',
    description:
      'Todo lo necesario para enseñar un tema o una cédula: contenido de la cédula, normas de apoyo, prerrequisitos con su dominio, ' +
      'temas relacionados (para preguntas de relación), estado del estudiante y sus errores anteriores. Llámala antes de una clase.',
    inputSchema: {
      type: 'object',
      properties: {
        tema: { type: 'string', description: 'Id de tema, "civil:40" (cédula) o id de unidad.' },
        cedula: { type: 'integer', description: 'Número de cédula del cedulario del estudiante (con `rama`).' },
        rama: RAMA,
      },
    },
  },
  {
    name: 'buscar_temario',
    description: 'Encuentra temas y cédulas por palabras ("lesión enorme", "notificación por cédula"). Úsala para ubicar una duda en el temario.',
    inputSchema: { type: 'object', properties: { texto: { type: 'string' } }, required: ['texto'] },
  },
  {
    name: 'elegir_temas',
    description:
      'El estudiante elige qué contenidos quiere ver: los temas elegidos pasan primero en la sesión de hoy. ' +
      'Acepta ids de tema, cédulas ("civil:40", "procesal:12") o unidades completas ("civil.bienes").',
    inputSchema: {
      type: 'object',
      properties: {
        agregar: { type: 'array', items: { type: 'string' } },
        quitar: { type: 'array', items: { type: 'string' } },
        limpiar: { type: 'boolean', description: 'Vacía la selección antes de agregar.' },
      },
    },
  },
  {
    name: 'registrar_respuesta',
    description:
      'OBLIGATORIA después de cada respuesta evaluable del estudiante. Actualiza el repaso espaciado del tema. ' +
      'calificacion: 1 otra vez (no lo recordó / error esencial / necesitó la explicación), 2 difícil (con pistas o errores relevantes), ' +
      '3 bien (correcto sin ayuda), 4 fácil (correcto, preciso, estructurado, relacionó solo). Califica el PRIMER intento. ' +
      'En `error`, el error concreto en una frase útil para reenseñar.',
    inputSchema: {
      type: 'object',
      properties: {
        tema: TEMA,
        calificacion: { type: 'integer', enum: [1, 2, 3, 4] },
        modo: { type: 'string', enum: ['clase', 'repaso', 'diagnostico', 'pregunta', 'simulacro'] },
        pregunta: { type: 'string', description: 'La pregunta que se hizo, resumida.' },
        error: { type: 'string', description: 'Qué confundió u omitió. Vacío si respondió bien.' },
      },
      required: ['tema', 'calificacion'],
    },
  },
  {
    name: 'sortear_cedula',
    description:
      'Sortea cédulas para un simulacro, según el cedulario de la universidad (una por ramo si no se indica `rama`). ' +
      'prioridad "debiles" hace más probable que salgan temas débiles o no vistos.',
    inputSchema: {
      type: 'object',
      properties: {
        rama: RAMA,
        numero: { type: 'integer', description: 'Forzar una cédula concreta.' },
        prioridad: { type: 'string', enum: ['azar', 'debiles'] },
      },
    },
  },
  {
    name: 'registrar_simulacro',
    description:
      'Guarda el resultado de un simulacro (nota 1–7, rúbrica por dimensión, fortalezas, a mejorar) y actualiza el repaso ' +
      'de cada tema evaluado. Incluye en `temas_evaluados` todos los temas sobre los que se preguntó.',
    inputSchema: {
      type: 'object',
      properties: {
        nota: { type: 'number' },
        cedulas: { type: 'array', items: { type: 'string' }, description: 'P. ej. ["civil:40", "procesal:26"].' },
        rubrica: { type: 'object', description: 'Nota por dimensión: exactitud, precision, estructura, fundamento, relacion, aplicacion, expresion.' },
        fortalezas: { type: 'string' },
        a_mejorar: { type: 'string' },
        temas_evaluados: {
          type: 'array',
          items: {
            type: 'object',
            properties: { tema: TEMA, calificacion: { type: 'integer', enum: [1, 2, 3, 4] }, pregunta: { type: 'string' }, error: { type: 'string' } },
            required: ['tema', 'calificacion'],
          },
        },
      },
      required: ['temas_evaluados'],
    },
  },
  {
    name: 'progreso',
    description: 'Avance del estudiante: dominio por unidad, historial de simulacros, temas que más olvida, errores recientes y racha.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'ver_articulo',
    description:
      'Texto oficial VIGENTE de un artículo, desde Ley Chile. Úsala SIEMPRE antes de afirmar qué dice una norma; no la cites de memoria. ' +
      'Normas: Código Civil, Código de Procedimiento Civil, Código Orgánico de Tribunales, Código Procesal Penal, Constitución, ' +
      'Código de Comercio, Ley de Matrimonio Civil (19.947), AUC (20.830), Tribunales de Familia (19.968), comparecencia (18.120), ' +
      'arrendamiento urbano (18.101), operaciones de crédito (18.010), consumidor (19.496), efecto retroactivo de las leyes, DL 2.695.',
    inputSchema: {
      type: 'object',
      properties: {
        norma: { type: 'string', description: 'Sigla (CC, CPC, COT, CPP, CPR, CCOM, LMC…) o nombre ("Código Civil", "Ley 19.947").' },
        articulo: { type: 'string', description: 'Número: "1682", "1792-1", "19".' },
      },
      required: ['norma', 'articulo'],
    },
  },
  {
    name: 'agregar_manual',
    description:
      'Indexa un manual en PDF del propio estudiante para buscar y citar con página. El PDF queda en su computador; ' +
      'se guarda su texto para búsqueda local. Los PDF escaneados sin texto no sirven.',
    inputSchema: {
      type: 'object',
      properties: {
        ruta: { type: 'string', description: 'Ruta al PDF en el computador del estudiante.' },
        titulo: { type: 'string' },
        autor: { type: 'string' },
        anio: { type: 'string' },
        rama: RAMA,
      },
      required: ['ruta', 'titulo'],
    },
  },
  {
    name: 'buscar_en_manuales',
    description:
      'Busca en los manuales cargados por el estudiante y devuelve pasajes con cita (autor, obra, página). ' +
      'Única fuente válida para atribuir doctrina a un autor. Frases exactas entre comillas.',
    inputSchema: {
      type: 'object',
      properties: { consulta: { type: 'string' }, rama: RAMA, limite: { type: 'integer', description: 'Default 5.' } },
      required: ['consulta'],
    },
  },
  {
    name: 'listar_manuales',
    description: 'Manuales cargados por el estudiante.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'quitar_manual',
    description: 'Quita un manual del índice (no borra el PDF).',
    inputSchema: { type: 'object', properties: { id: { type: 'integer' } }, required: ['id'] },
  },
  {
    name: 'guardar_material',
    description: 'Guarda material que le sirvió al estudiante (ficha, cuadro, esquema, línea de tiempo, tarjetas) para volver a verlo.',
    inputSchema: {
      type: 'object',
      properties: {
        tema: TEMA,
        tipo: { type: 'string', enum: ['ficha', 'cuadro', 'esquema', 'linea_de_tiempo', 'tarjetas', 'caso', 'otro'] },
        titulo: { type: 'string' },
        contenido: { type: 'string', description: 'En markdown.' },
      },
      required: ['tipo', 'titulo', 'contenido'],
    },
  },
  {
    name: 'ver_material',
    description: 'Material guardado: la lista, el de un tema, o uno por id.',
    inputSchema: { type: 'object', properties: { tema: TEMA, id: { type: 'integer' } } },
  },
];
