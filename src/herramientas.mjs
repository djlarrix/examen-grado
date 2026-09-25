/**
 * Las herramientas del tutor. Cada una devuelve datos; la pedagogía (cómo
 * enseñar con ellos) está en la skill y en las instrucciones del servidor.
 *
 * Ninguna herramienta devuelve contenido jurídico "de memoria": el texto de
 * las normas viene de Ley Chile y el de la doctrina, de los manuales que el
 * propio estudiante cargó, con página.
 */
import { resolve as resolverRuta } from 'node:path';
import { stat } from 'node:fs/promises';
import { contenido } from './datos.mjs';
import { Almacen } from './almacen.mjs';
import { programar, dominio, DOMINIOS, recuperabilidadHoy, CALIFICACIONES, diasEntre } from './repaso.mjs';
import { alcance, planGeneral, sesionDeHoy } from './plan.mjs';
import { NORMAS, parsearReferencia, citaLegible } from './fuentes/normas.mjs';
import { verArticulo } from './fuentes/leychile.mjs';
import { extraerPaginas } from './lib/pdf.mjs';
import { hoyEnChile, normalizarFecha } from './lib/fecha.mjs';

const ORDEN_DOMINIO = ['sin_ver', 'debil', 'aprendiendo', 'consolidando', 'dominado'];
const icono = (d) => DOMINIOS[d].icono;

const sinTildes = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

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
    const { temario, universidades } = await contenido();
    const est = this.almacen.estudiante(this.id);
    const universidad = est?.universidad ? universidades.get(est.universidad) ?? null : null;
    return { temario, universidades, est, universidad, hoy: this.hoy() };
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
        'Si la universidad del estudiante no está, configura universidad "otra": se usa el temario ' +
        'completo y el estudiante describe su examen en `notas`. Pídele su cedulario para sumarlo.',
    };
  }

  async perfil_examen({ universidad } = {}) {
    const { universidades, est } = await this.ctx();
    const id = universidad ?? est?.universidad;
    if (!id) throw new ErrorDeUso('Indica la universidad o configura primero al estudiante.');
    const u = universidades.get(id);
    if (!u) return { universidad: id, conocida: false, nota: 'Universidad sin perfil. Usa lo que el estudiante cuente de su examen (guardado en `notas`).', notas_estudiante: est?.notas ?? null };
    const { cedulario, ...perfil } = u.perfil;
    return { ...perfil, cedulario: Object.fromEntries(Object.entries(u.cedularios).map(([r, c]) => [r, `${c.length} cédulas`])), electivas: cedulario?.electivas };
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
          '`configurar_estudiante`. Si no sabe la fecha, se puede configurar después.',
        universidades_disponibles: (await this.listar_universidades()).universidades.map((u) => `${u.id} (${u.nombre})`),
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
    const { temario, est, universidad, hoy } = await this.ctx();
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
        const cab = `${c.seccion} — ${c.subseccion}`;
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
        lineas.push(`${icono(this.dominioDe(c.temas, progreso, hoy))} ${c.numero}. ${c.tema}${detalle}${estrella}`);
      }
      return { leyenda, vista: `cedulario ${universidad.perfil.sigla} — ${rama}`, cedulas: lineas, como_elegir: `Para estudiar una cédula: elegir_temas con "${rama}:<número>". Para ver su contenido: ver_tema con cedula y rama.` };
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
      const unidad = temario.ramas[r.split('.')[0]]?.unidades.find((u) => u.id === r);
      if (unidad) {
        out.push(...unidad.temas);
        continue;
      }
      throw new ErrorDeUso(`No reconozco "${r}". Usa un id de tema (civil.acto.nulidad_relativa), una cédula ("civil:40") o una unidad ("civil.bienes"). Busca con buscar_temario.`);
    }
    return [...new Set(out)];
  }

  async ver_tema({ tema, cedula, rama } = {}) {
    const { temario, universidad, hoy } = await this.ctx();
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
              seccion: `${ced.seccion} — ${ced.subseccion}`,
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

  async registrar_respuesta({ tema, calificacion, modo, pregunta, error } = {}) {
    const { temario, est, hoy } = await this.ctx();
    if (!temario.temas.has(tema)) throw new ErrorDeUso(`Tema desconocido "${tema}". Registra por id de tema (una cédula puede abarcar varios; usa ver_tema para ver cuáles).`);
    const g = Number(calificacion);
    if (![1, 2, 3, 4].includes(g)) throw new ErrorDeUso('calificacion: 1 (otra vez), 2 (difícil), 3 (bien) o 4 (fácil).');
    const previo = this.almacen.estadoTema(this.id, tema);
    let nuevo = programar(previo, g, hoy, { fechaExamen: est?.fecha_examen });
    // Dos recuperaciones el mismo día no son dos repasos espaciados. FSRS ya no
    // sube la estabilidad con 0 días transcurridos, pero la calificación que
    // cuenta para el dominio es la peor del día: si falló en la mañana, un
    // acierto en la tarde (con la respuesta fresca) no lo saca de "débil".
    if (previo?.ultimo_repaso === hoy) nuevo = { ...nuevo, ultima_calificacion: Math.min(previo.ultima_calificacion, g) };
    this.almacen.transaccion(() => {
      this.almacen.guardarEstado(this.id, tema, nuevo);
      this.almacen.registrarRespuesta(this.id, { tema, fecha: hoy, calificacion: g, modo, pregunta, error });
    });
    const d = dominio(nuevo, hoy);
    return {
      tema: temario.temas.get(tema).titulo,
      calificacion: `${g} (${CALIFICACIONES[g]})`,
      dominio: `${icono(d)} ${DOMINIOS[d].nombre}`,
      proximo_repaso: nuevo.proximo,
      en_dias: diasEntre(hoy, nuevo.proximo),
      ...(error ? { error_anotado: true } : {}),
    };
  }

  async sortear_cedula({ rama, numero, prioridad = 'azar' } = {}) {
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
    const pesoTemas = (ts) => Math.max(...ts.map((t) => ({ sin_ver: 2, debil: 4, aprendiendo: 3, consolidando: 1.5, dominado: 1 })[dominio(progreso.get(t), hoy)]));
    const escrita = universidad?.perfil.examen?.modalidad === 'escrita';
    const sorteo = ramas.map((r) => {
      const cedulas = universidad?.cedularios[r];
      if (cedulas?.length) {
        const c = numero !== undefined ? cedulas.find((x) => x.numero === Number(numero)) : elegir(cedulas, (x) => pesoTemas(x.temas));
        if (!c) throw new ErrorDeUso(`No existe la cédula ${numero} de ${r}.`);
        if (escrita && c.temas.length > 3) {
          // Examen escrito sobre un caso: el caso cruza unos pocos temas del
          // curso, no el curso entero. Se sortean tres para construirlo.
          const pool = [...c.temas];
          const temas = [];
          while (temas.length < 3 && pool.length) {
            const t = elegir(pool, (x) => pesoTemas([x]));
            temas.push(t);
            pool.splice(pool.indexOf(t), 1);
          }
          return { rama: r, cedula: c.numero, tema: c.tema, temas, temas_titulos: temas.map((t) => temario.temas.get(t).titulo), para: 'construir un caso que cruce estos temas' };
        }
        return { rama: r, cedula: c.numero, tema: c.tema, contenido: c.contenido || '(sin desglose en el cedulario)', temas: c.temas };
      }
      const ids = alcance(temario, universidad)[r];
      const id = elegir(ids, (t) => pesoTemas([t]));
      return { rama: r, cedula: null, tema: temario.temas.get(id).titulo, temas: [id] };
    });
    return {
      universidad: universidad?.perfil.sigla ?? 'sin perfil',
      modalidad: universidad?.perfil.examen?.modalidad ?? 'desconocida',
      prioridad,
      sorteo,
      como_seguir: 'Simula la comisión según `perfil_examen` (estilo_comision). Al terminar, `registrar_simulacro` con una calificación por cada tema evaluado.',
    };
  }

  async registrar_simulacro({ nota, cedulas, rubrica, fortalezas, a_mejorar, temas_evaluados = [] } = {}) {
    const { temario, est, hoy } = await this.ctx();
    if (nota !== undefined && !(nota >= 1 && nota <= 7)) throw new ErrorDeUso('La nota va de 1,0 a 7,0.');
    for (const te of temas_evaluados) if (!temario.temas.has(te.tema)) throw new ErrorDeUso(`Tema desconocido en temas_evaluados: ${te.tema}`);
    const id = this.almacen.guardarSimulacro(this.id, { fecha: hoy, universidad: est?.universidad, cedulas, nota, rubrica, fortalezas, a_mejorar });
    const actualizados = [];
    for (const te of temas_evaluados) {
      actualizados.push(await this.registrar_respuesta({ tema: te.tema, calificacion: te.calificacion, modo: 'simulacro', pregunta: te.pregunta, error: te.error }));
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
    };
  }

  // — Fuentes ——————————————————————————————————————————————————————

  async ver_articulo({ norma, articulo } = {}) {
    if (!norma || !articulo) throw new ErrorDeUso('Indica `norma` y `articulo`.');
    const sigla = resolverSigla(norma);
    if (!sigla) throw new ErrorDeUso(`Norma no reconocida: "${norma}". Disponibles: ${Object.entries(NORMAS).map(([s, n]) => `${s} (${n.titulo})`).join('; ')}.`);
    const numero = String(articulo).replace(/^art(í|i)culo\s*|^art\.?\s*/i, '').replace(/[°º]/g, '').trim();
    const r = await verArticulo(sigla, numero);
    if (!r.encontrado) return { ...r, mensaje: `No existe el artículo ${numero} en ${r.norma}. No lo cites.` };
    return r;
  }

  async agregar_manual({ ruta, titulo, autor, anio, rama } = {}) {
    if (!ruta || !titulo) throw new ErrorDeUso('Indica `ruta` (PDF) y `titulo`.');
    const abs = resolverRuta(ruta.replace(/^~(?=\/|$)/, process.env.HOME ?? ''));
    try {
      if (!(await stat(abs)).isFile()) throw new Error();
    } catch {
      throw new ErrorDeUso(`No encuentro el archivo ${abs}.`);
    }
    if (!/\.pdf$/i.test(abs)) throw new ErrorDeUso('Por ahora sólo se indexan PDF.');
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
