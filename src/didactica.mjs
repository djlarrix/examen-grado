/**
 * Piezas didácticas sin estado: selección ponderada, guion de exposición,
 * tarjetas para Anki y calendario .ics. Las herramientas del tutor las usan;
 * aquí no se toca la base de datos.
 */
import { sumarDias, diasEntre, soloFecha } from './repaso.mjs';

/** Elige hasta `n` elementos distintos, con probabilidad proporcional a `peso`. */
export function elegirPonderado(lista, n, peso, azar = Math.random) {
  const disponibles = [...lista];
  const elegidos = [];
  while (elegidos.length < n && disponibles.length) {
    const pesos = disponibles.map(peso);
    let x = azar() * pesos.reduce((a, b) => a + b, 0);
    let i = pesos.findIndex((p) => (x -= p) <= 0);
    if (i < 0) i = disponibles.length - 1;
    elegidos.push(disponibles[i]);
    disponibles.splice(i, 1);
  }
  return elegidos;
}

// "1.", "1.2.", "2)", "a.", "b)", "iv.", "•", "o " al comienzo de línea.
const VINETA = /^\s*(?:\d+(?:\.\d+)*\s?[.)-]+-?|[a-zñ][.)]|[ivx]{1,4}\.|[•●▪o])\s+/i;

/**
 * Lista de puntos que una exposición de la cédula debe cubrir, tomada del
 * propio texto oficial (cada ítem numerado o viñeta; si no hay, cada oración).
 * Las líneas que continúan un ítem cortado por el PDF se unen al anterior.
 */
export function puntosDeCedula(contenido, tema) {
  const lineas = (contenido ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
  const puntos = [];
  for (const l of lineas) {
    if (VINETA.test(l) || !puntos.length) puntos.push(l.replace(VINETA, '').trim());
    else puntos[puntos.length - 1] += ` ${l}`;
  }
  const limpios = puntos.map((p) => p.replace(/\s+/g, ' ').replace(/[:;,]$/, '').trim()).filter((p) => p.length > 2);
  if (limpios.length > 1) return limpios;
  const base = limpios[0] ?? tema ?? '';
  const oraciones = base.split(/(?<=\.)\s+(?=[A-ZÁÉÍÓÚÑ])/).map((o) => o.trim()).filter((o) => o.length > 2);
  return oraciones.length ? oraciones : [tema].filter(Boolean);
}

/**
 * Guion de tiempos: apertura (~10 %), desarrollo repartido entre los puntos
 * y cierre (~15 %). En segundos, para que el estudiante ensaye con reloj.
 */
export function guionDeExposicion(puntos, minutos) {
  const total = Math.round(minutos * 60);
  const apertura = Math.max(20, Math.round(total * 0.1));
  const cierre = Math.max(30, Math.round(total * 0.15));
  const porPunto = Math.max(15, Math.floor((total - apertura - cierre) / Math.max(1, puntos.length)));
  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  let t = 0;
  const bloques = [{ desde: fmt(t), parte: 'Apertura', que: 'Definir la institución en una frase y anunciar el orden en que se expondrá (el "mapa").' }];
  t += apertura;
  for (const p of puntos) {
    bloques.push({ desde: fmt(t), parte: 'Desarrollo', que: p });
    t += porPunto;
  }
  bloques.push({ desde: fmt(t), parte: 'Cierre', que: 'Dos o tres ideas clave, una relación con otra institución y, si viene al caso, un problema actual o de jurisprudencia.' });
  return { total: fmt(total), segundos_por_punto: porPunto, bloques };
}

/**
 * Tarjetas escritas como
 *   P: pregunta
 *   R: respuesta (puede seguir en varias líneas)
 * separadas por una línea en blanco. También acepta "Pregunta:" / "Respuesta:".
 */
export function tarjetasDeTexto(texto) {
  const tarjetas = [];
  let actual = null;
  let campo = null;
  for (const linea of (texto ?? '').split('\n')) {
    const p = linea.match(/^\s*(?:[-*]\s*)?(?:\*\*)?(P|Pregunta|Q)(?:\*\*)?\s*[:.-]\s*(.*)$/i);
    const r = linea.match(/^\s*(?:[-*]\s*)?(?:\*\*)?(R|Respuesta|A)(?:\*\*)?\s*[:.-]\s*(.*)$/i);
    if (p) {
      if (actual?.frente && actual?.reverso) tarjetas.push(actual);
      actual = { frente: p[2].trim(), reverso: '' };
      campo = 'frente';
    } else if (r && actual) {
      actual.reverso = r[2].trim();
      campo = 'reverso';
    } else if (actual && campo && linea.trim()) {
      actual[campo] += `${actual[campo] ? '\n' : ''}${linea.trim()}`;
    }
  }
  if (actual?.frente && actual?.reverso) tarjetas.push(actual);
  return tarjetas;
}

/** Archivo de texto que Anki importa directo (Archivo → Importar), con etiquetas. */
export function textoAnki(tarjetas) {
  const limpiar = (s) => String(s).replace(/\t/g, ' ').replace(/\r?\n/g, '<br>');
  return ['#separator:tab', '#html:true', '#tags column:3', ...tarjetas.map((t) => [limpiar(t.frente), limpiar(t.reverso), (t.etiquetas ?? []).join(' ')].join('\t'))].join('\n') + '\n';
}

/** Días de la semana en que se estudia según cuántos por semana (lunes = 1 … domingo = 7). */
export function diasDeEstudio(diasSemana = 6) {
  const n = Math.min(7, Math.max(1, Math.round(diasSemana)));
  return [1, 2, 3, 4, 5, 6, 7].slice(0, n);
}

const diaSemana = (fecha) => {
  const d = new Date(`${fecha}T12:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
};

/**
 * Calendario .ics: una sesión por día de estudio hasta el examen, con la fase
 * y su propósito en la descripción; simulacros semanales en consolidación y
 * cada tres días al final; y el día del examen.
 */
export function calendarioIcs({ hoy, fechaExamen, fases, minutos, diasSemana, hora = '19:00', universidad }) {
  const h = soloFecha(hoy);
  if (!fechaExamen || diasEntre(h, fechaExamen) <= 0) return null;
  const dias = new Set(diasDeEstudio(diasSemana));
  const [hh, mm] = hora.split(':').map(Number);
  const pad = (n) => String(n).padStart(2, '0');
  const local = (fecha, minutosDelDia) => `${fecha.replace(/-/g, '')}T${pad(Math.floor(minutosDelDia / 60))}${pad(minutosDelDia % 60)}00`;
  const escapar = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  const eventos = [];
  let n = 0;
  let ultimoSimulacro = null;
  for (let f = h; f < fechaExamen; f = sumarDias(f, 1)) {
    if (!dias.has(diaSemana(f))) continue;
    const fase = fases?.find((x) => f >= x.desde && f < x.hasta) ?? fases?.at(-1);
    const cadaCuanto = fase?.id === 'simulacros' ? 3 : fase?.id === 'consolidacion' ? 7 : null;
    const simulacro = cadaCuanto && (!ultimoSimulacro || diasEntre(ultimoSimulacro, f) >= cadaCuanto);
    if (simulacro) ultimoSimulacro = f;
    const inicio = hh * 60 + mm;
    eventos.push({
      uid: `examen-grado-${f}-${n++}`,
      inicio: local(f, inicio),
      fin: local(f, Math.min(inicio + minutos, 23 * 60 + 59)),
      titulo: simulacro ? 'Examen de grado: simulacro + repasos' : 'Examen de grado: sesión de estudio',
      descripcion: `${fase ? `${fase.nombre}: ${fase.proposito}\n` : ''}Abre el tutor y pide "sesión de hoy".`,
    });
  }
  const lineas = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//examen-grado//plan de estudio//ES', 'CALSCALE:GREGORIAN', 'X-WR-TIMEZONE:America/Santiago'];
  const sello = `${h.replace(/-/g, '')}T000000Z`;
  for (const e of eventos) {
    lineas.push('BEGIN:VEVENT', `UID:${e.uid}`, `DTSTAMP:${sello}`, `DTSTART;TZID=America/Santiago:${e.inicio}`, `DTEND;TZID=America/Santiago:${e.fin}`, `SUMMARY:${escapar(e.titulo)}`, `DESCRIPTION:${escapar(e.descripcion)}`, 'END:VEVENT');
  }
  lineas.push(
    'BEGIN:VEVENT',
    `UID:examen-grado-examen-${fechaExamen}`,
    `DTSTAMP:${sello}`,
    `DTSTART;VALUE=DATE:${fechaExamen.replace(/-/g, '')}`,
    `DTEND;VALUE=DATE:${sumarDias(fechaExamen, 1).replace(/-/g, '')}`,
    `SUMMARY:${escapar(`Examen de grado${universidad ? ` (${universidad})` : ''}`)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  );
  return { ics: lineas.join('\r\n') + '\r\n', sesiones: eventos.length, simulacros: eventos.filter((e) => e.titulo.includes('simulacro')).length };
}
