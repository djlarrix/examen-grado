import { test } from 'node:test';
import assert from 'node:assert/strict';
import { programar, recuperabilidad, intervaloPara, dominio, W } from '../src/repaso.mjs';

test('la recuperabilidad es 0,9 cuando han pasado tantos días como la estabilidad', () => {
  assert.ok(Math.abs(recuperabilidad(10, 10) - 0.9) < 1e-9);
  assert.ok(Math.abs(intervaloPara(10) - 10) < 1e-9);
});

test('primera vez: la estabilidad inicial depende de la calificación', () => {
  const hoy = '2026-10-01';
  assert.equal(programar(null, 3, hoy).estabilidad, Number(W[2].toFixed(4)));
  assert.equal(programar(null, 3, hoy).proximo, '2026-10-05'); // 3,7 días → 4
  assert.equal(programar(null, 1, hoy).proximo, '2026-10-02'); // otra vez: mañana
  assert.ok(programar(null, 4, hoy).estabilidad > programar(null, 2, hoy).estabilidad);
});

test('recordar a tiempo alarga el intervalo; olvidar lo acorta y cuenta un lapso', () => {
  const e1 = programar(null, 3, '2026-10-01');
  const e2 = programar(e1, 3, e1.proximo);
  assert.ok(e2.estabilidad > e1.estabilidad);
  const olvido = programar(e2, 1, e2.proximo);
  assert.ok(olvido.estabilidad < e2.estabilidad);
  assert.equal(olvido.lapsos, 1);
  assert.equal(olvido.proximo, new Date(new Date(e2.proximo).getTime() + 86400000).toISOString().slice(0, 10));
});

test('ningún repaso queda agendado después del examen', () => {
  let e = programar(null, 4, '2026-10-01', { fechaExamen: '2026-10-20' });
  while (e.proximo < '2026-10-19') {
    e = programar(e, 4, e.proximo, { fechaExamen: '2026-10-20' });
    assert.ok(e.proximo <= '2026-10-19', `proximo ${e.proximo}`);
  }
});

test('la dificultad se mantiene entre 1 y 10', () => {
  let e = programar(null, 1, '2026-10-01');
  for (let i = 0; i < 20; i++) e = programar(e, 1, e.proximo);
  assert.ok(e.dificultad <= 10 && e.dificultad >= 1);
  let f = programar(null, 4, '2026-10-01');
  for (let i = 0; i < 20; i++) f = programar(f, 4, f.proximo);
  assert.ok(f.dificultad >= 1);
});

test('dominio: sin ver, débil tras olvidar, dominado con estabilidad alta y recuerdo fresco', () => {
  assert.equal(dominio(null, '2026-10-01'), 'sin_ver');
  const olvidado = programar(programar(null, 3, '2026-10-01'), 1, '2026-10-05');
  assert.equal(dominio(olvidado, '2026-10-05'), 'debil');
  const firme = { estabilidad: 40, dificultad: 4, ultimo_repaso: '2026-10-01', proximo: '2026-11-10', repasos: 5, lapsos: 0, ultima_calificacion: 3 };
  assert.equal(dominio(firme, '2026-10-02'), 'dominado');
  assert.equal(dominio(firme, '2027-06-01'), 'debil'); // meses sin repasar
});
