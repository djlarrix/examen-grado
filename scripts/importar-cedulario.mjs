#!/usr/bin/env node
/**
 * Convierte el texto de un cedulario oficial (extraído del PDF) en el YAML de
 * datos/universidades/<id>/cedulario-<rama>.yaml, SIN reescribir su contenido.
 *
 * Cada universidad estructura distinto su cedulario (cédulas numeradas,
 * capítulos, cursos y unidades, temas), así que el corte se configura con un
 * "formato": qué líneas abren una sección, cuáles una cédula, y qué líneas
 * inician exclusiones. El texto de cada cédula se conserva tal cual.
 *
 *   node scripts/importar-cedulario.mjs <texto.txt> <formato> <rama> <salida.yaml> "<fuente>" [desde-linea-regex]
 *
 * El mapa cédula → temas se hace después (scripts/sugerir-mapa.mjs ayuda).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { stringify } from 'yaml';

/**
 * Formatos conocidos. `niveles` va del más general al más fino; la cédula es
 * el último nivel presente. `ruido` descarta encabezados y pies de página.
 */
export const FORMATOS = {
  // PUC: "I. TEORÍA DE LA LEY" / "Capítulo IV. REQUISITOS…" / "Excluye: …"
  puc: {
    niveles: [
      { re: /^([IVX]+)\.\s+([A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜ ,.Y]+)$/ },
      { re: /^Cap[ií]tulo\s+([IVX]+)\.?\s+(.+)$/i },
    ],
    exclusion: /^Excluye\s*:?\s*/i,
    reanuda: /^\d+(\.\d+)*\.?\s/,
    ruido: [/^PONTIFICIA UNIVERSIDAD CATOLICA DE CHILE$/, /^Facultad de Derecho \/ \d+/i, /^\d+$/, /^TEMARIO LICENCIATURA$/, /^CÉDULA DE DERECHO/],
  },
  // USACH: "I.- Introducción…" / "1. Fuentes…" (cédula = número)
  usach: {
    niveles: [{ re: /^([IVX]+)\.-\s*(.+)$/ }, { re: /^(\d+)\.\s+(.+)$/ }],
    ruido: [/^\d+$/, /^Examen de Licenciatura en Ciencias Jur/, /^Cedulario ciclo/],
  },
  // USACH procesal: la cédula es la sección romana (los números son subtemas de una línea).
  usach_seccion: {
    niveles: [{ re: /^([IVX]+)\.-\s*(.+)$/ }],
    ruido: [/^\d+$/, /^Examen de Licenciatura en Ciencias Jur/, /^Cedulario ciclo/],
  },
  // UACh: "I. CURSO: …" / "Unidad I. …" o "Unidad I: …"
  uach: {
    niveles: [{ re: /^([IVX]+)\.\s+CURSO:?\s*(.+)$/i }, { re: /^Unidad\s+([IVX]+)[.:]?\s*(.+)$/i }],
    exclusion: /^\(?\s*se excluye/i,
    ruido: [/^Universidad Austral de Chile$/, /^Facultad de Ciencias Jur[ií]dicas y Sociales$/, /^Secretar[ií]a Acad[eé]mica$/, /^TEMARIO EXAMEN DE LICENCIATURA/],
  },
  // U. de Talca: "TEMA I: NEGOCIO JURÍDICO" o "TEMA 1" + título en la línea siguiente
  utalca: {
    niveles: [{ re: /^TEMA\s+([IVX]+|\d+)\s*:?\s*(.*)$/ }],
    exclusion: /^(Se excluye|\s*Este tema no contempla|Excluye)/i,
    reanuda: /^(Bibliograf[ií]a|\d+\.-?\s)/,
    ruido: [/^\d+$/, /^UNIVERSIDAD DE TALCA$/, /^FACULTAD DE CIENCIAS JUR/, /^SOCIALES$/, /^EXAMEN DE LICENCIATURA$/, /^CEDULARIO DE DERECHO/, /^\(Actualizaci/, /^DERECHO CIVIL$/, /^R\.U\./],
  },
  // PUCV Civil: "I. LOS DERECHOS REALES:" / "A. EL DOMINIO O PROPIEDAD"
  pucv_civil: {
    niveles: [
      { re: /^([IVX]+)\s?\.?\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ ,.Y-]{3,}):?$/ },
      { re: /^([A-H])\.\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ ,.:;Y()-]{3,})$/ },
    ],
    continuar: 'conector',
    inicio: /temario de Derecho civil ser[aá] el siguiente/i,
    fin: /^(An[oó]tese|ALAN BRONFMAN|A LAN B RONFMAN)/,
    ruido: [/^FACULTAD DE DERECHO$/, /^\d+$/, /^Resoluci[oó]n N/],
  },
  // PUCV Procesal: "1. LA JURISDICCIÓN" (título en mayúsculas)
  pucv_procesal: {
    niveles: [{ re: /^(\d+)\.\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ ,.–-]{3,}.*)$/ }],
    continuar: 'conector',
    inicio: /temario de Derecho procesal ser[aá] el siguiente/i,
    fin: /^(An[oó]tese|ALAN BRONFMAN|A LAN B RONFMAN)/,
    ruido: [/^FACULTAD DE DERECHO$/, /^\d+$/, /^Resoluci[oó]n N/],
  },
  // U. Central: "CÉDULA Nº 1:" con dos temas "1.- …" y "2.- …" (cédula de sorteo que cruza materias).
  ucentral: {
    niveles: [{ re: /^()C[ÉE]DULA\s+(?:N[º°o]\s*)?(\d+)\s*:?\s*$/ }],
    ruido: [/^CEDULARIO DERECHO/, /^\d+$/],
    titulo: 'items',
  },
  // Finis Terrae: "1. Parte general" / cédula "1.1. …" (con "1.1.1." como contenido);
  // exclusiones "EXCLUYE:" en línea propia o "(excluye …)" dentro del texto.
  numerado: {
    niveles: [{ re: /^(\d+)\.\s+([A-ZÁÉÍÓÚÑ].{2,})$/ }, { re: /^(\d+\.\d+)\.?\s+([A-ZÁÉÍÓÚÑ].+)$/ }],
    tituloPartido: true,
    exclusion: /^EXCLUYE\s*:?\s*/i,
    reanuda: /^\d+\.\d+\.?\s/,
    ruido: [/^TEMARIO DE( LICENCIATURA)?/, /^LICENCIATURA$/, /^DERECHO (CIVIL|PROCESAL)$/, /^\d+$/],
  },
  // UDLA: "I. TEORÍA GENERAL DEL ACTO JURÍDICO" / tema "12. Teoría de la nulidad" (civil) o
  // "12) Los plazos" (procesal). En civil los ítems internos reinician en "1.", así
  // que un "N." es tema sólo si sigue la numeración correlativa del documento.
  udla: {
    niveles: [
      { re: /^([IVX]+)\.-?\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ ,.:;Y()-]{3,})$/ },
      { re: /^(\d+)\s?(?:\.-?|\))\s*([A-ZÁÉÍÓÚÑ].+)$/, secuencial: true },
    ],
    tituloPartido: true,
    exclusion: /^(Se excluye|Excluye|EXCLUYE)/i,
    ruido: [/^F ACULTAD/, /^E SCUELA/, /^Á REA/, /^\d+$/, /^CEDULARIO EXAMEN/, /^LICENCIADO EN/, /^DELICENCIADO/, /^DERECHO (CIVIL|PROCESAL)$/, /^ACTUALIZADO/],
  },
  // UCSH: Resolución 001/2020, escaneada. Secciones "I. TOPICOS…" (el OCR lee "11." por "II.")
  // y, en Procesal IV, subsecciones "A) JUICIO ORDINARIO…". La cédula es la sección.
  ucsh: {
    preTexto: (texto) =>
      texto
        // Membrete de cada página: desde el separador hasta "Henríquez".
        .replace(/=== PAG \d+ ===\n(?:.*\n){0,6}?.*Henr[ií]quez\n/g, '')
        .replace(/^(1|11|111)\.(\s+[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-zíó ,:()]+)$/gm, (m, n, resto) => (/[a-z]{3}/.test(resto.replace(/i[ÓO]N|f/g, '')) ? m : `${{ 1: 'I', 11: 'II', 111: 'III' }[n]}.${resto}`))
        .replace(/ACCiÓN/g, 'ACCIÓN').replace(/JURISDICCiÓN/g, 'JURISDICCIÓN').replace(/JURfDICO/g, 'JURÍDICO').replace(/CUANTíA/g, 'CUANTÍA')
        .replace(/^s\. La réplica/m, '5. La réplica')
        .replace(/Ellitisconsorcio/g, 'El litisconsorcio').replace(/dellitisconsorcio/g, 'del litisconsorcio')
        .replace(/procesa 1\./g, 'procesal.').replace(/ yen el fondo/g, ' y en el fondo').replace(/\.EI principio/g, '. El principio')
        .replace(/Tram itación/g, 'Tramitación').replace(/t ítulo/g, 'título').replace(/utonom ía/g, 'utonomía').replace(/nota rios/g, 'notarios')
        .replace(/ +([.,:;)])/g, '$1'),
    niveles: [
      { re: /^([IVX]+)\.\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ ,.:;()]{3,})$/ },
      { re: /^([A-D])\)\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ ,.:;()]{3,})$/ },
    ],
    fin: /^Nota\s*:/,
    ruido: [/^CEDULARIO DE LICENCIATURA$/, /^DERECHO (CIVIL|PROCESAL)$/],
  },
  // UAI: curso ("Persona y Negocio Jurídico:") / "I. INTRODUCCIÓN AL DERECHO CIVIL".
  // El PDF parte las versalitas ("I NTRODUCCIÓN AL D ERECHO C IVIL"): se unen antes.
  uai: {
    niveles: [
      { re: /^()([A-ZÁÉÍÓÚ][a-záéíóúñ]+(?: [a-zA-ZáéíóúñÁÉÍÓÚ]+){0,4}):$/ },
      { re: /^([IVX]+)\s?\.\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ ,.]{3,}.*)$/ },
    ],
    // Se une "D ERECHO" → "DERECHO" sólo si la unión es una palabra que
    // aparece en el cuerpo del propio documento ("obligaciones", "la", "el");
    // así "DOMINIO O PROPIEDAD" y "TRANSMISIÓN Y EXTINCIÓN" quedan intactos.
    preprocesar: (l, vocab) =>
      /^[IVX]+\s?\./.test(l)
        ? l
            .replace(/(^|\s)([A-ZÁÉÍÓÚÑ]) ([A-ZÁÉÍÓÚÑ]+)/g, (m, pre, letra, resto) =>
              vocab.has((letra + resto).toLowerCase()) || (!'YOEUA'.includes(letra) && !vocab.has(resto.toLowerCase())) ? `${pre}${letra}${resto}` : m,
            )
            .replace(/\s+([,.])/g, '$1')
        : l,
    exclusion: /^(Se excluye|Excluye)/i,
    ruido: [/^\d+$/, /Studocu/, /^Downloaded by/, /^lOMoAR/, /^Scan to open/, /^Cedulario Derecho Civil$/, /^Tesis de grado/],
  },
};

/**
 * USACH: "I.- Sección" / "1. Subsección" / "a. Cédula" / "i. ítem" / "1. sub-ítem".
 * El "1." se usa en dos niveles, y la "i." puede ser la novena letra o el
 * romano uno; ambos se resuelven mirando el contexto:
 *  - "1. X" es subsección sólo si la siguiente línea estructural es "a. …";
 *  - "i. X" es la letra i sólo si se espera esa letra y la cédula actual ya
 *    tuvo su propio "i." romano (el primer ítem de toda cédula es "i.").
 */
function importarUsach(lineas) {
  const estructural = (l) => /^([IVX]+\.-|\d+\.\s|[a-z]{1,4}\.\s)/.test(l);
  const siguienteEstructural = (i) => {
    for (let k = i + 1; k < lineas.length; k++) if (estructural(lineas[k])) return lineas[k];
    return '';
  };
  const cedulas = [];
  let seccion = '';
  let subseccion = '';
  let esperada = 'a';
  let actual = null;
  let vioRomanoUno = false;
  const cerrar = () => actual && cedulas.push(actual);
  for (let i = 0; i < lineas.length; i++) {
    const t = lineas[i];
    let m;
    if ((m = t.match(/^([IVX]+)\.-\s*(.+)$/))) {
      cerrar();
      actual = null;
      seccion = `${m[1]}. ${m[2]}`;
      subseccion = '';
      esperada = 'a';
      continue;
    }
    if ((m = t.match(/^(\d+)\.\s+(.+)$/)) && /^a\.\s/.test(siguienteEstructural(i))) {
      cerrar();
      actual = null;
      subseccion = `${m[1]}. ${m[2]}`;
      esperada = 'a';
      continue;
    }
    if ((m = t.match(/^([a-z])\.\s+(.+)$/)) && m[1] === esperada && (m[1] !== 'i' || vioRomanoUno)) {
      cerrar();
      actual = { seccion, subseccion, tema: m[2].trim(), lineas: [] };
      esperada = String.fromCharCode(esperada.charCodeAt(0) + 1);
      vioRomanoUno = false;
      // Títulos partidos en dos líneas: "d. Protección de la confianza … de buena" + "fe en el Código Civil."
      while (i + 1 < lineas.length && !estructural(lineas[i + 1]) && /^[a-záéíóúñ]/.test(lineas[i + 1])) actual.tema += ` ${lineas[++i].trim()}`;
      continue;
    }
    if (!actual) continue;
    if (/^i\.\s/.test(t)) vioRomanoUno = true;
    actual.lineas.push(t);
  }
  cerrar();
  return cedulas.map((c, i) => ({ numero: i + 1, seccion: c.seccion, subseccion: c.subseccion, tema: c.tema, contenido: c.lineas.join('\n') }));
}

const SINONIMOS = { arrendamiento: 'arriendo' };
const VACIAS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'en', 'a', 'al', 'o', 'u', 'por', 'sus', 'su', 'que', 'se', 'con', 'como', 'para', 'un', 'una']);
export const tokens = (s) =>
  new Set(
    String(s)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9ñ ]+/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1 && !VACIAS.has(t))
      // Singular: "obligaciones"/"obligación", "principios"/"principio".
      .map((t) => (t.length > 5 && t.endsWith('es') ? t.slice(0, -2) : t.length > 4 && t.endsWith('s') ? t.slice(0, -1) : t))
      // Género ("testamentarias"/"testamentarios") y sinónimos de uso común.
      .map((t) => SINONIMOS[t] ?? t)
      .map((t) => (t.length > 6 && /[ao]$/.test(t) ? t.slice(0, -1) : t)),
  );
export function parecido(a, b) {
  const x = tokens(a);
  const y = tokens(b);
  if (!x.size || !y.size) return 0;
  let comun = 0;
  for (const t of x) if (y.has(t)) comun++;
  return (2 * comun) / (x.size + y.size);
}

/**
 * Cedulario que reproduce otro ya cargado (el de la USACH sigue al de la U. de
 * Chile): una línea "x. Título" es cédula si su título coincide con una cédula
 * de la referencia. Evita adivinar la jerarquía por la numeración, que en
 * estos documentos repite "1." y "a." en varios niveles. Cada cédula guarda
 * de qué cédula de referencia viene, para heredar su mapa de temas.
 */
function importarPorReferencia(lineas, referencia, umbral = 0.62) {
  // 1. Candidatas: líneas "x. Título" parecidas a alguna cédula de referencia.
  //    Entre referencias empatadas se elige la primera posterior a la de la
  //    candidata anterior (el documento sigue el orden de la referencia).
  const candidatas = [];
  let ultimaRef = 0;
  for (let i = 0; i < lineas.length; i++) {
    const m = lineas[i].match(/^[a-z]\.\s+(.+)$/);
    if (!m) continue;
    let titulo = m[1].trim();
    const sigue = lineas[i + 1] ?? '';
    const partido = /^[a-záéíóúñ]/.test(sigue) && !/^[a-z]{1,4}\.\s/.test(sigue);
    if (partido) titulo += ` ${sigue.trim()}`;
    const nTokens = tokens(titulo).size;
    const ps = referencia.map((r) => ({ r, p: parecido(titulo, r.tema) })).filter((c) => c.p >= umbral && (nTokens > 1 || c.p === 1));
    if (!ps.length) continue;
    const tope = Math.max(...ps.map((c) => c.p));
    const empatadas = ps.filter((c) => c.p >= tope - 0.02).sort((a, b) => a.r.numero - b.r.numero);
    const elegida = empatadas.find((c) => c.r.numero > ultimaRef) ?? empatadas[0];
    ultimaRef = elegida.r.numero;
    // Desempate: el título real de una cédula va seguido de su primer ítem
    // romano ("i. Concepto…"); el ítem interno que lo repite, no.
    const despues = lineas[i + (partido ? 2 : 1)] ?? '';
    const bono = /^i\.\s/.test(despues) ? 0.01 : 0;
    candidatas.push({ linea: i, titulo, partido, ref: elegida.r.numero, p: elegida.p + bono });
  }
  // 2. Una sola línea por cédula de referencia: la más parecida. Así el título
  //    real ("Contratos Unilaterales y Bilaterales", 1,0) gana al ítem interno
  //    que lo nombra ("Unilateral o bilateral", 0,8).
  const porRef = new Map();
  for (const c of candidatas) {
    const previa = porRef.get(c.ref);
    if (!previa || c.p > previa.p) porRef.set(c.ref, c);
  }
  // 3. Orden: se conserva la subsecuencia creciente más larga de referencias.
  const elegidas = [...porRef.values()].sort((a, b) => a.linea - b.linea);
  const largo = elegidas.map(() => 1);
  const previo = elegidas.map(() => -1);
  for (let i = 0; i < elegidas.length; i++)
    for (let k = 0; k < i; k++)
      if (elegidas[k].ref < elegidas[i].ref && largo[k] + 1 > largo[i]) {
        largo[i] = largo[k] + 1;
        previo[i] = k;
      }
  let fin = largo.indexOf(Math.max(...largo));
  const cabeceras = [];
  while (fin >= 0) {
    cabeceras.unshift(elegidas[fin]);
    fin = previo[fin];
  }
  // 4. Cortar el texto por esas cabeceras; las secciones romanas dan contexto.
  const esCabecera = new Map(cabeceras.map((c) => [c.linea, c]));
  const cedulas = [];
  let seccion = '';
  let actual = null;
  for (let i = 0; i < lineas.length; i++) {
    const t = lineas[i];
    const sec = t.match(/^([IVX]+)\.-\s*(.+)$/);
    if (sec) {
      seccion = `${sec[1]}. ${sec[2]}`;
      continue;
    }
    const cab = esCabecera.get(i);
    if (cab) {
      if (actual) cedulas.push(actual);
      actual = { seccion, tema: cab.titulo, referencia: cab.ref, parecido: Number(Math.min(1, cab.p).toFixed(2)), lineas: [] };
      if (cab.partido) i++;
      continue;
    }
    if (actual) actual.lineas.push(t);
  }
  if (actual) cedulas.push(actual);
  return cedulas.map((c, i) => ({ numero: i + 1, seccion: c.seccion, subseccion: '', tema: c.tema, contenido: c.lineas.join('\n'), _referencia: c.referencia, _parecido: c.parecido }));
}

/**
 * UNAB (malla 2011): un temario por "ejercicio de examen de grado" (EEG I, II
 * y III), cada uno por área y curso, a dos columnas ("Los contratos 1.
 * Contratos preparatorios…"). La cédula es el tema de primer nivel de un
 * curso; como el mismo tema se repite en varios ejercicios, se funden y cada
 * cédula guarda en qué ejercicios se evalúa.
 */
const CURSOS_UNAB = {
  civil: ['Teoría general del negocio jurídico', 'Objetos del Derecho', 'Teoría de las obligaciones', 'Los contratos', 'Responsabilidad civil', 'Derecho de familia', 'Derecho sucesorio'],
  procesal: ['Derecho procesal orgánico', 'Procedimientos declarativos civiles', 'Procedimientos civiles especiales', 'Recursos'],
};
function importarUnab(texto, rama) {
  const lineas = texto
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !/^=== PAG \d+ ===$/.test(l) && !/^Examen de [Gg]rado (–|-) ?Malla 2011$|^Examen de Grado Malla 2011$/.test(l) && !/^Período académico/.test(l) && !/^\d+$/.test(l));
  const areaDe = (l) => (/^Derecho civil$/i.test(l) ? 'civil' : /^Derecho procesal$/i.test(l) ? 'procesal' : /^Derecho (constitucional|laboral)$/i.test(l) ? 'otra' : null);
  const cursos = CURSOS_UNAB[rama];
  const porClave = new Map();
  let ejercicio = 0;
  let area = null;
  let curso = '';
  let sub = '';
  let actual = null;
  const ROMANO = { I: 1, II: 2, III: 3 };
  for (let i = 0; i < lineas.length; i++) {
    let l = lineas[i];
    const ej = l.match(/^(I{1,3})\. TEMARIO (PRIMER|SEGUNDO|TERCER) EJERCICIO/);
    if (ej) {
      ejercicio = ROMANO[ej[1]];
      area = null;
      actual = null;
      continue;
    }
    const a = areaDe(l);
    if (a) {
      area = a;
      curso = '';
      actual = null;
      continue;
    }
    if (area !== rama) continue;
    // "Curso 1. Tema" o "Curso" solo (con o sin subcurso a su derecha).
    // Un curso es la línea exacta o seguida de su primer tema ("Los contratos 1. …"); así una
    // continuación como "Derecho de Familia." (de "1.1. Concepto y características del") no lo es.
    const c = cursos.find((x) => l.toLowerCase().startsWith(x.toLowerCase()) && /^(\s+(\d+\.\s|Normas)|$)/.test(l.slice(x.length)));
    if (c) {
      curso = c;
      let resto = l.slice(c.length).trim();
      sub = '';
      if (c === 'Procedimientos declarativos civiles') {
        // Aparece dos veces: "Normas comunes a todo procedimiento" y luego el juicio ordinario.
        if (/^Normas comunes/i.test(resto)) {
          while (!/\.?procedimiento\.?$/i.test(resto) && i + 1 < lineas.length) resto += ` ${lineas[++i]}`;
          sub = 'Normas comunes a todo procedimiento';
          resto = '';
        } else sub = 'Juicio ordinario';
      }
      actual = null;
      if (!resto) continue;
      l = resto;
    }
    if (!curso) continue;
    const tema = l.match(/^(\d+)\.\s+(.+)$/);
    if (tema) {
      let titulo = tema[2];
      while (i + 1 < lineas.length && /^[a-záéíóúñ(]/.test(lineas[i + 1]) && !/[.:]$/.test(titulo)) titulo += ` ${lineas[++i]}`;
      titulo = titulo.replace(/\s+([.,:;])/g, '$1').replace(/[.:]$/, '');
      const clave = `${curso}|${sub}|${titulo.toLowerCase()}`;
      if (!porClave.has(clave)) porClave.set(clave, { seccion: curso, subseccion: sub, tema: titulo, lineas: [], ejercicios: new Set(), orden: porClave.size });
      actual = porClave.get(clave);
      actual.ejercicios.add(ejercicio);
      actual.leyendo = actual.ejercicios.size === 1; // el contenido se toma de la primera aparición
      continue;
    }
    if (!actual || !actual.leyendo) continue;
    if (/^\d+(\.\d+)+\.?\s/.test(l) || !actual.lineas.length) actual.lineas.push(l);
    else actual.lineas[actual.lineas.length - 1] += ` ${l}`;
  }
  // Orden: el del tercer ejercicio (el más completo), por curso.
  const lista = [...porClave.values()].sort((x, y) => cursos.indexOf(x.seccion) - cursos.indexOf(y.seccion) || (x.subseccion === y.subseccion ? 0 : x.subseccion.startsWith('Normas') ? -1 : 1) || x.orden - y.orden);
  return lista.map((c, i) => ({ numero: i + 1, seccion: c.seccion, subseccion: c.subseccion, tema: c.tema, contenido: c.lineas.join('\n').replace(/\s+([.,:;])/g, '$1'), ejercicios: [...c.ejercicios].sort() }));
}

/** "LOS ALBACEAS (Aspectos generales)" → "Los albaceas (Aspectos generales)". Siglas cortas intactas. */
function aOracion(t) {
  const sinParentesis = t.replace(/\([^)]*\)/g, '');
  if (/[a-záéíóúñü]/.test(sinParentesis) || !/[A-ZÁÉÍÓÚÑÜ]{2,}/.test(sinParentesis)) return t;
  const r = t.replace(/\b[A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜ]*\b/g, (w) => (w.length === 1 && /[IVX]/.test(w) ? w : w.toLowerCase()));
  return r.charAt(0).toUpperCase() + r.slice(1);
}

export function importar(texto, formato, { desde, referencia, rama } = {}) {
  if (formato === 'referencia') {
    const lineas = texto.split('\n').map((l) => l.trim()).filter((l) => l && !/^=== PAG \d+ ===$/.test(l) && !/^\d+$/.test(l) && !FORMATOS.usach.ruido.some((re) => re.test(l)));
    return importarPorReferencia(lineas, referencia);
  }
  if (formato === 'unab') return importarUnab(texto, rama);
  if (formato === 'usach_letras') {
    const ruido = FORMATOS.usach.ruido;
    const lineas = texto.split('\n').map((l) => l.trim()).filter((l) => l && !/^=== PAG \d+ ===$/.test(l) && !ruido.some((re) => re.test(l)));
    return importarUsach(lineas);
  }
  const f = FORMATOS[formato];
  if (!f) throw new Error(`Formato desconocido: ${formato}. Opciones: ${Object.keys(FORMATOS).join(', ')}`);
  if (f.preTexto) texto = f.preTexto(texto);
  let lineas = texto.split('\n').map((l) => l.replace(/\s+$/, ''));
  lineas = lineas.filter((l) => !/^=== PAG \d+ ===$/.test(l.trim()) && !f.ruido.some((re) => re.test(l.trim())));
  if (f.preprocesar) {
    // Vocabulario del cuerpo, sin los títulos (que traen los fragmentos partidos).
    const cuerpo = lineas.filter((l) => !/^\s*[IVX]+\s?\./.test(l)).join(' ');
    const vocab = new Set(cuerpo.toLowerCase().match(/[a-záéíóúñü]{2,}/g) ?? []);
    lineas = lineas.map((l) => f.preprocesar(l.trim(), vocab));
  }
  const inicio = desde ?? f.inicio;
  if (inicio) {
    const i = lineas.findIndex((l) => inicio.test(l));
    if (i >= 0) lineas = lineas.slice(i + (f.inicio && !desde ? 1 : 0));
  }
  if (f.fin) {
    const k = lineas.findIndex((l) => f.fin.test(l.trim()));
    if (k >= 0) lineas = lineas.slice(0, k);
  }
  const titulos = new Array(f.niveles.length).fill('');
  const cedulas = [];
  let actual = null;
  let excluyendo = false;
  let correlativo = 0;
  // Un capítulo que en el documento es sólo un título ("Capítulo I. PRINCIPIO
  // DE AUTONOMÍA PRIVADA") es materia de examen igual: se conserva. Lo que se
  // descarta es un encabezado vacío seguido de uno más profundo (la sección que
  // sólo agrupa capítulos).
  const cerrar = (nivelSiguiente) => {
    if (!actual) return;
    const vacio = !actual.lineas.length && !actual.excl.length;
    if (!vacio || !(nivelSiguiente > actual.nivel)) cedulas.push(actual);
  };
  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i];
    const t = l.trim();
    if (!t) continue;
    const nivel = f.niveles.findIndex((n) => n.re.test(t) && (!n.secuencial || Number(t.match(n.re)[1]) === correlativo + 1));
    if (nivel >= 0) {
      if (f.niveles[nivel].secuencial) correlativo++;
      const m = t.match(f.niveles[nivel].re);
      // El título puede seguir en las líneas siguientes, en mayúsculas
      // ("TEMA 1" + título abajo; o un título largo que el PDF cortó).
      const partesTitulo = [(m[2] ?? '').trim()].filter(Boolean);
      const esMayus = (x) => /^[A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜ ,.;:()Y-]+$/.test(x) && x.length > 2 && !f.niveles.some((n) => n.re.test(x));
      // Con `continuar: 'conector'` sólo se sigue si el título quedó abierto
      // ("…CLASIFICACION, ESTRUCTURA," o "…ADQUIRIR EL"): en la PUCV la línea
      // siguiente en mayúsculas suele ser otro subtítulo ("INTRODUCCION").
      const abierto = (t) => /[,–-]$/.test(t) || /\b(DE|DEL|LA|LAS|EL|LOS|Y|EN|A|AL|O|POR|PARA|CON)$/.test(t);
      while (
        i + 1 < lineas.length &&
        esMayus(lineas[i + 1].trim()) &&
        (!partesTitulo.length || (f.continuar === 'conector' ? abierto(partesTitulo.at(-1)) : /^[A-ZÁÉÍÓÚÑÜ\s,.;:()Y-]+$/.test(partesTitulo.at(-1))))
      )
        partesTitulo.push(lineas[++i].trim());
      // Título en minúsculas que el PDF cortó ("…libre circulación de los bienes y" + "responsabilidad civil.").
      if (f.tituloPartido)
        while (i + 1 < lineas.length && !/[.):]$/.test(partesTitulo.at(-1) ?? '.') && /^[a-záéíóúñ(-]/.test(lineas[i + 1].trim()) && !/^[a-z]{1,3}[.)]\s/.test(lineas[i + 1].trim())) partesTitulo.push(lineas[++i].trim());
      const titulo = (m[1] ? `${m[1]}. ${partesTitulo.join(' ')}` : partesTitulo.join(' ')).trim();
      titulos[nivel] = titulo;
      for (let k = nivel + 1; k < titulos.length; k++) titulos[k] = '';
      excluyendo = false;
      cerrar(nivel);
      actual = { titulos: [...titulos], nivel, lineas: [], excl: [] };
      continue;
    }
    if (!actual) continue;
    if (f.exclusion && f.exclusion.test(t)) {
      excluyendo = true;
      const resto = t.replace(f.exclusion, '').trim();
      actual.excl.push(resto ? (/^se excluye/i.test(t) ? t : resto) : t);
      continue;
    }
    if (excluyendo && f.reanuda && f.reanuda.test(t)) excluyendo = false;
    (excluyendo ? actual.excl : actual.lineas).push(t);
  }
  cerrar(-1);
  return cedulas.map((c, i) => {
    const propios = c.titulos.slice(0, c.nivel + 1).filter(Boolean);
    if (f.titulo === 'items') {
      // "1.- Personas. Concepto y …" → "Personas · Responsabilidad civil contractual"
      const temas = c.lineas.filter((l) => /^\d\.-?\s/.test(l)).map((l) => l.replace(/^\d\.-?\s*/, '').split(/\.\s/)[0].replace(/\.$/, ''));
      return { numero: Number(propios.at(-1).match(/\d+/)?.[0] ?? i + 1), seccion: 'Cedulario', subseccion: '', tema: temas.join(' · '), contenido: c.lineas.join('\n') };
    }
    return {
      numero: i + 1,
      seccion: propios.length > 1 ? propios[0] : propios[0],
      subseccion: propios.length > 1 ? propios.slice(1, -1).join(' — ') : '',
      tema: aOracion(propios.at(-1).replace(/^([IVX]+|\d+(?:\.\d+)*)\.\s*/, '').replace(/^[A-H]\.\s+/, '').replace(/\s+([.,:;])/g, '$1')),
      contenido: c.lineas.join('\n'),
      ...(c.excl.length ? { excluidas: c.excl.join('\n') } : {}),
    };
  });
}

if (process.argv[1] && process.argv[1].endsWith('importar-cedulario.mjs')) {
  const [, , entrada, formato, rama, salida, fuente, desde] = process.argv;
  let referencia;
  if (formato === 'referencia') {
    const { parse } = await import('yaml');
    referencia = parse(readFileSync(desde, 'utf8')).cedulas;
  }
  const cedulas = importar(readFileSync(entrada, 'utf8'), formato, { desde: desde && !referencia ? new RegExp(desde) : undefined, referencia, rama });
  const cabecera = `# ${fuente}\n# Transcripción literal generada con scripts/importar-cedulario.mjs (formato "${formato}") y revisada.\n# La numeración es nuestra cuando el documento no numera cédulas.\n`;
  writeFileSync(salida, cabecera + stringify({ ramo: rama, cedulas }, { lineWidth: 0 }));
  console.log(`${cedulas.length} cédulas → ${salida}`);
  for (const c of cedulas) console.log(`  ${String(c.numero).padStart(3)}. [${c.seccion}${c.subseccion ? ' | ' + c.subseccion : ''}] ${c.tema}  (${c.contenido.split('\n').length} líneas${c.excluidas ? ', con exclusiones' : ''}${c.ejercicios ? `; EEG ${c.ejercicios.join('-')}` : ''}${c._referencia ? `; ref ${c._referencia} ~${c._parecido}` : ''})`);
}
