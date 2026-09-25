/**
 * Planificación: qué estudiar hoy y cómo repartir el tiempo hasta el examen.
 *
 * Tres fases, cada una con un propósito distinto:
 *   1. Primera pasada  — ver todo el temario una vez, con recuperación desde el
 *      primer día (no "leer primero y practicar después").
 *   2. Consolidación   — los temas débiles y las relaciones entre instituciones;
 *      simulacros semanales.
 *   3. Simulacros      — rendir como en el examen, con repaso de lo que falle.
 *
 * Los temas nuevos se intercalan entre Civil y Procesal en vez de estudiar un
 * ramo entero y después el otro: la práctica intercalada rinde más en pruebas
 * diferidas (Rohrer y Taylor, 2007; Kornell y Bjork, 2008) y el examen real
 * salta de un ramo al otro.
 */
import { diasEntre, sumarDias, soloFecha, recuperabilidadHoy, dominio } from './repaso.mjs';

/** Minutos estimados por actividad. Se usan para no prometer más de lo que cabe. */
export const MINUTOS = { tema_nuevo: 30, repaso: 7, simulacro: 45 };

/**
 * Temas que entran al examen del estudiante, en el orden en que conviene verlos.
 * Con cedulario: el orden del cedulario (que sigue el orden pedagógico clásico).
 * Sin cedulario: el orden del temario canónico.
 */
export function alcance(temario, universidad) {
  const porRama = { civil: [], procesal: [] };
  const vistos = new Set();
  const ced = universidad?.cedularios ?? {};
  for (const rama of ['civil', 'procesal']) {
    if (ced[rama]?.length) {
      for (const c of ced[rama]) for (const t of c.temas) if (!vistos.has(t)) (vistos.add(t), porRama[rama].push(t));
    } else {
      for (const t of temario.temas.values()) if (t.rama === rama) (vistos.add(t.id), porRama[rama].push(t.id));
    }
  }
  return porRama;
}

/** Mezcla dos listas en proporción a su largo: 2 de Civil por cada 1 de Procesal si Civil es el doble. */
export function intercalar(a, b) {
  const out = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    // Avanza la lista que va más atrasada en proporción a su largo.
    const pa = a.length ? i / a.length : 1;
    const pb = b.length ? j / b.length : 1;
    if (i < a.length && (pa <= pb || j >= b.length)) out.push(a[i++]);
    else out.push(b[j++]);
  }
  return out;
}

export function fases(inicio, fechaExamen) {
  if (!fechaExamen) return null;
  const total = diasEntre(inicio, fechaExamen);
  // Con menos de tres semanas no hay espacio para una primera pasada larga.
  const [f1, f2] = total >= 21 ? [0.6, 0.85] : [0.5, 0.5];
  const corte1 = sumarDias(inicio, Math.floor(total * f1));
  const corte2 = sumarDias(inicio, Math.floor(total * f2));
  const lista = [
    { id: 'primera_pasada', nombre: 'Primera pasada', desde: soloFecha(inicio), hasta: corte1, proposito: 'Ver todo el temario una vez, practicando recuperación desde el primer día.' },
    { id: 'consolidacion', nombre: 'Consolidación', desde: corte1, hasta: corte2, proposito: 'Temas débiles, relaciones entre instituciones y un simulacro por semana.' },
    { id: 'simulacros', nombre: 'Simulacros y repaso final', desde: corte2, hasta: soloFecha(fechaExamen), proposito: 'Rendir como en el examen, cada dos o tres días, y repasar lo que falle.' },
  ].filter((f) => f.desde < f.hasta);
  return lista;
}

export function faseActual(listaFases, hoy) {
  if (!listaFases?.length) return null;
  const h = soloFecha(hoy);
  return listaFases.find((f) => h >= f.desde && h < f.hasta) ?? (h < listaFases[0].desde ? listaFases[0] : listaFases.at(-1));
}

/** Minutos diarios disponibles según la configuración del estudiante. */
export function minutosPorDia(estudiante) {
  const horas = estudiante?.horas_semana ?? 10;
  const dias = estudiante?.dias_semana ?? 6;
  return Math.round((horas * 60) / dias);
}

/** Días de estudio que quedan entre hoy y una fecha, según los días por semana. */
function diasDeEstudio(hoy, hasta, diasSemana = 6) {
  return Math.max(0, Math.floor((diasEntre(hoy, hasta) * diasSemana) / 7));
}

/**
 * Plan completo: fases, ritmo necesario y si alcanza el tiempo.
 */
export function planGeneral({ temario, universidad, estudiante, progreso, simulacros, hoy }) {
  const porRama = alcance(temario, universidad);
  const todos = [...porRama.civil, ...porRama.procesal];
  const vistos = todos.filter((t) => progreso.has(t));
  const pendientes = todos.length - vistos.length;
  const conteo = Object.fromEntries(['sin_ver', 'debil', 'aprendiendo', 'consolidando', 'dominado'].map((d) => [d, 0]));
  for (const t of todos) conteo[dominio(progreso.get(t), hoy)]++;

  const listaFases = fases(estudiante?.inicio ?? hoy, estudiante?.fecha_examen);
  const actual = faseActual(listaFases, hoy);
  const minutos = minutosPorDia(estudiante);
  const diasSemana = estudiante?.dias_semana ?? 6;

  let ritmo = null;
  let advertencia = null;
  if (estudiante?.fecha_examen) {
    const finPasada = listaFases?.[0]?.hasta ?? estudiante.fecha_examen;
    const diasPasada = diasDeEstudio(hoy, finPasada > soloFecha(hoy) ? finPasada : estudiante.fecha_examen, diasSemana);
    const diasTotal = diasDeEstudio(hoy, estudiante.fecha_examen, diasSemana);
    ritmo = pendientes ? Math.ceil(pendientes / Math.max(1, diasPasada || diasTotal)) : 0;
    // Carga de repasos esperada: cada tema visto vuelve cada ~5 días en promedio al principio.
    const repasosDia = Math.ceil(vistos.length / 5);
    const necesario = ritmo * MINUTOS.tema_nuevo + repasosDia * MINUTOS.repaso;
    if (diasEntre(hoy, estudiante.fecha_examen) <= 0) {
      advertencia = 'La fecha de examen ya pasó o es hoy. Actualízala con configurar_estudiante.';
    } else if (necesario > minutos * 1.15) {
      const posibles = Math.max(1, Math.floor((minutos - repasosDia * MINUTOS.repaso) / MINUTOS.tema_nuevo));
      advertencia =
        `Con ${minutos} min diarios caben unos ${posibles} temas nuevos por día y hacen falta ${ritmo} para ` +
        `cubrir los ${pendientes} pendientes a tiempo. Opciones: más horas, mover la fecha o priorizar ` +
        `(el tutor puede proponer qué temas dejar para una pasada más ligera).`;
    }
  }

  const ultimoSimulacro = simulacros?.[0]?.fecha ?? null;
  return {
    hoy: soloFecha(hoy),
    fecha_examen: estudiante?.fecha_examen ?? null,
    dias_para_examen: estudiante?.fecha_examen ? diasEntre(hoy, estudiante.fecha_examen) : null,
    minutos_por_dia: minutos,
    temas_en_alcance: todos.length,
    temas_vistos: vistos.length,
    temas_pendientes: pendientes,
    por_dominio: conteo,
    fases: listaFases,
    fase_actual: actual,
    temas_nuevos_por_dia: ritmo,
    ultimo_simulacro: ultimoSimulacro,
    simulacros_rendidos: simulacros?.length ?? 0,
    advertencia,
  };
}

/** ¿Toca simulacro hoy? Depende de la fase y de cuándo fue el último. */
function tocaSimulacro(fase, ultimo, hoy, vistos, total) {
  const dias = ultimo ? diasEntre(ultimo, hoy) : Infinity;
  if (!fase) return vistos >= total * 0.3 && dias >= 7;
  if (fase.id === 'simulacros') return dias >= 2;
  if (fase.id === 'consolidacion') return dias >= 7;
  return false;
}

/**
 * La sesión de hoy: repasos vencidos + temas nuevos + (quizás) simulacro,
 * dentro de los minutos disponibles.
 */
export function sesionDeHoy({ temario, universidad, estudiante, progreso, foco, simulacros, hoy, minutos }) {
  const h = soloFecha(hoy);
  const presupuesto = minutos ?? minutosPorDia(estudiante);
  const porRama = alcance(temario, universidad);
  const enAlcance = new Set([...porRama.civil, ...porRama.procesal]);
  const plan = planGeneral({ temario, universidad, estudiante, progreso, simulacros, hoy });
  const fase = plan.fase_actual;

  // 1. Repasos vencidos, el más olvidado primero: recuperar lo que se está
  //    perdiendo rinde más que repasar lo que todavía está firme.
  const vencidos = [...progreso.values()]
    .filter((e) => e.proximo <= h)
    .map((e) => ({ tema: e.tema, r: recuperabilidadHoy(e, h), atraso: diasEntre(e.proximo, h) }))
    .sort((a, b) => a.r - b.r);

  const simulacro = tocaSimulacro(fase, plan.ultimo_simulacro, h, plan.temas_vistos, plan.temas_en_alcance);
  let resto = presupuesto - (simulacro ? MINUTOS.simulacro : 0);

  // En la fase final los repasos mandan; al principio, lo nuevo.
  const tope = fase?.id === 'simulacros' ? 0.8 : fase?.id === 'consolidacion' ? 0.6 : 0.45;
  const maxRepasos = Math.max(vencidos.length ? 1 : 0, Math.floor((resto * tope) / MINUTOS.repaso));
  const repasos = vencidos.slice(0, maxRepasos);
  resto -= repasos.length * MINUTOS.repaso;

  // 2. Temas nuevos: primero los que eligió el estudiante; después el orden del
  //    plan, intercalando ramos y respetando prerrequisitos.
  const orden = intercalar(porRama.civil, porRama.procesal);
  const sinVer = (id) => !progreso.has(id);
  const listo = (id) => temario.temas.get(id).requiere.every((r) => progreso.has(r) || !enAlcance.has(r));
  const candidatos = [...foco.filter(sinVer), ...orden.filter((t) => sinVer(t) && listo(t) && !foco.includes(t))];
  const cupo = fase?.id === 'simulacros' ? 1 : Math.max(1, plan.temas_nuevos_por_dia ?? 2);
  const nuevos = [];
  for (const t of candidatos) {
    if (nuevos.length >= cupo || resto < MINUTOS.tema_nuevo) break;
    nuevos.push(t);
    resto -= MINUTOS.tema_nuevo;
  }

  const describir = (id) => {
    const t = temario.temas.get(id);
    return { id, titulo: t.titulo, rama: t.rama };
  };
  return {
    fecha: h,
    minutos_disponibles: presupuesto,
    fase: fase ? { nombre: fase.nombre, proposito: fase.proposito, hasta: fase.hasta } : null,
    dias_para_examen: plan.dias_para_examen,
    repasos: repasos.map((r) => ({ ...describir(r.tema), recuerdo_estimado: `${Math.round(r.r * 100)}%`, dias_de_atraso: r.atraso })),
    repasos_que_quedan_para_manana: vencidos.length - repasos.length,
    temas_nuevos: nuevos.map((id) => ({ ...describir(id), elegido_por_ti: foco.includes(id) })),
    simulacro_recomendado: simulacro,
    minutos_estimados: presupuesto - resto,
    advertencia: plan.advertencia,
  };
}
