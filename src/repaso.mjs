/**
 * Programación del repaso espaciado con FSRS-4.5 (Free Spaced Repetition
 * Scheduler; Ye, Su y Cao, KDD 2022), el algoritmo que usa Anki.
 *
 * Por qué FSRS y no un intervalo fijo: modela para cada tema su *estabilidad*
 * (cuántos días tarda la probabilidad de recordarlo en caer al 90 %) y su
 * *dificultad*, y agenda el repaso justo antes de que se olvide. Es la forma
 * operativa del efecto de espaciamiento (Cepeda et al., 2006): repasar cuando
 * cuesta un poco recordar fija más que repasar cuando todavía está fresco.
 *
 * Se programa por TEMA, no por tarjeta: en el examen oral no se pregunta una
 * frase fija, y el tutor formula una pregunta distinta en cada repaso
 * (recuperación variada). Lo que se agenda es volver a recuperar el tema.
 *
 * Calificaciones (las pone el tutor según la respuesta, con la rúbrica):
 *   1 otra vez — no lo recordó o lo confundió en lo esencial
 *   2 difícil  — lo sacó con ayuda o con errores relevantes
 *   3 bien     — correcto, con esfuerzo normal
 *   4 fácil    — correcto, preciso y rápido; lo relacionó solo
 */

/** Parámetros por defecto de FSRS-4.5. */
export const W = [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755];
const DECAY = -0.5;
const FACTOR = 19 / 81; // hace que R(S, S) = 0,9
export const RETENCION = 0.9;
const MAX_INTERVALO = 180;
const DIA = 86400000;

export const CALIFICACIONES = { 1: 'otra vez', 2: 'difícil', 3: 'bien', 4: 'fácil' };

const acotar = (x, min, max) => Math.min(max, Math.max(min, x));

/** Probabilidad de recordar tras `dias` con estabilidad `s`. */
export const recuperabilidad = (dias, s) => Math.pow(1 + (FACTOR * dias) / s, DECAY);

/** Días hasta que la recuperabilidad cae a `r`. Con r = 0,9 es exactamente s. */
export const intervaloPara = (s, r = RETENCION) => (s / FACTOR) * (Math.pow(r, 1 / DECAY) - 1);

const dificultadInicial = (g) => acotar(W[4] - (g - 3) * W[5], 1, 10);
const estabilidadInicial = (g) => W[g - 1];

function siguienteDificultad(d, g) {
  const nueva = d - W[6] * (g - 3);
  // Reversión a la media: sin ella, un par de "otra vez" dejan un tema
  // marcado como imposible para siempre.
  return acotar(W[7] * dificultadInicial(4) + (1 - W[7]) * nueva, 1, 10);
}

function estabilidadTrasRecordar(d, s, r, g) {
  const penalizacion = g === 2 ? W[15] : 1;
  const bono = g === 4 ? W[16] : 1;
  return s * (1 + Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) * (Math.exp(W[10] * (1 - r)) - 1) * penalizacion * bono);
}

function estabilidadTrasOlvidar(d, s, r) {
  const nueva = W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r));
  return Math.min(nueva, s);
}

export const soloFecha = (fecha) => new Date(fecha).toISOString().slice(0, 10);
const diasEntre = (a, b) => Math.max(0, (new Date(soloFecha(b)) - new Date(soloFecha(a))) / DIA);
const sumarDias = (fecha, n) => soloFecha(new Date(new Date(soloFecha(fecha)).getTime() + n * DIA));

/**
 * @typedef {{estabilidad: number, dificultad: number, ultimo_repaso: string, proximo: string,
 *   repasos: number, lapsos: number, ultima_calificacion: number}} EstadoTema
 */

/**
 * Nuevo estado de un tema tras una recuperación calificada.
 *
 * @param {EstadoTema|null} estado  null si es la primera vez
 * @param {1|2|3|4} g
 * @param {string|Date} hoy
 * @param {{fechaExamen?: string|null}} [opciones]
 * @returns {EstadoTema}
 */
export function programar(estado, g, hoy, { fechaExamen } = {}) {
  if (![1, 2, 3, 4].includes(g)) throw new Error('La calificación debe ser 1, 2, 3 o 4.');
  let s, d;
  if (!estado) {
    s = estabilidadInicial(g);
    d = dificultadInicial(g);
  } else {
    const transcurridos = diasEntre(estado.ultimo_repaso, hoy);
    const r = recuperabilidad(transcurridos, estado.estabilidad);
    d = siguienteDificultad(estado.dificultad, g);
    s = g === 1 ? estabilidadTrasOlvidar(estado.dificultad, estado.estabilidad, r) : estabilidadTrasRecordar(estado.dificultad, estado.estabilidad, r, g);
  }
  // Un "otra vez" vuelve mañana: se reaprende en la sesión siguiente, no en semanas.
  let intervalo = g === 1 ? 1 : acotar(Math.round(intervaloPara(s)), 1, MAX_INTERVALO);

  // Con fecha de examen, ningún tema puede quedar agendado para después de
  // rendir: el último repaso tiene que caer antes. Se deja dos días de margen.
  if (fechaExamen) {
    const hastaExamen = diasEntre(hoy, fechaExamen);
    const tope = Math.max(1, hastaExamen - 2);
    if (hastaExamen >= 1 && intervalo > tope) intervalo = tope;
  }

  return {
    estabilidad: Number(s.toFixed(4)),
    dificultad: Number(d.toFixed(4)),
    ultimo_repaso: soloFecha(hoy),
    proximo: sumarDias(hoy, intervalo),
    repasos: (estado?.repasos ?? 0) + 1,
    lapsos: (estado?.lapsos ?? 0) + (g === 1 && estado ? 1 : 0),
    ultima_calificacion: g,
  };
}

/** Recuperabilidad actual (0–1) de un tema, o null si nunca se estudió. */
export function recuperabilidadHoy(estado, hoy) {
  if (!estado) return null;
  return recuperabilidad(diasEntre(estado.ultimo_repaso, hoy), estado.estabilidad);
}

/**
 * Dominio de un tema para mostrarlo en el índice. Se deriva del modelo y no de
 * cuántas veces se vio: un tema visto diez veces y olvidado sigue siendo débil.
 */
export const DOMINIOS = {
  sin_ver: { icono: '⚪', nombre: 'sin ver' },
  debil: { icono: '🔴', nombre: 'débil' },
  aprendiendo: { icono: '🟠', nombre: 'aprendiendo' },
  consolidando: { icono: '🟡', nombre: 'consolidando' },
  dominado: { icono: '🟢', nombre: 'dominado' },
};

export function dominio(estado, hoy) {
  if (!estado) return 'sin_ver';
  const r = recuperabilidadHoy(estado, hoy);
  if (estado.ultima_calificacion === 1 || r < 0.7) return 'debil';
  if (estado.estabilidad < 7) return 'aprendiendo';
  if (estado.estabilidad < 21 || r < 0.85) return 'consolidando';
  return 'dominado';
}

export { diasEntre, sumarDias };
