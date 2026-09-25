import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Almacen } from '../src/almacen.mjs';
import { Tutor, ErrorDeUso, consultaFts, resolverSigla } from '../src/herramientas.mjs';
import { cargarTemario, cargarUniversidades, validar } from '../src/datos.mjs';
import { pdfConTexto } from './pdf-prueba.mjs';

let hoy = '2026-10-01';
const nuevoTutor = () => new Tutor({ almacen: new Almacen(':memory:'), estudiante: 'prueba', hoy: () => hoy });

test('el contenido (temario, cedularios y mapas) es consistente', async () => {
  const errores = validar(await cargarTemario(), await cargarUniversidades());
  assert.deepEqual(errores, []);
});

test('flujo completo: configurar, sesión, clase, registro, índice, simulacro', async () => {
  hoy = '2026-10-01';
  const t = nuevoTutor();

  const inicial = await t.estado_estudiante();
  assert.equal(inicial.configurado, false);

  await assert.rejects(() => t.configurar_estudiante({ universidad: 'inexistente' }), ErrorDeUso);
  await assert.rejects(() => t.configurar_estudiante({ fecha_examen: '2020-01-01' }), ErrorDeUso);
  await t.configurar_estudiante({ universidad: 'uchile', fecha_examen: '2027-03-15', horas_semana: 15 });

  const estado = await t.estado_estudiante();
  assert.equal(estado.configurado, true);
  assert.equal(estado.plan.fase, 'Primera pasada');
  const nuevos = estado.sesion_de_hoy.temas_nuevos;
  assert.ok(nuevos.length >= 2);
  assert.equal(nuevos[0].id, 'civil.fuentes.derecho_privado'); // la cédula 1 de Civil
  assert.ok(nuevos.some((n) => n.rama === 'procesal'), 'intercala Procesal desde el primer día');

  // El estudiante elige una cédula: pasa primero aunque no siga el orden del plan.
  const eleccion = await t.elegir_temas({ agregar: ['civil:40'] });
  assert.match(eleccion.elegidos[0], /civil\.acto\.nulidad_relativa/);
  const sesion = await t.sesion_de_hoy();
  assert.equal(sesion.temas_nuevos[0].id, 'civil.acto.nulidad_relativa');
  assert.equal(sesion.temas_nuevos[0].elegido_por_ti, true);

  // Ver la cédula trae su contenido literal del cedulario y las normas.
  const ficha = await t.ver_tema({ cedula: 40, rama: 'civil' });
  assert.equal(ficha.cedula.tema, 'Nulidad relativa');
  assert.match(ficha.cedula.contenido, /Saneamiento/);
  assert.ok(ficha.temas[0].normas.some((n) => n.referencia.startsWith('CC 1684')));
  assert.equal(ficha.temas[0].requiere[0].id, 'civil.acto.elementos');

  // Registrar una respuesta con error.
  const r = await t.registrar_respuesta({ tema: 'civil.acto.nulidad_relativa', calificacion: 1, modo: 'clase', pregunta: '¿Quién puede alegarla?', error: 'Cree que el juez puede declararla de oficio' });
  assert.equal(r.proximo_repaso, '2026-10-02');
  assert.match(r.dominio, /débil/);
  await assert.rejects(() => t.registrar_respuesta({ tema: 'civil:40', calificacion: 3 }), ErrorDeUso);
  await assert.rejects(() => t.registrar_respuesta({ tema: 'civil.acto.nulidad_relativa', calificacion: 5 }), ErrorDeUso);

  const despues = await t.ver_tema({ tema: 'civil.acto.nulidad_relativa' });
  assert.equal(despues.temas[0].errores_anteriores[0].error, 'Cree que el juez puede declararla de oficio');

  // Mismo día, acierto: no borra el "débil" de la mañana.
  await t.registrar_respuesta({ tema: 'civil.acto.nulidad_relativa', calificacion: 4 });
  assert.match((await t.ver_tema({ tema: 'civil.acto.nulidad_relativa' })).temas[0].tu_estado.dominio, /débil/);

  // El índice refleja el estado y la selección.
  const indice = await t.ver_indice({ rama: 'civil' });
  const linea = indice.cedulas.find((l) => l.includes('40. Nulidad relativa'));
  assert.ok(linea.startsWith('🔴') && linea.includes('⭐'), linea);
  const resumen = await t.ver_indice();
  assert.ok(resumen.ramas.civil.length > 5 && resumen.ramas.procesal.length > 5);

  // Al día siguiente, el tema fallado aparece como repaso.
  hoy = '2026-10-02';
  const manana = await t.sesion_de_hoy();
  assert.equal(manana.repasos[0].id, 'civil.acto.nulidad_relativa');
  assert.equal((await t.estado_estudiante()).racha_dias, 1);

  // Simulacro: sortea una cédula por ramo y registra por tema.
  const s = await t.sortear_cedula();
  assert.deepEqual(s.sorteo.map((x) => x.rama), ['civil', 'procesal']);
  assert.ok(s.sorteo.every((x) => x.cedula && x.temas.length));
  const sim = await t.registrar_simulacro({
    nota: 4.8,
    cedulas: s.sorteo.map((x) => `${x.rama}:${x.cedula}`),
    temas_evaluados: [{ tema: s.sorteo[0].temas[0], calificacion: 3 }, { tema: s.sorteo[1].temas[0], calificacion: 2, error: 'omitió los efectos' }],
  });
  assert.equal(sim.temas_actualizados.length, 2);
  assert.equal(sim.historial_notas[0].nota, 4.8);

  const prog = await t.progreso();
  assert.equal(prog.simulacros.length, 1);
  assert.ok(prog.errores_recientes.length >= 1);
});

test('sin tiempo suficiente, el plan lo advierte con números', async () => {
  hoy = '2026-10-01';
  const t = nuevoTutor();
  await t.configurar_estudiante({ universidad: 'uchile', fecha_examen: '2026-10-20', horas_semana: 3 });
  const plan = await t.plan_estudio();
  assert.ok(plan.advertencia && /temas nuevos por día/.test(plan.advertencia), plan.advertencia);
});

test('buscar_temario encuentra temas y cédulas con o sin tildes', async () => {
  const t = nuevoTutor();
  await t.configurar_estudiante({ universidad: 'uchile' });
  const r = await t.buscar_temario({ texto: 'lesion enorme' });
  assert.equal(r.temas[0].id, 'civil.contratos_esp.lesion');
  assert.ok(r.cedulas.some((c) => c.ref === 'civil:146'));
});

test('manuales: se indexan y se buscan con cita de página', async () => {
  const t = nuevoTutor();
  assert.match((await t.buscar_en_manuales({ consulta: 'nulidad' })).nota, /no ha cargado manuales/);
  const dir = mkdtempSync(join(tmpdir(), 'eg-'));
  const ruta = join(dir, 'manual.pdf');
  writeFileSync(ruta, pdfConTexto(['Capitulo I. Generalidades', 'La nulidad relativa puede alegarse solo por aquellos\nen cuyo beneficio la han establecido las leyes.', 'La prescripcion extintiva']));
  const m = await t.agregar_manual({ ruta, titulo: 'Manual de prueba', autor: 'Autora Ficticia', anio: '2020', rama: 'civil' });
  assert.equal(m.indexado, true);
  assert.equal(m.paginas, 3);
  const r = await t.buscar_en_manuales({ consulta: 'nulidad relativa beneficio' });
  assert.equal(r.resultados[0].pagina_pdf, 2);
  assert.equal(r.resultados[0].cita, 'Autora Ficticia, Manual de prueba (2020), p. 2');
  // Con tildes en la consulta y sin tildes en el texto (remove_diacritics).
  assert.equal((await t.buscar_en_manuales({ consulta: 'prescripción' })).resultados[0].pagina_pdf, 3);
});

test('consultaFts escapa operadores y respeta frases', () => {
  const q = consultaFts('"cosa juzgada" art. 177 -NOT');
  assert.equal(q.todas, '"cosa juzgada" AND "art"* AND "177"* AND "not"*');
});

test('resolverSigla entiende nombres y siglas', () => {
  assert.equal(resolverSigla('Código Civil'), 'CC');
  assert.equal(resolverSigla('cpc'), 'CPC');
  assert.equal(resolverSigla('Ley 19.947'), 'LMC');
  assert.equal(resolverSigla('Constitución Política'), 'CPR');
  assert.equal(resolverSigla('Código Penal'), null);
});

test('UDP: examen escrito, sorteo de temas para un caso y cursos con conteo en el índice', async () => {
  hoy = '2026-10-01';
  const t = nuevoTutor();
  await t.configurar_estudiante({ universidad: 'udp', fecha_examen: '2027-01-15', horas_semana: 20 });
  const perfil = await t.perfil_examen();
  assert.equal(perfil.examen.modalidad, 'escrita');
  const s = await t.sortear_cedula();
  for (const x of s.sorteo) {
    assert.equal(x.temas.length, 3);
    assert.equal(new Set(x.temas).size, 3);
  }
  const indice = await t.ver_indice({ rama: 'procesal' });
  assert.ok(indice.cedulas.some((l) => /Procedimientos especiales — 0\/\d+ temas vistos/.test(l)), indice.cedulas.join('\n'));
  // El proceso penal no está en el cedulario de la UDP: no aparece en la sesión.
  const sesion = await t.sesion_de_hoy({ minutos: 600 });
  assert.ok(sesion.temas_nuevos.every((n) => !n.id.startsWith('procesal.penal')));
  const ced = await t.ver_tema({ cedula: 4, rama: 'procesal' });
  assert.match(ced.cedula.excluidas, /no hacer/);
  assert.match(ced.cedula.bibliografia_recomendada, /Espinosa/);
});
