import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Almacen } from '../src/almacen.mjs';
import { Tutor } from '../src/herramientas.mjs';
import { puntosDeCedula, guionDeExposicion, tarjetasDeTexto, textoAnki, calendarioIcs, elegirPonderado } from '../src/didactica.mjs';

const hoy = '2026-10-01';
const nuevoTutor = () => new Tutor({ almacen: new Almacen(':memory:'), estudiante: 'prueba', hoy: () => hoy });

test('puntos de una cédula: ítems numerados, con líneas cortadas unidas', () => {
  const p = puntosDeCedula('1. Concepto e importancia.\n2. Requisitos de existencia y de validez del acto\njurídico.\na) Voluntad', 'Acto');
  assert.deepEqual(p, ['Concepto e importancia.', 'Requisitos de existencia y de validez del acto jurídico.', 'Voluntad']);
  // Sin ítems, se parte en oraciones.
  assert.deepEqual(puntosDeCedula('La posesión. Concepto y elementos. Clases de posesión.'), ['La posesión.', 'Concepto y elementos.', 'Clases de posesión.']);
  const g = guionDeExposicion(['a', 'b', 'c'], 8);
  assert.equal(g.total, '8:00');
  assert.equal(g.bloques[0].parte, 'Apertura');
  assert.equal(g.bloques.at(-1).parte, 'Cierre');
  assert.equal(g.bloques.length, 5);
});

test('tarjetas "P:/R:" y archivo para Anki', () => {
  const t = tarjetasDeTexto('P: ¿Plazo de la nulidad relativa?\nR: 4 años.\nDesde la celebración.\n\nPregunta: ¿Quién alega la absoluta?\nRespuesta: Todo el que tenga interés.');
  assert.equal(t.length, 2);
  assert.equal(t[0].reverso, '4 años.\nDesde la celebración.');
  const txt = textoAnki([{ ...t[0], etiquetas: ['civil'] }]);
  assert.match(txt, /^#separator:tab/);
  assert.match(txt, /4 años\.<br>Desde la celebración\.\tcivil/);
});

test('calendario .ics: sesiones en días de estudio y el examen', () => {
  const fases = [
    { id: 'primera_pasada', nombre: 'Primera pasada', desde: '2026-10-01', hasta: '2026-10-10', proposito: 'x' },
    { id: 'simulacros', nombre: 'Simulacros', desde: '2026-10-10', hasta: '2026-10-15', proposito: 'y' },
  ];
  const c = calendarioIcs({ hoy: '2026-10-01', fechaExamen: '2026-10-15', fases, minutos: 90, diasSemana: 5, hora: '08:30' });
  // 1-oct-2026 es jueves: jue, vie, (sáb y dom no), lun… hasta el 14.
  assert.equal(c.sesiones, 10);
  assert.ok(c.simulacros >= 1);
  assert.match(c.ics, /DTSTART:20261001T083000/);
  assert.match(c.ics, /DTEND:20261001T100000/);
  assert.match(c.ics, /DTSTART;VALUE=DATE:20261015/);
  assert.equal(calendarioIcs({ hoy: '2026-10-01', fechaExamen: '2026-09-01', fases, minutos: 60 }), null);
});

test('elegirPonderado no repite y respeta el tope', () => {
  const r = elegirPonderado([1, 2, 3], 5, () => 1);
  assert.equal(r.length, 3);
  assert.equal(new Set(r).size, 3);
});

test('práctica de plazos y de discriminación, dentro del alcance del estudiante', async () => {
  const t = nuevoTutor();
  await t.configurar_estudiante({ universidad: 'uchile' });
  const p = await t.practicar_plazos({ rama: 'procesal', cantidad: 4 });
  assert.equal(p.preguntas.length, 4);
  for (const q of p.preguntas) assert.ok(q.tema.startsWith('procesal.') && q.respuesta && q.fundamento);
  const solo = await t.practicar_plazos({ tema: 'civil.acto.nulidad_relativa' });
  assert.equal(solo.preguntas.length, 1);
  assert.match(solo.preguntas[0].respuesta, /4 años/);
  const d = await t.practicar_discriminacion({ tema: 'civil.acto.nulidad_absoluta', cantidad: 2 });
  assert.ok(d.pares.length >= 1 && d.pares.every((x) => x.comparar_por.length && x.temas.length));
  const v = await t.ver_tema({ tema: 'procesal.recursos.apelacion' });
  assert.ok(v.temas[0].plazos.some((x) => /5 días/.test(x.respuesta)));
  assert.ok(v.temas[0].se_confunde_con.some((x) => /casación/i.test(x.par)));
});

test('exposición de una cédula con su guion y rúbrica', async () => {
  const t = nuevoTutor();
  await t.configurar_estudiante({ universidad: 'udla' });
  const e = await t.preparar_exposicion({ rama: 'civil', numero: 12, minutos: 7 });
  assert.equal(e.minutos, 7);
  assert.ok(e.debe_cubrir.some((x) => /Saneamiento de la nulidad/.test(x)));
  assert.equal(e.guion.total, '7:00');
  assert.ok(e.temas.some((x) => x.id === 'civil.acto.nulidad_absoluta'));
});

test('diagnóstico: lo que no sabe queda como foco y no como visto', async () => {
  const t = nuevoTutor();
  await t.configurar_estudiante({ universidad: 'puc', fecha_examen: '2027-01-15' });
  const d = await t.diagnostico({ cantidad: 6 });
  assert.equal(d.temas.length, 6);
  assert.ok(d.temas.some((x) => x.id.startsWith('civil.')) && d.temas.some((x) => x.id.startsWith('procesal.')));
  const [a, b] = d.temas;
  const r1 = await t.registrar_respuesta({ tema: a.id, calificacion: 1, modo: 'diagnostico', confianza: 'alta' });
  assert.match(r1.diagnostico, /foco/);
  assert.ok(r1.error_de_alta_confianza);
  await t.registrar_respuesta({ tema: b.id, calificacion: 4, modo: 'diagnostico', confianza: 'alta' });
  const s = await t.sesion_de_hoy({ minutos: 120 });
  assert.equal(s.temas_nuevos[0].id, a.id, 'lo fallado en el diagnóstico se enseña primero');
  assert.ok(!s.temas_nuevos.some((x) => x.id === b.id), 'lo dominado no vuelve como nuevo');
});

test('confianza: acierto dudoso se programa como difícil; la calibración se reporta', async () => {
  const t = nuevoTutor();
  await t.configurar_estudiante({ universidad: 'uchile', fecha_examen: '2027-01-15' });
  const r = await t.registrar_respuesta({ tema: 'civil.acto.error', calificacion: 3, confianza: 'baja' });
  assert.match(r.calificacion, /^2/);
  assert.ok(r.ajuste);
  await t.registrar_respuesta({ tema: 'civil.acto.dolo', calificacion: 1, confianza: 'alta' });
  await t.registrar_respuesta({ tema: 'civil.acto.fuerza', calificacion: 3, confianza: 'alta' });
  const p = await t.progreso();
  assert.equal(p.calibracion.por_confianza.alta.respuestas, 2);
  assert.equal(p.calibracion.por_confianza.alta.aciertos, '50%');
  assert.match(p.calibracion.lectura, /Sobreconfianza/);
});

test('exportar: tarjetas para Anki y calendario del plan', async () => {
  process.env.EXAMEN_GRADO_DIR = mkdtempSync(join(tmpdir(), 'eg-exp-'));
  const t = nuevoTutor();
  await t.configurar_estudiante({ universidad: 'uai', fecha_examen: '2026-11-30', horas_semana: 12, dias_semana: 6 });
  await t.guardar_material({ tema: 'civil.acto.nulidad_relativa', tipo: 'tarjetas', titulo: 'Nulidad', contenido: 'P: ¿Plazo?\nR: 4 años.' });
  const a = await t.exportar({ formato: 'anki' });
  assert.equal(a.de_tu_material, 1);
  assert.ok(a.plazos > 5);
  const txt = readFileSync(a.archivo, 'utf8');
  assert.match(txt, /¿Plazo\?\t4 años\.\texamen-grado civil civil::acto::nulidad_relativa/);
  assert.ok(!/cpp|Código Procesal Penal/.test(txt), 'la UAI excluye el proceso penal: sus plazos no se exportan');
  const c = await t.exportar({ formato: 'calendario', hora: '07:30' });
  assert.ok(c.sesiones > 40);
  assert.match(readFileSync(c.archivo, 'utf8'), /BEGIN:VCALENDAR/);
});

test('guía del tutor: el método llega por el servidor aunque no esté la skill', async () => {
  const t = nuevoTutor();
  const g = await t.guia_del_tutor({ modo: 'clase' });
  assert.match(g.metodo, /Modo clase/);
  assert.match(g.metodo, /Rúbrica|rúbrica|Calificación|calificación/);
  const inicio = await t.guia_del_tutor();
  assert.match(inicio.metodo, /Reglas que no se rompen/);
  assert.doesNotMatch(inicio.metodo, /^---/m, 'sin el encabezado YAML de la skill');
  await assert.rejects(t.guia_del_tutor({ modo: 'inexistente' }));
});

test('documento adjunto en la conversación: se guarda por texto y se lee por páginas', async () => {
  const t = nuevoTutor();
  await t.configurar_estudiante({ universidad: 'otra' });
  const largo = Array.from({ length: 12 }, (_, i) => `CÉDULA ${i + 1}\n${'Contenido de la cédula. '.repeat(40)}`).join('\n\n');
  const r = await t.cargar_documento({ texto: largo, tipo: 'cedulario', titulo: 'Cedulario Civil 2026', rama: 'civil' });
  assert.equal(r.cargado, true);
  assert.ok(r.paginas >= 3);
  const l = await t.leer_documento({ id: r.id });
  assert.match(l.paginas[0].texto, /^CÉDULA 1/);
  await assert.rejects(t.cargar_documento({ texto: 'algo', tipo: 'cedulario' }), /titulo/);
  await assert.rejects(t.cargar_documento({ ruta: '/no/existe.docx', tipo: 'cedulario' }), /adjunte/);
});

test('perfil propio con selección múltiple: el simulacro se arma con alternativas', async () => {
  const t = nuevoTutor();
  await t.configurar_estudiante({ universidad: 'otra' });
  await t.guardar_perfil_examen({ universidad_nombre: 'U. Ejemplo', modalidad: 'escrita', formato_preguntas: 'seleccion_multiple', fuente: 'lo que contó el estudiante' });
  const s = await t.sortear_cedula({});
  assert.ok(s.sorteo.every((x) => x.modalidad === 'seleccion_multiple'));
  await assert.rejects(t.guardar_perfil_examen({ formato_preguntas: 'oral', fuente: 'x' }));
});

test('índice sin raya colgando y simulacro que no queda a medias', async () => {
  const t = nuevoTutor();
  await t.configurar_estudiante({ universidad: 'ucentral' });
  const i = await t.ver_indice({ rama: 'civil' });
  assert.ok(i.cedulas.some((l) => l === '## Cedulario de Derecho Civil 2025'));
  assert.ok(!i.cedulas.some((l) => / — $/.test(l)));
  await assert.rejects(t.registrar_simulacro({ nota: 5, temas_evaluados: [{ tema: 'civil.acto.error', calificacion: 3 }, { tema: 'civil.acto.dolo', calificacion: 9 }] }));
  assert.equal((await t.progreso()).simulacros.length, 0, 'no se guardó nada');
});

test('plazos: primero los de temas ya vistos', async () => {
  const t = nuevoTutor();
  await t.configurar_estudiante({ universidad: 'uchile' });
  for (const tema of ['procesal.recursos.apelacion', 'procesal.ordinario.discusion', 'civil.acto.nulidad_relativa']) await t.registrar_respuesta({ tema, calificacion: 3 });
  const p = await t.practicar_plazos({ cantidad: 3 });
  assert.ok(p.preguntas.every((x) => x.tema_visto));
  const mas = await t.practicar_plazos({ cantidad: 6 });
  assert.equal(mas.preguntas.filter((x) => x.tema_visto).length, 3, 'los vistos primero, el resto se completa con temas nuevos');
});

test('respaldo: copia completa del progreso', async () => {
  process.env.EXAMEN_GRADO_DIR = mkdtempSync(join(tmpdir(), 'eg-resp-'));
  const t = nuevoTutor();
  await t.configurar_estudiante({ universidad: 'puc' });
  await t.registrar_respuesta({ tema: 'civil.acto.error', calificacion: 3 });
  const r = await t.exportar({ formato: 'respaldo' });
  const copia = new Almacen(r.archivo);
  assert.equal(copia.progreso('prueba').size, 1);
  copia.cerrar();
});
