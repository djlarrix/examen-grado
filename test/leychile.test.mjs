import { test } from 'node:test';
import assert from 'node:assert/strict';
import { limpiarTexto } from '../src/fuentes/leychile.mjs';

test('separa las notas de margen del texto legal y rearma los párrafos', () => {
  const crudo =
    'Art. 1683. La nulidad absoluta puede y debe ser                L. 16.952\n' +
    'declarada por el juez, aun sin petición de parte, cuando            Art. 1º\n' +
    'aparece de manifiesto en el acto o contrato.\n' +
    '     Segundo inciso que sigue\n' +
    'en otra línea.';
  const { texto, notas } = limpiarTexto(crudo);
  assert.equal(texto, 'Art. 1683. La nulidad absoluta puede y debe ser declarada por el juez, aun sin petición de parte, cuando aparece de manifiesto en el acto o contrato.\nSegundo inciso que sigue en otra línea.');
  assert.deepEqual(notas, ['L. 16.952', 'Art. 1º']);
});

test('no confunde prosa con espacios dobles con una nota', () => {
  const { texto, notas } = limpiarTexto('Para hacer ejecutar sus  resoluciones, los tribunales');
  assert.deepEqual(notas, []);
  assert.equal(texto, 'Para hacer ejecutar sus  resoluciones, los tribunales');
});

test('numerales con sangría quedan en líneas propias', () => {
  const { texto } = limpiarTexto('Art. 434. Títulos:\n\n    1°. Sentencia firme, bien sea definitiva o\ninterlocutoria;\n    2°. Copia autorizada de escritura pública;');
  assert.equal(texto, 'Art. 434. Títulos:\n1°. Sentencia firme, bien sea definitiva o interlocutoria;\n2°. Copia autorizada de escritura pública;');
});
