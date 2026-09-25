/**
 * "Hoy" en Chile. Con toISOString() un estudiante que repasa a las 22:00
 * quedaría registrado en el día siguiente (UTC), y su racha y sus repasos se
 * correrían un día. EXAMEN_GRADO_HOY fija la fecha en pruebas.
 */
const FORMATO = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' });

export const hoyEnChile = () => process.env.EXAMEN_GRADO_HOY || FORMATO.format(new Date());

/** Valida y normaliza "YYYY-MM-DD" o "DD-MM-YYYY" / "DD/MM/YYYY". */
export function normalizarFecha(texto) {
  const s = String(texto ?? '').trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  let a, mes, d;
  if (m) [, a, mes, d] = m;
  else if ((m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/))) [, d, mes, a] = m;
  else throw new Error(`Fecha ilegible: "${texto}". Usa AAAA-MM-DD.`);
  const iso = `${a}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const f = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(f.getTime()) || f.toISOString().slice(0, 10) !== iso) throw new Error(`Fecha inválida: "${texto}".`);
  return iso;
}
