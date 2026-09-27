/**
 * Las herramientas del tutor. Cada una devuelve datos; la pedagogía (cómo
 * enseñar con ellos) está en la skill y en las instrucciones del servidor.
 *
 * Ninguna herramienta devuelve contenido jurídico "de memoria": el texto de
 * las normas viene de Ley Chile y el de la doctrina, de los manuales que el
 * propio estudiante cargó, con página.
 */
import { resolve as resolverRuta, join, basename } from 'node:path';
import { stat, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { contenido } from './datos.mjs';
import { Almacen } from './almacen.mjs';
import { programar, dominio, DOMINIOS, recuperabilidadHoy, CALIFICACIONES, diasEntre } from './repaso.mjs';
import { alcance, planGeneral, sesionDeHoy, minutosPorDia } from './plan.mjs';
import { elegirPonderado, puntosDeCedula, guionDeExposicion, tarjetasDeTexto, textoAnki, calendarioIcs } from './didactica.mjs';
import { directorioDatos, raizProyecto } from './lib/rutas.mjs';
import { NORMAS, parsearReferencia, citaLegible } from './fuentes/normas.mjs';
import { verArticulo } from './fuentes/leychile.mjs';
import { extraerPaginas } from './lib/pdf.mjs';
import { hoyEnChile, normalizarFecha } from './lib/fecha.mjs';

const ORDEN_DOMINIO = ['sin_ver', 'debil', 'aprendiendo', 'consolidando', 'dominado'];
const icono = (d) => DOMINIOS[d].icono;

const sinTildes = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Dónde dejar lo exportado: la carpeta Descargas, que el estudiante encuentra
 * (~/.examen-grado está oculta en macOS). Con EXAMEN_GRADO_DIR (pruebas,
 * servidores) se usa esa carpeta.
 */
async function carpetaExportaciones() {
  let dir = join(directorioDatos(), 'exportaciones');
  if (!process.env.EXAMEN_GRADO_DIR) {
    const descargas = join(homedir(), 'Downloads');
    if (await stat(descargas).then((x) => x.isDirectory()).catch(() => false)) dir = descargas;
  }
  await mkdir(dir, { recursive: true });
  return dir;
}

/** "Sección — Subsección", sin raya colgando cuando falta alguna. */
const unirSeccion = (c) => [c.seccion, c.subseccion].filter((x) => x && String(x).trim()).join(' — ') || 'Cedulario';

/** Error pensado para que Claude lo lea y corrija la llamada. */
export class ErrorDeUso extends Error {}

export class Tutor {
  /**
   * @param {{almacen?: Almacen, estudiante?: string, hoy?: () => string}} [opciones]
   */
  constructor({ almacen, estudiante, hoy } = {}) {
    this.almacen = almacen ?? new Almacen();
    this.id = estudiante ?? process.env.EXAMEN_GRADO_ESTUDIANTE ?? 'local';
    this.hoy = hoy ?? hoyEnChile;
  }

  async ctx() {
    const { temario, universidades, transversal, plazos, confusiones } = await contenido();
    const est = this.almacen.estudiante(this.id);
    const base = est?.universidad ? universidades.get(est.universidad) ?? null : null;
    const universidad = combinarUniversidad(base, this.almacen.perfilPropio(this.id), this.almacen.cedulariosPropios(this.id), est);
    return { temario, universidades, transversal, plazos, confusiones, est, universidad, hoy: this.hoy() };
  }

  // — Configuración ————————————————————————————————————————————————

  async listar_universidades() {
    const { universidades } = await this.ctx();
    return {
      universidades: [...universidades.values()].map(({ perfil, cedularios }) => ({
        id: perfil.id,
        nombre: perfil.nombre,
        examen: perfil.examen?.nombre,
        modalidad: perfil.examen?.modalidad,
        cedulario: Object.keys(cedularios).length ? Object.entries(cedularios).map(([r, c]) => `${r}: ${c.length} cédulas`).join(', ') : 'no transcrito (se usa el temario completo)',
      })),
      otra_universidad:
        'Si la universidad del estudiante no está, configura universidad "otra" y pídele sus documentos ' +
        '(cedulario, reglamento, exámenes anteriores, pautas): cargar_documento, guardar_cedulario y ' +
        'guardar_perfil_examen. Mientras tanto se usa el temario completo.',
    };
  }

  async perfil_examen({ universidad } = {}) {
    const { universidades, est, universidad: propia } = await this.ctx();
    const id = universidad ?? est?.universidad;
    // Sin universidad pedida explícitamente, el perfil del estudiante ya
    // combina lo oficial con lo que él mismo aportó (reglamento, exámenes).
    if (!universidad && propia) {
      const { cedulario, ...perfil } = propia.perfil;
      return {
        ...perfil,
        cedulario: Object.fromEntries(Object.entries(propia.cedularios).map(([r, c]) => [r, `${c.length} cédulas (${propia.origen_cedulario?.[r] ?? 'oficial'})`])),
        ...(Object.keys(propia.exclusiones ?? {}).length ? { excluido_del_examen: propia.exclusiones } : {}),
        electivas: cedulario?.electivas,
      };
    }
    if (!id) throw new ErrorDeUso('Indica la universidad o configura primero al estudiante.');
    const u = universidades.get(id);
    if (!u) return { universidad: id, conocida: false, nota: 'Universidad sin perfil. Usa lo que el estudiante cuente de su examen (guardado en `notas`).', notas_estudiante: est?.notas ?? null };
    const { cedulario, ...perfil } = u.perfil;
    return {
      ...perfil,
      cedulario: Object.fromEntries(Object.entries(u.cedularios).map(([r, c]) => [r, `${c.length} cédulas`])),
      ...(Object.keys(u.exclusiones ?? {}).length ? { excluido_del_examen: u.exclusiones } : {}),
      electivas: cedulario?.electivas,
    };
  }

  async configurar_estudiante({ universidad, fecha_examen, horas_semana, dias_semana, nombre, notas } = {}) {
    const { universidades, hoy } = await this.ctx();
    if (universidad && universidad !== 'otra' && !universidades.has(universidad)) {
      throw new ErrorDeUso(`Universidad desconocida "${universidad}". Opciones: ${[...universidades.keys()].join(', ')}, u "otra".`);
    }
    const fecha = fecha_examen ? normalizarFecha(fecha_examen) : undefined;
    if (fecha && fecha <= hoy) throw new ErrorDeUso('La fecha de examen debe ser futura.');
    if (horas_semana !== undefined && !(horas_semana > 0 && horas_semana <= 80)) throw new ErrorDeUso('horas_semana debe estar entre 1 y 80.');
    if (dias_semana !== undefined && !(Number.isInteger(dias_semana) && dias_semana >= 1 && dias_semana <= 7)) throw new ErrorDeUso('dias_semana debe ser un entero de 1 a 7.');
    const e = this.almacen.guardarEstudiante(this.id, { universidad, fecha_examen: fecha, horas_semana, dias_semana, nombre, notas }, hoy);
    return { guardado: true, estudiante: e, siguiente: 'Llama a `estado_estudiante` o `sesion_de_hoy` para empezar.' };
  }

  // — Punto de entrada ————————————————————————————————————————————————

  async estado_estudiante() {
    const { temario, est, universidad, hoy } = await this.ctx();
    if (!est) {
      return {
        configurado: false,
        instruccion:
          'Estudiante nuevo. Antes de enseñar, pregúntale (en una sola intervención y sin formulario): ' +
          'universidad, fecha aproximada del examen y horas por semana que puede estudiar. Luego ' +
          '`configurar_estudiante`. Si no sabe la fecha, se puede configurar después. Si su universidad ' +
          'no está en la lista, configura "otra" y ofrécele subir su cedulario, reglamento y exámenes ' +
          'anteriores con `cargar_documento`.',
        universidades_disponibles: (await this.listar_universidades()).universidades.map((u) => `${u.id} (${u.nombre})`),
        metodo: 'Si no tienes cargada la skill "examen-grado", llama a guia_del_tutor (modo "inicio") antes de seguir.',
      };
    }
    const progreso = this.almacen.progreso(this.id);
    const simulacros = this.almacen.simulacros(this.id, 5);
    const plan = planGeneral({ temario, universidad, estudiante: est, progreso, simulacros, hoy });
    const sesion = sesionDeHoy({ temario, universidad, estudiante: est, progreso, foco: this.almacen.foco(this.id), simulacros, hoy });
    return {
      configurado: true,
      estudiante: { nombre: est.nombre, universidad: universidad?.perfil.nombre ?? est.universidad ?? 'sin definir', fecha_examen: est.fecha_examen, horas_semana: est.horas_semana, notas: est.notas },
      examen: universidad ? { nombre: universidad.perfil.examen?.nombre, modalidad: universidad.perfil.examen?.modalidad } : null,
      plan: { dias_para_examen: plan.dias_para_examen, fase: plan.fase_actual?.nombre ?? null, vistos: `${plan.temas_vistos}/${plan.temas_en_alcance}`, por_dominio: plan.por_dominio, advertencia: plan.advertencia },
      sesion_de_hoy: sesion,
      racha_dias: this.racha(hoy),
      primera_vez: progreso.size === 0,
      metodo: 'Si no tienes cargada la skill "examen-grado", pide el método con guia_del_tutor (modo "inicio" y el de cada actividad).',
    };
  }

  racha(hoy) {
    const dias = new Set(this.almacen.diasConActividad(this.id));
    let n = 0;
    let d = hoy;
    // Si hoy todavía no estudia, la racha cuenta desde ayer.
    if (!dias.has(d)) d = new Date(new Date(d).getTime() - 86400000).toISOString().slice(0, 10);
    while (dias.has(d)) {
      n++;
      d = new Date(new Date(d).getTime() - 86400000).toISOString().slice(0, 10);
    }
    return n;
  }

  async sesion_de_hoy({ minutos } = {}) {
    const { temario, est, universidad, transversal, hoy } = await this.ctx();
    if (!est) throw new ErrorDeUso('Estudiante sin configurar. Llama a `estado_estudiante`.');
    return sesionDeHoy({
      temario,
      universidad,
      estudiante: est,
      progreso: this.almacen.progreso(this.id),
      foco: this.almacen.foco(this.id),
      simulacros: this.almacen.simulacros(this.id, 5),
      hoy,
      minutos,
      transversal,
    });
  }

  async plan_estudio() {
    const { temario, est, universidad, hoy } = await this.ctx();
    if (!est) throw new ErrorDeUso('Estudiante sin configurar. Llama a `estado_estudiante`.');
    return planGeneral({ temario, universidad, estudiante: est, progreso: this.almacen.progreso(this.id), simulacros: this.almacen.simulacros(this.id), hoy });
  }

  // — Índice y temas ———————————————————————————————————————————————

  /** Dominio agregado de varios temas: el más bajo manda. */
  dominioDe(temas, progreso, hoy) {
    if (!temas.length) return 'sin_ver';
    const ds = temas.map((t) => dominio(progreso.get(t), hoy));
    return ORDEN_DOMINIO[Math.min(...ds.map((d) => ORDEN_DOMINIO.indexOf(d)))];
  }

  async ver_indice({ rama, unidad, vista } = {}) {
    const { temario, universidad, hoy } = await this.ctx();
    const progreso = this.almacen.progreso(this.id);
    const foco = new Set(this.almacen.foco(this.id));
    const leyenda = Object.values(DOMINIOS).map((d) => `${d.icono} ${d.nombre}`).join(' · ') + ' · ⭐ elegido por ti';
    const conCedulario = universidad && Object.keys(universidad.cedularios).length;
    const modo = vista ?? (conCedulario ? 'cedulario' : 'temario');
    if (modo === 'cedulario' && !conCedulario) throw new ErrorDeUso('La universidad del estudiante no tiene cedulario cargado; usa vista "temario".');

    // Sin rama: panorama por unidad, para no volcar 270 líneas de una vez.
    if (!rama) {
      const resumen = {};
      for (const r of ['civil', 'procesal']) {
        const alc = new Set(alcance(temario, universidad)[r]);
        resumen[r] = temario.ramas[r].unidades
          .map((u) => {
            const ts = u.temas.filter((t) => alc.has(t));
            if (!ts.length) return null;
            const c = Object.fromEntries(ORDEN_DOMINIO.map((d) => [d, 0]));
            for (const t of ts) c[dominio(progreso.get(t), hoy)]++;
            const barra = ORDEN_DOMINIO.slice().reverse().map((d) => icono(d).repeat(c[d])).join('');
            return `${u.titulo} (${u.id}) — ${ts.length} ${ts.length === 1 ? "tema" : "temas"} ${barra}`;
          })
          .filter(Boolean);
      }
      return { leyenda, vista: 'resumen por unidad', ramas: resumen, siguiente: 'Pide `ver_indice` con `rama` (y opcionalmente `unidad`) para ver cada tema o cédula.' };
    }

    if (modo === 'cedulario') {
      const cedulas = universidad.cedularios[rama] ?? [];
      const lineas = [];
      let seccion = '';
      for (const c of cedulas) {
        if (unidad && !c.temas.some((t) => temario.temas.get(t)?.unidad === unidad)) continue;
        const cab = unirSeccion(c);
        if (cab !== seccion) {
          lineas.push(`## ${cab}`);
          seccion = cab;
        }
        const estrella = c.temas.some((t) => foco.has(t)) ? ' ⭐' : '';
        // Un curso entero (cedulario UDP) agrupa decenas de temas: con un solo
        // ícono quedaría ⚪ hasta verlo todo. Se muestra además la cuenta.
        let detalle = '';
        if (c.temas.length > 3) {
          const ds = c.temas.map((t) => dominio(progreso.get(t), hoy));
          detalle = ` — ${ds.filter((d) => d !== 'sin_ver').length}/${ds.length} temas vistos, ${ds.filter((d) => d === 'dominado').length} dominados`;
        }
        const eeg = c.ejercicios?.length ? ` [EEG ${c.ejercicios.join('·')}]` : '';
        lineas.push(`${icono(this.dominioDe(c.temas, progreso, hoy))} ${c.numero}. ${c.tema}${eeg}${detalle}${estrella}`);
      }
      const excl = universidad.exclusiones?.[rama];
      return { leyenda, vista: `cedulario ${universidad.perfil.sigla} — ${rama}`, cedulas: lineas, ...(excl ? { excluido_del_examen: excl } : {}), como_elegir: `Para estudiar una cédula: elegir_temas con "${rama}:<número>". Para ver su contenido: ver_tema con cedula y rama.` };
    }

    const alc = new Set(alcance(temario, universidad)[rama]);
    const lineas = [];
    for (const u of temario.ramas[rama].unidades) {
      if (unidad && u.id !== unidad) continue;
      lineas.push(`## ${u.titulo} (${u.id})`);
      for (const t of u.temas) {
        const fuera = alc.has(t) ? '' : ' (fuera de tu cedulario)';
        lineas.push(`${icono(dominio(progreso.get(t), hoy))} ${temario.temas.get(t).titulo} — ${t}${foco.has(t) ? ' ⭐' : ''}${fuera}`);
      }
    }
    return { leyenda, vista: `temario — ${rama}`, temas: lineas };
  }

  /** Acepta un id de tema, "rama:número" de cédula o un id de unidad. Devuelve ids de tema. */
  async resolverTemas(refs) {
    const { temario, universidad } = await this.ctx();
    const out = [];
    for (const ref of refs) {
      const r = String(ref).trim();
      if (temario.temas.has(r)) {
        out.push(r);
        continue;
      }
      const m = r.match(/^(civil|procesal)\s*[:#]\s*(\d+)$/i);
      if (m) {
        const c = universidad?.cedularios[m[1].toLowerCase()]?.find((x) => x.numero === Number(m[2]));
        if (!c) throw new ErrorDeUso(`No existe la cédula ${m[2]} de ${m[1]} en el cedulario de ${universidad?.perfil.sigla ?? 'la universidad del estudiante (no tiene cedulario)'}.`);
        out.push(...c.temas);
        continue;
      }
      // "ejercicio:2" (UNAB): todas las cédulas que se evalúan en ese ejercicio de examen de grado.
      const ej = r.match(/^(?:(civil|procesal)\s*:\s*)?(?:ejercicio|eeg)\s*[:#]?\s*(\d+)$/i);
      if (ej) {
        const ramas = ej[1] ? [ej[1].toLowerCase()] : Object.keys(universidad?.cedularios ?? {});
        const cs = ramas.flatMap((x) => (universidad?.cedularios[x] ?? []).filter((c) => c.ejercicios?.includes(Number(ej[2]))));
        if (!cs.length) throw new ErrorDeUso(`El cedulario de ${universidad?.perfil.sigla ?? 'la universidad del estudiante'} no distingue ejercicios, o ninguna cédula corresponde al ejercicio ${ej[2]}.`);
        out.push(...cs.flatMap((c) => c.temas));
        continue;
      }
      const unidad = temario.ramas[r.split('.')[0]]?.unidades.find((u) => u.id === r);
      if (unidad) {
        out.push(...unidad.temas);
        continue;
      }
      throw new ErrorDeUso(`No reconozco "${r}". Usa un id de tema (civil.acto.nulidad_relativa), una cédula ("civil:40"), una unidad ("civil.bienes") o, si tu universidad los distingue, un ejercicio ("ejercicio:2"). Busca con buscar_temario.`);
    }
    return [...new Set(out)];
  }

  async ver_tema({ tema, cedula, rama } = {}) {
    const { temario, universidad, transversal, plazos, confusiones, hoy } = await this.ctx();
    const progreso = this.almacen.progreso(this.id);
    let ids;
    let ced = null;
    if (cedula !== undefined) {
      if (!rama) throw new ErrorDeUso('Para ver una cédula indica también la rama (civil o procesal).');
      ced = universidad?.cedularios[rama]?.find((c) => c.numero === Number(cedula));
      if (!ced) throw new ErrorDeUso(`No existe la cédula ${cedula} de ${rama} en el cedulario del estudiante.`);
      ids = ced.temas;
    } else if (tema) {
      ids = await this.resolverTemas([tema]);
    } else {
      throw new ErrorDeUso('Indica `tema` (id) o `cedula` + `rama`.');
    }

    const ficha = (id) => {
      const t = temario.temas.get(id);
      const e = progreso.get(id);
      const d = dominio(e, hoy);
      const cedulas = Object.entries(universidad?.cedularios ?? {}).flatMap(([r, cs]) =>
        cs.filter((c) => c.temas.includes(id)).map((c) => ({ rama: r, numero: c.numero, tema: c.tema, ...(ced ? {} : { contenido: c.contenido }) })),
      );
      return {
        id,
        titulo: t.titulo,
        rama: t.rama,
        unidad: t.unidadTitulo,
        normas: t.articulos.map((a) => ({ referencia: a, cita: citaLegible(a) })),
        requiere: t.requiere.map((r) => ({ id: r, titulo: temario.temas.get(r).titulo, dominio: `${icono(dominio(progreso.get(r), hoy))} ${DOMINIOS[dominio(progreso.get(r), hoy)].nombre}` })),
        relacionados: t.relacionados.map((r) => ({ id: r, titulo: temario.temas.get(r).titulo })),
        ...(cedulas.length ? { en_tu_cedulario: cedulas } : {}),
        ...(plazos.some((p) => p.tema === id) ? { plazos: plazos.filter((p) => p.tema === id).map((p) => ({ pregunta: p.pregunta, respuesta: p.respuesta, fundamento: citaLegible(p.articulo) })) } : {}),
        ...(confusiones.some((c) => c.temas.includes(id))
          ? { se_confunde_con: confusiones.filter((c) => c.temas.includes(id)).map((c) => ({ par: c.nombre, comparar_por: c.ejes.join(' · ') })) }
          : {}),
        ...(transversal?.de(id) ? { se_exige_en: `${transversal.de(id).universidades} de ${transversal.de(id).de} cedularios oficiales de ${t.rama === 'civil' ? 'Civil' : 'Procesal'}` } : {}),
        tu_estado: {
          dominio: `${icono(d)} ${DOMINIOS[d].nombre}`,
          ...(e ? { repasos: e.repasos, olvidos: e.lapsos, ultimo_repaso: e.ultimo_repaso, proximo_repaso: e.proximo, recuerdo_estimado_hoy: `${Math.round(recuperabilidadHoy(e, hoy) * 100)}%` } : {}),
        },
        errores_anteriores: this.almacen.respuestas(this.id, { tema: id, limite: 10 }).filter((r) => r.error).slice(0, 5).map((r) => ({ fecha: r.fecha, pregunta: r.pregunta, error: r.error })),
        material_guardado: this.almacen.material(this.id, { tema: id }).map((m) => ({ id: m.id, tipo: m.tipo, titulo: m.titulo })),
      };
    };
    return {
      ...(ced
        ? {
            cedula: {
              rama,
              numero: ced.numero,
              tema: ced.tema,
              seccion: unirSeccion(ced),
              contenido: ced.contenido || '(el cedulario no desglosa esta cédula)',
              ...(ced.excluidas ? { excluidas: ced.excluidas.trim() } : {}),
              ...(ced.bibliografia ? { bibliografia_recomendada: ced.bibliografia.trim() } : {}),
            },
          }
        : {}),
      temas: ids.map(ficha),
      recordatorio: 'Antes de afirmar qué dice un artículo, tráelo con `ver_articulo`. Para doctrina, `buscar_en_manuales`.',
    };
  }

  async buscar_temario({ texto } = {}) {
    if (!texto?.trim()) throw new ErrorDeUso('Indica `texto`.');
    const { temario, universidad } = await this.ctx();
    const terminos = sinTildes(texto).split(/\s+/).filter((t) => t.length > 2);
    const puntaje = (heno) => terminos.filter((t) => sinTildes(heno).includes(t)).length;
    const temas = [...temario.temas.values()]
      .map((t) => ({ t, p: puntaje(`${t.titulo} ${t.unidadTitulo} ${t.id}`) }))
      .filter((x) => x.p > 0)
      .sort((a, b) => b.p - a.p || a.t.orden - b.t.orden)
      .slice(0, 12)
      .map(({ t }) => ({ id: t.id, titulo: t.titulo, unidad: t.unidadTitulo }));
    const cedulas = Object.entries(universidad?.cedularios ?? {})
      .flatMap(([r, cs]) => cs.map((c) => ({ r, c, p: puntaje(`${c.tema} ${c.contenido}`) })))
      .filter((x) => x.p > 0)
      .sort((a, b) => b.p - a.p)
      .slice(0, 10)
      .map(({ r, c }) => ({ ref: `${r}:${c.numero}`, tema: c.tema }));
    return { temas, ...(universidad ? { cedulas } : {}) };
  }

  async elegir_temas({ agregar = [], quitar = [], limpiar = false } = {}) {
    const { temario, hoy } = await this.ctx();
    if (limpiar) this.almacen.limpiarFoco(this.id);
    if (quitar.length) this.almacen.quitarFoco(this.id, await this.resolverTemas(quitar));
    if (agregar.length) this.almacen.agregarFoco(this.id, await this.resolverTemas(agregar), hoy);
    const foco = this.almacen.foco(this.id);
    return {
      elegidos: foco.map((t) => `${temario.temas.get(t).titulo} — ${t}`),
      nota: 'Los temas elegidos que aún no has visto pasan primero en `sesion_de_hoy`. Los ya vistos siguen su calendario de repaso.',
    };
  }

  // — Registro del aprendizaje ——————————————————————————————————————

  async registrar_respuesta({ tema, calificacion, modo, pregunta, error, confianza } = {}) {
    const { temario, est, hoy } = await this.ctx();
    if (!temario.temas.has(tema)) throw new ErrorDeUso(`Tema desconocido "${tema}". Registra por id de tema (una cédula puede abarcar varios; usa ver_tema para ver cuáles).`);
    const dada = Number(calificacion);
    if (![1, 2, 3, 4].includes(dada)) throw new ErrorDeUso('calificacion: 1 (otra vez), 2 (difícil), 3 (bien) o 4 (fácil).');
    if (confianza !== undefined && !['alta', 'media', 'baja'].includes(confianza)) throw new ErrorDeUso('confianza: alta, media o baja.');
    // Un acierto con baja confianza es casi una adivinanza: se programa como
    // "difícil" para que vuelva pronto. El error con alta confianza es el más
    // valioso de corregir (efecto de hipercorrección): se marca para reenseñar.
    const g = confianza === 'baja' && dada >= 3 ? 2 : dada;
    const previo = this.almacen.estadoTema(this.id, tema);
    // En el diagnóstico, lo que no sabe todavía no se "repasa": se enseña. No
    // se crea estado de repaso (seguiría contando como tema nuevo) y se marca
    // como foco para que la sesión lo ponga primero.
    if (modo === 'diagnostico' && g <= 2 && !previo) {
      this.almacen.registrarRespuesta(this.id, { tema, fecha: hoy, calificacion: dada, modo, pregunta, error, confianza });
      this.almacen.agregarFoco(this.id, [tema], hoy);
      return {
        tema: temario.temas.get(tema).titulo,
        diagnostico: 'Todavía no lo domina: queda marcado para enseñarlo primero (foco), sin contarlo como visto.',
        ...(dada === 1 && confianza === 'alta' ? { error_de_alta_confianza: 'Estaba seguro y se equivocó: anótalo y trabájalo apenas empiece ese tema.' } : {}),
      };
    }
    let nuevo = programar(previo, g, hoy, { fechaExamen: est?.fecha_examen });
    // Dos recuperaciones el mismo día no son dos repasos espaciados. FSRS ya no
    // sube la estabilidad con 0 días transcurridos, pero la calificación que
    // cuenta para el dominio es la peor del día: si falló en la mañana, un
    // acierto en la tarde (con la respuesta fresca) no lo saca de "débil".
    if (previo?.ultimo_repaso === hoy) nuevo = { ...nuevo, ultima_calificacion: Math.min(previo.ultima_calificacion, g) };
    this.almacen.transaccion(() => {
      this.almacen.guardarEstado(this.id, tema, nuevo);
      this.almacen.registrarRespuesta(this.id, { tema, fecha: hoy, calificacion: dada, modo, pregunta, error, confianza });
    });
    const d = dominio(nuevo, hoy);
    return {
      tema: temario.temas.get(tema).titulo,
      calificacion: `${g} (${CALIFICACIONES[g]})`,
      ...(g !== dada ? { ajuste: 'Acertó sin seguridad: se programa como "difícil" para confirmarlo pronto. Dile que el acierto cuenta, y que volverá a verlo.' } : {}),
      ...(dada === 1 && confianza === 'alta'
        ? {
            error_de_alta_confianza:
              'Estaba seguro y se equivocó: es el error que mejor se corrige si se trabaja ahora. Muestra el contraste (lo que creía vs. la regla y su fundamento), ' +
              'pídele que explique con sus palabras por qué la regla es así, y vuelve a preguntarlo en otra forma antes de terminar la sesión.',
          }
        : {}),
      dominio: `${icono(d)} ${DOMINIOS[d].nombre}`,
      proximo_repaso: nuevo.proximo,
      en_dias: diasEntre(hoy, nuevo.proximo),
      ...(error ? { error_anotado: true } : {}),
    };
  }

  async sortear_cedula({ rama, numero, prioridad = 'azar', ejercicio } = {}) {
    const { temario, universidad, hoy } = await this.ctx();
    const progreso = this.almacen.progreso(this.id);
    const ramas = rama ? [rama] : ['civil', 'procesal'];
    const elegir = (lista, peso) => {
      if (prioridad !== 'debiles') return lista[Math.floor(Math.random() * lista.length)];
      const pesos = lista.map(peso);
      let x = Math.random() * pesos.reduce((a, b) => a + b, 0);
      return lista.find((_, i) => (x -= pesos[i]) <= 0) ?? lista.at(-1);
    };
    // Pesos para practicar debilidades: lo débil y lo no visto salen más.
    const pesoTemas = (ts) => (ts.length ? Math.max(...ts.map((t) => ({ sin_ver: 2, debil: 4, aprendiendo: 3, consolidando: 1.5, dominado: 1 })[dominio(progreso.get(t), hoy)])) : 1);
    // Modalidad por ramo: en la UDD, Civil es un caso escrito y Procesal es oral.
    const modalidadDe = (r) => universidad?.perfil.examen?.modalidad_por_ramo?.[r] ?? universidad?.perfil.examen?.modalidad;
    const formato = universidad?.perfil.examen?.formato_preguntas;
    const sortearTres = (pool, n = 3) => {
      const disponibles = [...pool];
      const temas = [];
      while (temas.length < n && disponibles.length) {
        const t = elegir(disponibles, (x) => pesoTemas([x]));
        temas.push(t);
        disponibles.splice(disponibles.indexOf(t), 1);
      }
      return temas;
    };
    const sorteo = ramas.map((r) => {
      const escrita = modalidadDe(r) === 'escrita';
      let cedulas = universidad?.cedularios[r];
      if (ejercicio !== undefined) {
        cedulas = (cedulas ?? []).filter((c) => c.ejercicios?.includes(Number(ejercicio)));
        if (!cedulas.length) throw new ErrorDeUso(`Ninguna cédula de ${r} corresponde al ejercicio ${ejercicio} en el cedulario de ${universidad?.perfil.sigla ?? 'tu universidad'}.`);
      }
      if (escrita && formato === 'seleccion_multiple' && numero === undefined) {
        // Examen objetivo (UNAB): varios casos breves, cada uno con preguntas de
        // alternativas; conviene que crucen distintos temas del alcance.
        const pool = [...new Set((cedulas?.length ? cedulas.flatMap((c) => c.temas) : alcance(temario, universidad)[r]))];
        const temas = sortearTres(pool, 6);
        return {
          rama: r,
          modalidad: 'seleccion_multiple',
          ...(ejercicio !== undefined ? { ejercicio: Number(ejercicio) } : {}),
          temas,
          temas_titulos: temas.map((t) => temario.temas.get(t).titulo),
          para: 'construir 3 casos breves con 3-4 preguntas de alternativas cada uno (una sola correcta), cubriendo estos temas',
        };
      }
      if (cedulas?.length) {
        const c = numero !== undefined ? cedulas.find((x) => x.numero === Number(numero)) : elegir(cedulas, (x) => pesoTemas(x.temas));
        if (!c) throw new ErrorDeUso(`No existe la cédula ${numero} de ${r}.`);
        if (escrita && c.temas.length > 3) {
          // Examen escrito sobre un caso: el caso cruza unos pocos temas del
          // curso, no el curso entero. Se sortean tres para construirlo.
          const temas = sortearTres(c.temas);
          return { rama: r, modalidad: 'escrita', cedula: c.numero, tema: c.tema, temas, temas_titulos: temas.map((t) => temario.temas.get(t).titulo), para: 'construir un caso que cruce estos temas' };
        }
        return { rama: r, modalidad: modalidadDe(r) ?? 'oral', cedula: c.numero, tema: c.tema, contenido: c.contenido || '(sin desglose en el cedulario)', temas: c.temas };
      }
      const ids = alcance(temario, universidad)[r];
      if (escrita) {
        const temas = sortearTres(ids);
        return { rama: r, modalidad: 'escrita', cedula: null, temas, temas_titulos: temas.map((t) => temario.temas.get(t).titulo), para: 'construir un caso que cruce estos temas' };
      }
      const id = elegir(ids, (t) => pesoTemas([t]));
      return { rama: r, modalidad: modalidadDe(r) ?? 'oral', cedula: null, tema: temario.temas.get(id).titulo, temas: [id] };
    });
    return {
      universidad: universidad?.perfil.sigla ?? 'sin perfil',
      modalidad: universidad?.perfil.examen?.modalidad ?? 'desconocida',
      prioridad,
      sorteo,
      como_seguir: sorteo.some((x) => x.modalidad === 'seleccion_multiple')
        ? 'Arma los casos y preguntas según el método de simulacro (guia_del_tutor, modo "simulacro"; sección selección múltiple): alternativas plausibles, sin pistas. Corrige al final, explica cada alternativa, calcula la nota con `calcular_nota` y guarda con `registrar_simulacro`.'
        : 'Simula la comisión según `perfil_examen` (estilo_comision). Al terminar, `registrar_simulacro` con una calificación por cada tema evaluado.',
    };
  }

  async registrar_simulacro({ nota, cedulas, rubrica, fortalezas, a_mejorar, temas_evaluados = [] } = {}) {
    const { temario, est, hoy } = await this.ctx();
    if (nota !== undefined && !(nota >= 1 && nota <= 7)) throw new ErrorDeUso('La nota va de 1,0 a 7,0.');
    for (const te of temas_evaluados) {
      if (!temario.temas.has(te.tema)) throw new ErrorDeUso(`Tema desconocido en temas_evaluados: ${te.tema}`);
      if (![1, 2, 3, 4].includes(Number(te.calificacion))) throw new ErrorDeUso(`Calificación inválida para ${te.tema}: usa 1, 2, 3 o 4.`);
    }
    const id = this.almacen.guardarSimulacro(this.id, { fecha: hoy, universidad: est?.universidad, cedulas, nota, rubrica, fortalezas, a_mejorar });
    const actualizados = [];
    for (const te of temas_evaluados) {
      actualizados.push(await this.registrar_respuesta({ tema: te.tema, calificacion: te.calificacion, modo: 'simulacro', pregunta: te.pregunta, error: te.error, confianza: te.confianza }));
    }
    const historial = this.almacen.simulacros(this.id, 10).map((s) => ({ fecha: s.fecha, nota: s.nota }));
    return { guardado: id, temas_actualizados: actualizados, historial_notas: historial };
  }

  async progreso() {
    const { temario, est, universidad, hoy } = await this.ctx();
    const progreso = this.almacen.progreso(this.id);
    const plan = est ? planGeneral({ temario, universidad, estudiante: est, progreso, simulacros: this.almacen.simulacros(this.id), hoy }) : null;
    const porUnidad = {};
    const alc = alcance(temario, universidad);
    for (const r of ['civil', 'procesal']) {
      const set = new Set(alc[r]);
      for (const u of temario.ramas[r].unidades) {
        const ts = u.temas.filter((t) => set.has(t));
        if (!ts.length) continue;
        const c = Object.fromEntries(ORDEN_DOMINIO.map((d) => [d, 0]));
        for (const t of ts) c[dominio(progreso.get(t), hoy)]++;
        porUnidad[u.titulo] = `${ORDEN_DOMINIO.slice().reverse().map((d) => icono(d).repeat(c[d])).join('')} (${ts.length - c.sin_ver}/${ts.length} vistos, ${c.dominado} dominados)`;
      }
    }
    const masOlvidados = [...progreso.values()]
      .filter((e) => e.lapsos > 0)
      .sort((a, b) => b.lapsos - a.lapsos)
      .slice(0, 8)
      .map((e) => ({ tema: temario.temas.get(e.tema)?.titulo, id: e.tema, olvidos: e.lapsos }));
    return {
      resumen: plan,
      por_unidad: porUnidad,
      simulacros: this.almacen.simulacros(this.id, 10).map((s) => ({ fecha: s.fecha, nota: s.nota, cedulas: s.cedulas, a_mejorar: s.a_mejorar })),
      temas_que_mas_se_olvidan: masOlvidados,
      errores_recientes: this.almacen.errores(this.id, 10).map((e) => ({ ...e, tema: temario.temas.get(e.tema)?.titulo ?? e.tema })),
      racha_dias: this.racha(hoy),
      calibracion: this.calibracion(),
    };
  }

  /** ¿Sabe lo que sabe? Aciertos según la confianza que declaró antes de ver la corrección. */
  calibracion() {
    const filas = this.almacen.calibracion(this.id);
    if (!filas.length) return 'Sin datos: pide al estudiante su confianza (alta/media/baja) antes de corregir y regístrala en `confianza`.';
    const por = Object.fromEntries(filas.map((f) => [f.confianza, { respuestas: f.respuestas, aciertos: `${Math.round((100 * f.aciertos) / f.respuestas)}%` }]));
    const pct = (c) => (por[c] ? parseInt(por[c].aciertos, 10) : null);
    let lectura = 'Calibración razonable.';
    if (pct('alta') !== null && pct('alta') < 75) lectura = 'Sobreconfianza: cuando dice estar seguro acierta poco. Conviene más recuperación con verificación y menos relectura.';
    else if (pct('baja') !== null && pct('baja') > 60) lectura = 'Subconfianza: sabe más de lo que cree. Conviene simulacros para ganar seguridad.';
    return { por_confianza: por, lectura };
  }

  // — Práctica dirigida ———————————————————————————————————————————————

  /** Pesos para elegir qué practicar: lo visto y débil pesa más que lo nuevo. */
  pesoPractica(progreso, hoy) {
    return (id) => ({ sin_ver: 0.6, debil: 4, aprendiendo: 3, consolidando: 2, dominado: 1 })[dominio(progreso.get(id), hoy)];
  }

  async enAlcance(rama, tema) {
    const { temario, universidad } = await this.ctx();
    const alc = alcance(temario, universidad);
    let ids = new Set(rama ? alc[rama] : [...alc.civil, ...alc.procesal]);
    if (tema) {
      const pedidos = new Set(await this.resolverTemas([tema]));
      ids = new Set([...ids].filter((x) => pedidos.has(x)));
      if (!ids.size) ids = pedidos; // lo pidió explícitamente aunque su cedulario no lo incluya
    }
    return ids;
  }

  async practicar_plazos({ rama, tema, cantidad = 5 } = {}) {
    const { temario, plazos, hoy } = await this.ctx();
    const ids = await this.enAlcance(rama, tema);
    const pool = plazos.filter((p) => ids.has(p.tema));
    if (!pool.length) throw new ErrorDeUso('No hay plazos cargados para ese filtro. Prueba sin `tema`, o con la otra rama.');
    const progreso = this.almacen.progreso(this.id);
    const peso = this.pesoPractica(progreso, hoy);
    const n = Math.min(Number(cantidad) || 5, 15);
    // Un plazo sin la institución detrás no se retiene: primero los de temas ya vistos.
    const vistos = pool.filter((p) => progreso.has(p.tema));
    const elegidos = vistos.length >= n || tema ? elegirPonderado(vistos.length >= n ? vistos : pool, n, (p) => peso(p.tema)) : [...elegirPonderado(vistos, n, (p) => peso(p.tema)), ...elegirPonderado(pool.filter((p) => !progreso.has(p.tema)), n - vistos.length, () => 1)];
    return {
      preguntas: elegidos.map((p, i) => ({
        n: i + 1,
        tema: p.tema,
        tema_visto: progreso.has(p.tema),
        tema_titulo: temario.temas.get(p.tema).titulo,
        pregunta: p.pregunta,
        respuesta: p.respuesta,
        ...(p.precision ? { precision: p.precision } : {}),
        fundamento: citaLegible(p.articulo),
        articulo: p.articulo,
      })),
      verificado: 'Cada plazo se comprobó contra el texto vigente de Ley Chile (npm run verificar-plazos).',
      como_seguir:
        'Pregunta de a uno y NO muestres la respuesta hasta que conteste (pídele también su confianza). Corrige con el fundamento. ' +
        'Registra cada uno con registrar_respuesta (modo "plazos"): acierto 3, acierto con la precisión 4, error 2 (un plazo olvidado no borra el tema). ' +
        'Al final, vuelve a preguntar los que falló, en otro orden. Truco de memoria: agrupar por número ("todo lo que es 4 años").',
    };
  }

  async practicar_discriminacion({ rama, tema, cantidad = 1 } = {}) {
    const { temario, confusiones, hoy } = await this.ctx();
    const ids = await this.enAlcance(rama, tema);
    const progreso = this.almacen.progreso(this.id);
    const pool = confusiones.filter((c) => c.temas.some((t) => ids.has(t)));
    if (!pool.length) throw new ErrorDeUso('No hay pares de instituciones para ese filtro.');
    // Comparar sirve cuando ambas instituciones ya se estudiaron (intercalado):
    // se prefieren pares con los dos temas vistos.
    const peso = (c) => {
      const vistos = c.temas.filter((t) => progreso.has(t)).length / c.temas.length;
      const debil = c.temas.some((t) => ['debil', 'aprendiendo'].includes(dominio(progreso.get(t), hoy)));
      return 0.3 + 2 * vistos + (debil ? 1.5 : 0);
    };
    const elegidos = elegirPonderado(pool, Math.min(Number(cantidad) || 1, 5), peso);
    return {
      pares: elegidos.map((c) => ({
        par: c.nombre,
        temas: c.temas.map((t) => ({ id: t, titulo: temario.temas.get(t).titulo, dominio: DOMINIOS[dominio(progreso.get(t), hoy)].nombre })),
        comparar_por: c.ejes,
        normas: [...new Set(c.temas.flatMap((t) => temario.temas.get(t).articulos))].map((a) => ({ referencia: a, cita: citaLegible(a) })),
      })),
      como_seguir:
        '1) El estudiante arma de memoria un cuadro comparativo (filas = ejes, columnas = instituciones). ' +
        '2) Corrige casilla por casilla, trayendo la norma con ver_articulo. ' +
        '3) Luego 2-3 casos breves en que debe decidir QUÉ institución aplica y por qué (el error típico es aplicar la vecina). ' +
        'Registra por tema (modo "discriminacion") y ofrece guardar el cuadro con guardar_material (tipo "cuadro").',
    };
  }

  async preparar_exposicion({ rama, numero, tema, minutos } = {}) {
    const { temario, universidad } = await this.ctx();
    let titulo;
    let contenidoOficial;
    let ids;
    if (numero !== undefined) {
      if (!rama) throw new ErrorDeUso('Indica `rama` junto con `numero`.');
      const c = universidad?.cedularios[rama]?.find((x) => x.numero === Number(numero));
      if (!c) throw new ErrorDeUso(`No existe la cédula ${numero} de ${rama} en el cedulario del estudiante.`);
      titulo = c.tema;
      contenidoOficial = c.contenido;
      ids = c.temas;
    } else if (tema) {
      ids = await this.resolverTemas([tema]);
      titulo = ids.map((t) => temario.temas.get(t).titulo).join(' · ');
      contenidoOficial = ids.map((t) => `${temario.temas.get(t).titulo}.`).join('\n');
    } else throw new ErrorDeUso('Indica la cédula (`rama` + `numero`) o un `tema`.');
    const examen = universidad?.perfil.examen ?? {};
    const min = Number(minutos) || examen.exposicion_minutos || 8;
    const puntos = puntosDeCedula(contenidoOficial, titulo);
    const errores = ids.flatMap((t) => this.almacen.respuestas(this.id, { tema: t, limite: 20 }).filter((r) => r.error).map((r) => r.error)).slice(0, 5);
    return {
      cedula: titulo,
      minutos: min,
      guion: guionDeExposicion(puntos, min),
      debe_cubrir: puntos,
      temas: ids.map((t) => ({ id: t, titulo: temario.temas.get(t).titulo, normas: temario.temas.get(t).articulos })),
      ...(errores.length ? { cuidado_con: errores } : {}),
      rubrica: ['Estructura anunciada y respetada', 'Cobertura de los puntos de la cédula', 'Precisión normativa (artículos correctos)', 'Lenguaje jurídico', 'Manejo del tiempo', 'Respuesta a la interrogación posterior'],
      como_seguir:
        'El estudiante prepara un guion de palabras clave (no un texto para leer) y expone contra el reloj: pídele que avise al empezar y al terminar. ' +
        'Marca qué puntos cubrió y cuáles no, evalúa con la rúbrica y luego interroga 5-8 min como la comisión, sobre lo omitido o impreciso. ' +
        'Repetir la exposición una segunda vez el mismo día mejora mucho más que una sola versión perfecta.',
    };
  }

  async diagnostico({ rama, cantidad = 12 } = {}) {
    const { temario, universidad, transversal } = await this.ctx();
    const progreso = this.almacen.progreso(this.id);
    const alc = alcance(temario, universidad);
    const ramas = rama ? [rama] : ['civil', 'procesal'];
    // Un tema por unidad (el más exigido entre universidades), intercalando
    // ramos: da una foto amplia en poco tiempo y activa conocimientos previos.
    const porRama = ramas.map((r) => {
      const set = new Set(alc[r]);
      return temario.ramas[r].unidades
        .map((u) => u.temas.filter((t) => set.has(t) && !progreso.has(t)).sort((a, b) => (transversal?.de(b)?.proporcion ?? 0) - (transversal?.de(a)?.proporcion ?? 0))[0])
        .filter(Boolean);
    });
    const orden = [];
    for (let i = 0; orden.length < Number(cantidad) && porRama.some((l) => i < l.length); i++) for (const l of porRama) if (i < l.length && orden.length < Number(cantidad)) orden.push(l[i]);
    if (!orden.length) return { temas: [], nota: 'Ya hay registro en todas las unidades: el progreso reemplaza al diagnóstico (usa `progreso`).' };
    return {
      temas: orden.map((t) => ({ id: t, titulo: temario.temas.get(t).titulo, unidad: temario.temas.get(t).unidadTitulo })),
      como_seguir:
        'Una pregunta por tema, de dificultad media y SIN enseñar todavía (es un pretest: equivocarse ahora también ayuda a aprender después). ' +
        'Pide su confianza antes de corregir. Registra cada una con registrar_respuesta (modo "diagnostico", con confianza): lo que no domina queda como foco, ' +
        'lo que sí domina entra al repaso. Cierra con un resumen por unidad y una propuesta de por dónde empezar.',
    };
  }

  async exportar({ formato, hora = '19:00' } = {}) {
    const { temario, est, universidad, plazos, hoy } = await this.ctx();
    const dir = await carpetaExportaciones();
    if (formato === 'anki') {
      const tarjetas = [];
      for (const m of this.almacen.material(this.id).filter((x) => x.tipo === 'tarjetas')) {
        const completo = this.almacen.material(this.id, { id: m.id })[0] ?? m;
        const rama = completo.tema ? temario.temas.get(completo.tema)?.rama : null;
        for (const t of tarjetasDeTexto(completo.contenido)) tarjetas.push({ ...t, etiquetas: ['examen-grado', rama, completo.tema?.replace(/\./g, '::')].filter(Boolean) });
      }
      const alc = new Set(Object.values(alcance(temario, universidad)).flat());
      for (const p of plazos.filter((x) => alc.has(x.tema))) {
        tarjetas.push({ frente: p.pregunta, reverso: `${p.respuesta}${p.precision ? `\n${p.precision}` : ''}\n(${citaLegible(p.articulo)})`, etiquetas: ['examen-grado', 'plazos', temario.temas.get(p.tema).rama] });
      }
      const ruta = join(dir, `examen-grado-tarjetas-${hoy}.txt`);
      await writeFile(ruta, textoAnki(tarjetas));
      return {
        archivo: ruta,
        tarjetas: tarjetas.length,
        de_tu_material: tarjetas.filter((t) => !t.etiquetas.includes('plazos')).length,
        plazos: tarjetas.filter((t) => t.etiquetas.includes('plazos')).length,
        como_importar: 'En Anki: Archivo → Importar → elige el archivo. Las columnas (frente, reverso, etiquetas) se reconocen solas.',
        nota: 'Para sumar tarjetas propias, guárdalas con guardar_material (tipo "tarjetas") en formato "P: pregunta" / "R: respuesta".',
      };
    }
    if (formato === 'calendario') {
      if (!est?.fecha_examen) throw new ErrorDeUso('Falta la fecha de examen (configurar_estudiante).');
      if (!/^\d{1,2}:\d{2}$/.test(hora)) throw new ErrorDeUso('hora en formato HH:MM, p. ej. "19:00".');
      const plan = planGeneral({ temario, universidad, estudiante: est, progreso: this.almacen.progreso(this.id), simulacros: this.almacen.simulacros(this.id), hoy });
      const cal = calendarioIcs({ hoy, fechaExamen: est.fecha_examen, fases: plan.fases, minutos: minutosPorDia(est), diasSemana: est.dias_semana ?? 6, hora, universidad: universidad?.perfil.sigla });
      if (!cal) throw new ErrorDeUso('La fecha de examen ya pasó o es hoy.');
      const ruta = join(dir, `examen-grado-plan-${hoy}.ics`);
      await writeFile(ruta, cal.ics);
      return {
        archivo: ruta,
        sesiones: cal.sesiones,
        simulacros: cal.simulacros,
        supuestos: `Una sesión de ${minutosPorDia(est)} min a las ${hora}, ${est.dias_semana ?? 6} días por semana desde el lunes.`,
        como_importar: 'Ábrelo con doble clic (Calendario de macOS, Outlook) o impórtalo en Google Calendar (Configuración → Importar).',
      };
    }
    if (formato === 'respaldo') {
      const ruta = join(dir, `examen-grado-respaldo-${hoy}.sqlite`);
      await rm(ruta, { force: true });
      this.almacen.respaldar(ruta);
      return {
        archivo: ruta,
        como_restaurar:
          `En el otro computador, instala el tutor y copia este archivo como ${join('~', '.examen-grado', 'estudio.sqlite')} ` +
          '(con Claude cerrado). Trae todo: progreso, respuestas, simulacros, material, manuales y documentos.',
      };
    }
    throw new ErrorDeUso('formato: "anki" (tarjetas y plazos), "calendario" (plan de sesiones .ics) o "respaldo" (copia de todo tu progreso).');
  }

  // — Método (la skill, servida por el servidor) ———————————————————————

  /**
   * El método pedagógico completo vive en skills/examen-grado. Quien instala
   * sólo la extensión (sin subir la skill) lo recibe igual por esta vía: así
   * basta un paso para instalar el tutor.
   */
  async guia_del_tutor({ modo = 'inicio' } = {}) {
    const archivos = GUIAS[modo];
    if (!archivos) throw new ErrorDeUso(`modo: ${Object.keys(GUIAS).join(', ')}.`);
    const dir = join(raizProyecto(), 'skills', 'examen-grado');
    const textos = await Promise.all(archivos.map(async (f) => `<<${f}>>\n${(await readFile(join(dir, f), 'utf8')).replace(/^---[\s\S]*?---\n/, '')}`));
    return {
      modo,
      metodo: textos.join('\n\n'),
      nota: 'Sigue este método en lo que queda de la conversación. Las rutas "referencias/…" que mencione se piden con guia_del_tutor y el modo correspondiente.',
    };
  }

  // — Documentos que sube el estudiante ——————————————————————————————

  async cargar_documento({ ruta, texto, tipo, titulo, rama } = {}) {
    if ((!ruta && !texto?.trim()) || !tipo) throw new ErrorDeUso('Indica `tipo` y el documento: `texto` (lo que leíste de un archivo adjunto en la conversación) o `ruta` (PDF, .txt o .md en el computador).');
    if (!TIPOS_DOCUMENTO[tipo]) throw new ErrorDeUso(`tipo debe ser uno de: ${Object.keys(TIPOS_DOCUMENTO).join(', ')}.`);
    let abs = null;
    let paginas;
    let total;
    let sinTexto = 0;
    if (texto?.trim()) {
      // El estudiante adjuntó el archivo (PDF, Word, foto) y Claude ya lo leyó:
      // se guarda su texto para las sesiones siguientes, partido en "páginas".
      if (!titulo) throw new ErrorDeUso('Con `texto`, indica también `titulo` (p. ej. "Cedulario Civil 2025").');
      paginas = partirEnPaginas(texto);
      total = paginas.length;
    } else {
      abs = await rutaDocumento(ruta);
      if (/\.pdf$/i.test(abs)) ({ paginas, total, sinTexto } = await extraerPaginas(abs));
      else {
        paginas = partirEnPaginas(await readFile(abs, 'utf8'));
        total = paginas.length;
      }
      if (sinTexto === total) {
        return {
          cargado: false,
          motivo:
            'El PDF no tiene capa de texto (está escaneado). Pídele al estudiante que lo adjunte en la conversación: léelo como imagen ' +
            'y vuelve a llamar a cargar_documento con `texto` (tu transcripción fiel) y `titulo`.',
        };
      }
    }
    const nombre = titulo || basename(abs).replace(/\.(pdf|txt|md)$/i, '');
    const id = this.almacen.agregarDocumento(this.id, { tipo, titulo: nombre, rama, ruta: abs ?? '(adjunto en la conversación)', paginas, agregado: this.hoy() });
    let vista = '';
    for (const p of paginas) {
      if (vista.length > 3500) break;
      vista += `\n[pág. ${p.numero}]\n${p.texto}`;
    }
    return {
      cargado: true,
      id,
      tipo,
      titulo: nombre,
      paginas: total,
      ...(sinTexto ? { advertencia: `${sinTexto} páginas sin texto (escaneadas).` } : {}),
      comienzo: vista.slice(0, 3800),
      siguiente: TIPOS_DOCUMENTO[tipo],
    };
  }

  async leer_documento({ id, desde = 1, hasta } = {}) {
    const doc = this.almacen.documento(this.id, Number(id));
    if (!doc) throw new ErrorDeUso(`No hay documento ${id}. Usa listar_documentos.`);
    const ini = Math.max(1, Number(desde));
    const fin = Math.min(doc.paginas, Number(hasta ?? ini + 11));
    const paginas = [];
    let largo = 0;
    for (const p of this.almacen.paginasDocumento(doc.id, ini, fin)) {
      if (largo > 45000) break;
      paginas.push(p);
      largo += p.texto.length;
    }
    const ultima = paginas.at(-1)?.pagina ?? ini - 1;
    return {
      documento: { id: doc.id, tipo: doc.tipo, titulo: doc.titulo, paginas: doc.paginas },
      paginas,
      ...(ultima < doc.paginas ? { continua: `Quedan páginas: pide desde ${ultima + 1}.` } : { fin: true }),
    };
  }

  async listar_documentos({ tipo } = {}) {
    return { documentos: this.almacen.documentos(this.id, tipo) };
  }

  async quitar_documento({ id } = {}) {
    return { quitado: this.almacen.quitarDocumento(this.id, Number(id)) };
  }

  async guardar_cedulario({ rama, fuente, cedulas, borrar = false } = {}) {
    const { temario, hoy } = await this.ctx();
    if (!['civil', 'procesal'].includes(rama)) throw new ErrorDeUso('rama: civil o procesal.');
    if (borrar) {
      this.almacen.borrarCedularioPropio(this.id, rama);
      return { borrado: true, nota: 'Vuelve a usarse el cedulario oficial de la universidad, si lo hay.' };
    }
    if (!Array.isArray(cedulas) || !cedulas.length) throw new ErrorDeUso('`cedulas` debe ser una lista no vacía.');
    const limpias = [];
    const vistos = new Set();
    for (const [i, c] of cedulas.entries()) {
      const numero = Number.isInteger(c.numero) ? c.numero : i + 1;
      if (vistos.has(numero)) throw new ErrorDeUso(`Número de cédula repetido: ${numero}.`);
      vistos.add(numero);
      if (!c.tema?.trim()) throw new ErrorDeUso(`La cédula ${numero} no tiene tema.`);
      const temas = await this.resolverTemas(c.temas ?? []);
      if (!temas.length) throw new ErrorDeUso(`La cédula ${numero} ("${c.tema}") no está enlazada a ningún tema del temario. Usa buscar_temario para encontrar los ids.`);
      const otraRama = temas.find((t) => temario.temas.get(t).rama !== rama);
      if (otraRama) throw new ErrorDeUso(`La cédula ${numero} de ${rama} está enlazada a ${otraRama}, que es de otra rama.`);
      limpias.push({
        numero,
        seccion: c.seccion ?? 'Cedulario del estudiante',
        subseccion: c.subseccion ?? '',
        tema: c.tema.trim(),
        contenido: (c.contenido ?? '').trim(),
        ...(c.excluidas ? { excluidas: c.excluidas } : {}),
        temas,
      });
    }
    this.almacen.guardarCedularioPropio(this.id, rama, { fuente, cedulas: limpias }, hoy);
    const cubiertos = new Set(limpias.flatMap((c) => c.temas));
    return {
      guardado: true,
      rama,
      cedulas: limpias.length,
      temas_cubiertos: cubiertos.size,
      nota: 'Desde ahora el índice, el plan y los simulacros usan este cedulario. Revisa con `ver_indice`.',
    };
  }

  async guardar_perfil_examen(datos = {}) {
    const { hoy } = await this.ctx();
    const permitidos = ['universidad_nombre', 'nombre_examen', 'modalidad', 'modalidad_por_ramo', 'formato_preguntas', 'exposicion_minutos', 'partes', 'duracion_minutos', 'instrucciones', 'estilo', 'formato_pauta', 'calificacion', 'exigencia', 'notas', 'fuente'];
    const desconocidos = Object.keys(datos).filter((k) => !permitidos.includes(k));
    if (desconocidos.length) throw new ErrorDeUso(`Campos desconocidos: ${desconocidos.join(', ')}. Permitidos: ${permitidos.join(', ')}.`);
    if (datos.modalidad && !['oral', 'escrita', 'mixta'].includes(datos.modalidad)) throw new ErrorDeUso('modalidad: oral, escrita o mixta.');
    if (datos.formato_preguntas && !['desarrollo', 'caso', 'seleccion_multiple'].includes(datos.formato_preguntas)) throw new ErrorDeUso('formato_preguntas: desarrollo, caso o seleccion_multiple.');
    for (const m of Object.values(datos.modalidad_por_ramo ?? {})) if (!['oral', 'escrita'].includes(m)) throw new ErrorDeUso('modalidad_por_ramo: {"civil": "oral"|"escrita", "procesal": …}.');
    if (!datos.fuente) throw new ErrorDeUso('Indica `fuente`: de dónde sale esta información (reglamento, examen de tal fecha, lo que contó el estudiante…).');
    const previo = this.almacen.perfilPropio(this.id) ?? {};
    delete previo.actualizado;
    const nuevo = { ...previo, ...datos, fuentes: [...new Set([...(previo.fuentes ?? []), datos.fuente])] };
    delete nuevo.fuente;
    this.almacen.guardarPerfilPropio(this.id, nuevo, hoy);
    return { guardado: true, perfil: await this.perfil_examen() };
  }

  async calcular_nota({ puntaje, maximo, exigencia } = {}) {
    const { universidad } = await this.ctx();
    const e = Number(exigencia ?? universidad?.perfil.examen?.exigencia ?? 0.6);
    return notaChilena(Number(puntaje), Number(maximo), e);
  }

  // — Fuentes ——————————————————————————————————————————————————————

  async ver_articulo({ norma, articulo } = {}) {
    if (!norma || !articulo) throw new ErrorDeUso('Indica `norma` y `articulo`.');
    const sigla = resolverSigla(norma);
    if (!sigla) throw new ErrorDeUso(`Norma no reconocida: "${norma}". Disponibles: ${Object.entries(NORMAS).map(([s, n]) => `${s} (${n.titulo})`).join('; ')}.`);
    const numero = String(articulo).replace(/^art(í|i)culo\s*|^art\.?\s*/i, '').replace(/[°º]/g, '').trim();
    let r;
    try {
      r = await verArticulo(sigla, numero);
    } catch (e) {
      throw new ErrorDeUso(
        `No pude traer el art. ${numero} desde Ley Chile (${e.message}). Probablemente no hay conexión o el sitio está caído. ` +
          'No lo cites de memoria: dile al estudiante que lo verificarán cuando haya conexión, o que lo revise en bcn.cl/leychile.',
      );
    }
    if (!r.encontrado) return { ...r, mensaje: `No existe el artículo ${numero} en ${r.norma}. No lo cites.` };
    return r;
  }

  async agregar_manual({ ruta, titulo, autor, anio, rama } = {}) {
    if (!ruta || !titulo) throw new ErrorDeUso('Indica `ruta` (PDF) y `titulo`.');
    const abs = await rutaPdf(ruta);
    const { paginas, total, sinTexto } = await extraerPaginas(abs);
    if (sinTexto === total) {
      return { indexado: false, motivo: 'El PDF no tiene texto (parece escaneado). Hay que pasarlo por OCR antes de cargarlo.' };
    }
    const id = this.almacen.agregarManual(this.id, { titulo, autor, anio, rama, ruta: abs, paginas, agregado: this.hoy() });
    return { indexado: true, id, titulo, paginas: total, paginas_sin_texto: sinTexto, ...(sinTexto > total * 0.2 ? { advertencia: `${sinTexto} páginas sin texto (escaneadas): no aparecerán en las búsquedas.` } : {}) };
  }

  async listar_manuales() {
    return { manuales: this.almacen.manuales(this.id) };
  }

  async quitar_manual({ id } = {}) {
    return { quitado: this.almacen.quitarManual(this.id, Number(id)) };
  }

  async buscar_en_manuales({ consulta, rama, limite = 5 } = {}) {
    if (!consulta?.trim()) throw new ErrorDeUso('Indica `consulta`.');
    if (!this.almacen.manuales(this.id).length) {
      return { resultados: [], nota: 'El estudiante no ha cargado manuales. Ofrécele cargar los suyos (PDF) con `agregar_manual`. Sin manual, explica sin atribuir a autores.' };
    }
    const fts = consultaFts(consulta);
    let filas = this.almacen.buscarPasajes(this.id, fts.todas, { rama, limite });
    let modo = 'todas las palabras';
    if (!filas.length && fts.alguna !== fts.todas) {
      filas = this.almacen.buscarPasajes(this.id, fts.alguna, { rama, limite });
      modo = 'alguna palabra (no hubo coincidencia con todas)';
    }
    return {
      coincidencia: modo,
      resultados: filas.map((f) => ({
        cita: `${f.autor ? `${f.autor}, ` : ''}${f.titulo}${f.anio ? ` (${f.anio})` : ''}, p. ${f.pagina}`,
        pagina_pdf: f.pagina,
        extracto: f.extracto,
        contexto: contexto(f.texto_pagina, fts.terminos, 900),
      })),
      nota: 'La página es la del PDF; puede no coincidir con la numeración impresa del libro.',
    };
  }

  async guardar_material({ tema, tipo, titulo, contenido } = {}) {
    if (!tipo || !titulo || !contenido) throw new ErrorDeUso('Indica `tipo`, `titulo` y `contenido`.');
    if (tema) await this.resolverTemas([tema]);
    return { guardado: this.almacen.guardarMaterial(this.id, { tema, tipo, titulo, contenido, creado: this.hoy() }) };
  }

  async ver_material({ tema, id } = {}) {
    return { material: this.almacen.material(this.id, { tema, id: id ? Number(id) : undefined }) };
  }
}

/** Archivos de la skill que componen cada modo de `guia_del_tutor`. */
export const GUIAS = {
  inicio: ['SKILL.md', 'referencias/fuentes.md'],
  diagnostico: ['referencias/modos/diagnostico.md', 'referencias/rubrica.md'],
  clase: ['referencias/modos/clase.md', 'referencias/rubrica.md'],
  repaso: ['referencias/modos/repaso.md', 'referencias/rubrica.md'],
  simulacro: ['referencias/modos/simulacro.md', 'referencias/rubrica.md'],
  plazos: ['referencias/modos/plazos.md'],
  discriminacion: ['referencias/modos/discriminacion.md'],
  exposicion: ['referencias/modos/exposicion.md', 'referencias/rubrica.md'],
  material: ['referencias/modos/material.md'],
  preguntas: ['referencias/modos/preguntas.md', 'referencias/fuentes.md'],
  mi_examen: ['referencias/modos/mi-examen.md'],
  metodologia: ['referencias/metodologia.md'],
};

/** Qué hacer con cada tipo de documento que sube el estudiante. */
export const TIPOS_DOCUMENTO = {
  cedulario:
    'Lee el documento completo (leer_documento). Transcribe cada cédula o tema TAL CUAL (número, título, contenido, exclusiones). ' +
    'Enlaza cada una con los temas del temario (buscar_temario). Muéstrale al estudiante el resultado y, con su visto bueno, guardar_cedulario.',
  temario: 'Igual que un cedulario: transcribe por capítulo o unidad, enlaza con el temario y guarda con guardar_cedulario.',
  reglamento:
    'Extrae modalidad (oral/escrita), partes, duración, comisión, calificación y exigencia, y guárdalo con guardar_perfil_examen (fuente: el reglamento).',
  examen_anterior:
    'Extrae el formato: instrucciones, tiempo, número de casos y preguntas, ponderaciones, tipo de preguntas. Guárdalo con guardar_perfil_examen ' +
    'y úsalo como modelo para los simulacros. No lo uses como simulacro tal cual si el estudiante ya lo conoce.',
  pauta:
    'Extrae cómo se corrige: ítems por pregunta, puntaje o porcentaje por ítem, qué se exige citar, bonus, respuestas alternativas. ' +
    'Guárdalo en formato_pauta con guardar_perfil_examen: las pautas de los simulacros deben seguir ese formato.',
  apuntes: 'Para consultar al preparar clases. Si es material de estudio extenso, conviene cargarlo como manual (agregar_manual) para buscar con cita.',
  otro: 'Léelo con leer_documento y úsalo según lo que el estudiante necesite.',
};

/** Nota chilena 1,0–7,0 con exigencia (60 % por defecto): el 4,0 se alcanza con `exigencia` del puntaje. */
export function notaChilena(puntaje, maximo, exigencia = 0.6) {
  if (!(maximo > 0)) throw new ErrorDeUso('`maximo` debe ser mayor que 0.');
  if (!(puntaje >= 0) || puntaje > maximo) throw new ErrorDeUso('`puntaje` debe estar entre 0 y el máximo.');
  if (!(exigencia > 0 && exigencia < 1)) throw new ErrorDeUso('`exigencia` va entre 0 y 1 (0,6 = 60 %).');
  const corte = exigencia * maximo;
  const nota = puntaje < corte ? 1 + (3 * puntaje) / corte : 4 + (3 * (puntaje - corte)) / (maximo - corte);
  const redondeada = Math.round(nota * 10) / 10;
  return { nota: redondeada, aprobado: redondeada >= 4, puntaje, maximo, exigencia, puntaje_para_el_4: Number(corte.toFixed(2)) };
}

async function rutaExistente(ruta) {
  const abs = resolverRuta(String(ruta).trim().replace(/^["']|["']$/g, '').replace(/^~(?=[\\/]|$)/, homedir()));
  try {
    if (!(await stat(abs)).isFile()) throw new Error();
  } catch {
    throw new ErrorDeUso(`No encuentro el archivo ${abs}. Si el estudiante lo tiene a mano, lo más simple es que lo adjunte en la conversación.`);
  }
  return abs;
}

async function rutaPdf(ruta) {
  const abs = await rutaExistente(ruta);
  if (!/\.pdf$/i.test(abs)) throw new ErrorDeUso('Los manuales se cargan en PDF.');
  return abs;
}

async function rutaDocumento(ruta) {
  const abs = await rutaExistente(ruta);
  if (!/\.(pdf|txt|md)$/i.test(abs)) {
    throw new ErrorDeUso('Por ruta se leen PDF, .txt y .md. Para Word u otros formatos, que el estudiante adjunte el archivo en la conversación: léelo y usa `texto`.');
  }
  return abs;
}

/** Texto largo → "páginas" de ~3.000 caracteres, cortando en párrafos (o en saltos de página si los hay). */
export function partirEnPaginas(texto, largo = 3000) {
  const limpio = String(texto).replace(/\r\n?/g, '\n').trim();
  const bloques = limpio.includes('\f') ? limpio.split('\f') : limpio.split(/\n{2,}/);
  const paginas = [];
  let actual = '';
  for (const b of bloques) {
    if (actual && actual.length + b.length > largo) {
      paginas.push(actual.trim());
      actual = '';
    }
    actual += (actual ? '\n\n' : '') + b;
  }
  if (actual.trim()) paginas.push(actual.trim());
  return paginas.map((t, i) => ({ numero: i + 1, texto: t }));
}

/**
 * Universidad efectiva del estudiante: la oficial (si la hay) con lo que él
 * mismo aportó encima. Lo aportado por el estudiante no se mezcla en silencio:
 * queda marcado, porque no pasó por la revisión del contenido oficial.
 */
export function combinarUniversidad(base, propio, cedulariosPropios, est) {
  const hayPropio = propio || Object.keys(cedulariosPropios ?? {}).length;
  if (!base && !hayPropio) return null;
  const perfilBase = base?.perfil ?? {
    id: est?.universidad ?? 'propia',
    nombre: propio?.universidad_nombre ?? 'Universidad del estudiante',
    sigla: propio?.universidad_nombre ?? 'Tu universidad',
    examen: {},
  };
  const examen = { ...(perfilBase.examen ?? {}) };
  if (propio) {
    if (propio.nombre_examen) examen.nombre = propio.nombre_examen;
    if (propio.modalidad) examen.modalidad = propio.modalidad;
    if (propio.modalidad_por_ramo) examen.modalidad_por_ramo = propio.modalidad_por_ramo;
    if (propio.formato_preguntas) examen.formato_preguntas = propio.formato_preguntas;
    if (propio.exposicion_minutos) examen.exposicion_minutos = propio.exposicion_minutos;
    if (propio.partes) examen.partes = propio.partes;
    if (propio.duracion_minutos) examen.duracion_minutos = propio.duracion_minutos;
    if (propio.instrucciones) examen.instrucciones = propio.instrucciones;
    if (propio.formato_pauta) examen.formato_pauta = propio.formato_pauta;
    if (propio.calificacion) examen.calificacion = propio.calificacion;
    if (propio.exigencia) examen.exigencia = propio.exigencia;
  }
  const perfil = {
    ...perfilBase,
    ...(propio?.universidad_nombre && !base ? { nombre: propio.universidad_nombre, sigla: propio.universidad_nombre } : {}),
    examen,
    ...(propio?.estilo ? { estilo_comision: propio.estilo } : {}),
    ...(propio ? { aportado_por_el_estudiante: { fuentes: propio.fuentes, notas: propio.notas, actualizado: propio.actualizado } } : {}),
  };
  const cedularios = { ...(base?.cedularios ?? {}) };
  const exclusiones = { ...(base?.exclusiones ?? {}) };
  const origen = Object.fromEntries(Object.keys(cedularios).map((r) => [r, 'oficial']));
  for (const [rama, c] of Object.entries(cedulariosPropios ?? {})) {
    cedularios[rama] = c.cedulas;
    delete exclusiones[rama];
    origen[rama] = `subido por el estudiante${c.fuente ? `: ${c.fuente}` : ''}`;
  }
  return { perfil, cedularios, exclusiones, origen_cedulario: origen };
}

/** "Código Civil", "CC", "Ley 19.947", "matrimonio civil" → sigla. */
export function resolverSigla(norma) {
  const n = sinTildes(norma).replace(/[.°º]/g, '').trim();
  const directa = Object.keys(NORMAS).find((s) => s.toLowerCase() === n.replace(/\s+/g, ''));
  if (directa) return directa;
  const alias = [
    [/constituci/, 'CPR'],
    [/procedimiento civil|^cpc$/, 'CPC'],
    [/procesal penal|^cpp$/, 'CPP'],
    [/organico de tribunales|^cot$/, 'COT'],
    [/codigo de comercio|^ccom$/, 'CCOM'],
    [/codigo civil|^cc$/, 'CC'],
    [/19947|matrimonio civil/, 'LMC'],
    [/20830|union civil/, 'L20830'],
    [/19968|tribunales de familia/, 'L19968'],
    [/18120|comparecencia/, 'L18120'],
    [/18101|arrendamiento de predios/, 'L18101'],
    [/18010|operaciones de credito/, 'L18010'],
    [/19496|consumidor/, 'LPC'],
    [/efecto retroactivo/, 'LERL'],
    [/2695|pequena propiedad/, 'DL2695'],
  ];
  return alias.find(([re]) => re.test(n))?.[1] ?? null;
}

/**
 * Consulta FTS5 a partir de texto libre. Se citan los términos para que un
 * guion o un "art." no se lean como operadores de FTS5.
 */
export function consultaFts(texto) {
  const VACIAS = new Set(['el', 'la', 'los', 'las', 'de', 'del', 'que', 'en', 'y', 'o', 'un', 'una', 'por', 'con', 'para', 'se', 'su', 'al', 'lo', 'es', 'como', 'a']);
  const frases = [...String(texto).matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  const suelto = String(texto).replace(/"[^"]*"/g, ' ');
  const terminos = sinTildes(suelto).split(/[^a-z0-9ñ]+/).filter((t) => t.length > 1 && !VACIAS.has(t));
  const partes = [...frases.map((f) => `"${f.replace(/"/g, '')}"`), ...terminos.map((t) => `"${t}"*`)];
  if (!partes.length) throw new ErrorDeUso('La consulta no tiene palabras buscables.');
  return { todas: partes.join(' AND '), alguna: partes.join(' OR '), terminos: [...frases, ...terminos] };
}

/** Recorta la página alrededor de la primera coincidencia. */
function contexto(texto, terminos, largo) {
  const plano = String(texto).replace(/\s+/g, ' ');
  const norm = sinTildes(plano);
  let pos = -1;
  for (const t of terminos) {
    pos = norm.indexOf(sinTildes(t));
    if (pos >= 0) break;
  }
  const inicio = Math.max(0, (pos < 0 ? 0 : pos) - Math.floor(largo / 3));
  return (inicio > 0 ? '… ' : '') + plano.slice(inicio, inicio + largo) + (inicio + largo < plano.length ? ' …' : '');
}
