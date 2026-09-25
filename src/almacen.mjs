/**
 * Persistencia local en SQLite (node:sqlite, incluido en Node ≥ 22.13: nada
 * que compilar en la máquina del estudiante).
 *
 * Todo lleva `estudiante` aunque hoy la instalación típica tiene uno solo: el
 * mismo esquema sirve cuando el servidor corra remoto para muchos estudiantes.
 */
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { directorioDatos } from './lib/rutas.mjs';

const ESQUEMA = `
CREATE TABLE IF NOT EXISTS estudiantes (
  id TEXT PRIMARY KEY,
  nombre TEXT,
  universidad TEXT,
  fecha_examen TEXT,
  horas_semana REAL,
  dias_semana INTEGER DEFAULT 6,
  inicio TEXT NOT NULL,
  notas TEXT,
  actualizado TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS progreso (
  estudiante TEXT NOT NULL,
  tema TEXT NOT NULL,
  estabilidad REAL NOT NULL,
  dificultad REAL NOT NULL,
  ultimo_repaso TEXT NOT NULL,
  proximo TEXT NOT NULL,
  repasos INTEGER NOT NULL,
  lapsos INTEGER NOT NULL,
  ultima_calificacion INTEGER NOT NULL,
  PRIMARY KEY (estudiante, tema)
);
CREATE TABLE IF NOT EXISTS respuestas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  estudiante TEXT NOT NULL,
  tema TEXT NOT NULL,
  fecha TEXT NOT NULL,
  calificacion INTEGER NOT NULL,
  modo TEXT,
  pregunta TEXT,
  error TEXT
);
CREATE INDEX IF NOT EXISTS respuestas_tema ON respuestas (estudiante, tema);
CREATE TABLE IF NOT EXISTS foco (
  estudiante TEXT NOT NULL,
  tema TEXT NOT NULL,
  agregado TEXT NOT NULL,
  PRIMARY KEY (estudiante, tema)
);
CREATE TABLE IF NOT EXISTS simulacros (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  estudiante TEXT NOT NULL,
  fecha TEXT NOT NULL,
  universidad TEXT,
  cedulas TEXT,
  nota REAL,
  rubrica TEXT,
  fortalezas TEXT,
  a_mejorar TEXT
);
CREATE TABLE IF NOT EXISTS material (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  estudiante TEXT NOT NULL,
  tema TEXT,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  contenido TEXT NOT NULL,
  creado TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS manuales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  estudiante TEXT NOT NULL,
  titulo TEXT NOT NULL,
  autor TEXT,
  anio TEXT,
  rama TEXT,
  ruta TEXT NOT NULL,
  paginas INTEGER NOT NULL,
  agregado TEXT NOT NULL
);
CREATE VIRTUAL TABLE IF NOT EXISTS pasajes USING fts5(
  texto,
  manual UNINDEXED,
  pagina UNINDEXED,
  tokenize = 'unicode61 remove_diacritics 2'
);
`;

export class Almacen {
  /** @param {string} [ruta] ':memory:' en pruebas */
  constructor(ruta) {
    if (!ruta) {
      mkdirSync(directorioDatos(), { recursive: true });
      ruta = join(directorioDatos(), 'estudio.sqlite');
    }
    this.db = new DatabaseSync(ruta);
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    this.db.exec(ESQUEMA);
  }

  cerrar() {
    this.db.close();
  }

  /** Ejecuta `fn` en una transacción: o se guarda todo o nada. */
  transaccion(fn) {
    this.db.exec('BEGIN');
    try {
      const r = fn();
      this.db.exec('COMMIT');
      return r;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }

  // — Estudiante ————————————————————————————————————————————————

  estudiante(id) {
    return this.db.prepare('SELECT * FROM estudiantes WHERE id = ?').get(id) ?? null;
  }

  guardarEstudiante(id, datos, hoy) {
    const previo = this.estudiante(id);
    const e = {
      nombre: null,
      universidad: null,
      fecha_examen: null,
      horas_semana: null,
      dias_semana: 6,
      notas: null,
      ...(previo ?? {}),
      ...Object.fromEntries(Object.entries(datos).filter(([, v]) => v !== undefined)),
    };
    this.db
      .prepare(
        `INSERT INTO estudiantes (id, nombre, universidad, fecha_examen, horas_semana, dias_semana, inicio, notas, actualizado)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET nombre = excluded.nombre, universidad = excluded.universidad,
           fecha_examen = excluded.fecha_examen, horas_semana = excluded.horas_semana,
           dias_semana = excluded.dias_semana, notas = excluded.notas, actualizado = excluded.actualizado`,
      )
      .run(id, e.nombre, e.universidad, e.fecha_examen, e.horas_semana, e.dias_semana, previo?.inicio ?? hoy, e.notas, hoy);
    return this.estudiante(id);
  }

  // — Progreso ——————————————————————————————————————————————————

  /** @returns {Map<string, object>} tema → estado FSRS */
  progreso(estudiante) {
    const filas = this.db.prepare('SELECT * FROM progreso WHERE estudiante = ?').all(estudiante);
    return new Map(filas.map((f) => [f.tema, f]));
  }

  estadoTema(estudiante, tema) {
    return this.db.prepare('SELECT * FROM progreso WHERE estudiante = ? AND tema = ?').get(estudiante, tema) ?? null;
  }

  guardarEstado(estudiante, tema, s) {
    this.db
      .prepare(
        `INSERT INTO progreso (estudiante, tema, estabilidad, dificultad, ultimo_repaso, proximo, repasos, lapsos, ultima_calificacion)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(estudiante, tema) DO UPDATE SET estabilidad = excluded.estabilidad, dificultad = excluded.dificultad,
           ultimo_repaso = excluded.ultimo_repaso, proximo = excluded.proximo, repasos = excluded.repasos,
           lapsos = excluded.lapsos, ultima_calificacion = excluded.ultima_calificacion`,
      )
      .run(estudiante, tema, s.estabilidad, s.dificultad, s.ultimo_repaso, s.proximo, s.repasos, s.lapsos, s.ultima_calificacion);
  }

  registrarRespuesta(estudiante, { tema, fecha, calificacion, modo, pregunta, error }) {
    this.db
      .prepare('INSERT INTO respuestas (estudiante, tema, fecha, calificacion, modo, pregunta, error) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(estudiante, tema, fecha, calificacion, modo ?? null, pregunta ?? null, error ?? null);
  }

  respuestas(estudiante, { tema, limite = 20 } = {}) {
    if (tema) {
      return this.db.prepare('SELECT * FROM respuestas WHERE estudiante = ? AND tema = ? ORDER BY id DESC LIMIT ?').all(estudiante, tema, limite);
    }
    return this.db.prepare('SELECT * FROM respuestas WHERE estudiante = ? ORDER BY id DESC LIMIT ?').all(estudiante, limite);
  }

  /** Errores registrados, del más reciente al más antiguo. Son el material de repaso más valioso. */
  errores(estudiante, limite = 30) {
    return this.db
      .prepare("SELECT tema, fecha, pregunta, error FROM respuestas WHERE estudiante = ? AND error IS NOT NULL AND error != '' ORDER BY id DESC LIMIT ?")
      .all(estudiante, limite);
  }

  /** Fechas (YYYY-MM-DD) con actividad, para la racha. */
  diasConActividad(estudiante) {
    return this.db.prepare('SELECT DISTINCT fecha FROM respuestas WHERE estudiante = ? ORDER BY fecha DESC').all(estudiante).map((f) => f.fecha);
  }

  // — Foco: temas que el estudiante eligió estudiar ————————————————

  foco(estudiante) {
    return this.db.prepare('SELECT tema FROM foco WHERE estudiante = ? ORDER BY agregado, rowid').all(estudiante).map((f) => f.tema);
  }

  agregarFoco(estudiante, temas, hoy) {
    const st = this.db.prepare('INSERT OR IGNORE INTO foco (estudiante, tema, agregado) VALUES (?, ?, ?)');
    this.transaccion(() => temas.forEach((t) => st.run(estudiante, t, hoy)));
  }

  quitarFoco(estudiante, temas) {
    const st = this.db.prepare('DELETE FROM foco WHERE estudiante = ? AND tema = ?');
    this.transaccion(() => temas.forEach((t) => st.run(estudiante, t)));
  }

  limpiarFoco(estudiante) {
    this.db.prepare('DELETE FROM foco WHERE estudiante = ?').run(estudiante);
  }

  // — Simulacros ————————————————————————————————————————————————

  guardarSimulacro(estudiante, s) {
    const r = this.db
      .prepare('INSERT INTO simulacros (estudiante, fecha, universidad, cedulas, nota, rubrica, fortalezas, a_mejorar) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(estudiante, s.fecha, s.universidad ?? null, JSON.stringify(s.cedulas ?? []), s.nota ?? null, JSON.stringify(s.rubrica ?? {}), s.fortalezas ?? null, s.a_mejorar ?? null);
    return Number(r.lastInsertRowid);
  }

  simulacros(estudiante, limite = 20) {
    return this.db
      .prepare('SELECT * FROM simulacros WHERE estudiante = ? ORDER BY fecha DESC, id DESC LIMIT ?')
      .all(estudiante, limite)
      .map((s) => ({ ...s, cedulas: JSON.parse(s.cedulas || '[]'), rubrica: JSON.parse(s.rubrica || '{}') }));
  }

  // — Material guardado ——————————————————————————————————————————

  guardarMaterial(estudiante, { tema, tipo, titulo, contenido, creado }) {
    const r = this.db
      .prepare('INSERT INTO material (estudiante, tema, tipo, titulo, contenido, creado) VALUES (?, ?, ?, ?, ?, ?)')
      .run(estudiante, tema ?? null, tipo, titulo, contenido, creado);
    return Number(r.lastInsertRowid);
  }

  material(estudiante, { tema, id } = {}) {
    if (id) return this.db.prepare('SELECT * FROM material WHERE estudiante = ? AND id = ?').all(estudiante, id);
    if (tema) return this.db.prepare('SELECT * FROM material WHERE estudiante = ? AND tema = ? ORDER BY id DESC').all(estudiante, tema);
    return this.db.prepare('SELECT id, tema, tipo, titulo, creado FROM material WHERE estudiante = ? ORDER BY id DESC').all(estudiante);
  }

  // — Manuales ——————————————————————————————————————————————————

  agregarManual(estudiante, { titulo, autor, anio, rama, ruta, paginas, agregado }) {
    return this.transaccion(() => {
      const r = this.db
        .prepare('INSERT INTO manuales (estudiante, titulo, autor, anio, rama, ruta, paginas, agregado) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(estudiante, titulo, autor ?? null, anio ?? null, rama ?? null, ruta, paginas.length, agregado);
      const id = Number(r.lastInsertRowid);
      const st = this.db.prepare('INSERT INTO pasajes (texto, manual, pagina) VALUES (?, ?, ?)');
      for (const p of paginas) if (p.texto.trim()) st.run(p.texto, id, p.numero);
      return id;
    });
  }

  manuales(estudiante) {
    return this.db.prepare('SELECT id, titulo, autor, anio, rama, paginas, agregado FROM manuales WHERE estudiante = ? ORDER BY id').all(estudiante);
  }

  quitarManual(estudiante, id) {
    return this.transaccion(() => {
      const m = this.db.prepare('SELECT id FROM manuales WHERE estudiante = ? AND id = ?').get(estudiante, id);
      if (!m) return false;
      this.db.prepare('DELETE FROM pasajes WHERE manual = ?').run(id);
      this.db.prepare('DELETE FROM manuales WHERE id = ?').run(id);
      return true;
    });
  }

  /**
   * Búsqueda de texto completo en los manuales del estudiante. `bm25` ordena
   * por pertinencia; `snippet` recorta alrededor de las coincidencias.
   */
  buscarPasajes(estudiante, consultaFts, { rama, limite = 6 } = {}) {
    const sql = `
      SELECT m.id AS manual, m.titulo, m.autor, m.anio, m.rama, p.pagina,
             snippet(pasajes, 0, '«', '»', ' … ', 60) AS extracto,
             p.texto AS texto_pagina
      FROM pasajes p JOIN manuales m ON m.id = p.manual
      WHERE pasajes MATCH ? AND m.estudiante = ? ${rama ? 'AND (m.rama = ? OR m.rama IS NULL)' : ''}
      ORDER BY bm25(pasajes)
      LIMIT ?`;
    const args = rama ? [consultaFts, estudiante, rama, limite] : [consultaFts, estudiante, limite];
    return this.db.prepare(sql).all(...args);
  }
}
