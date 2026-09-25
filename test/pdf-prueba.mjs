/** Genera un PDF mínimo con texto, una página por elemento de `paginas`. Sólo para pruebas. */
export function pdfConTexto(paginas) {
  const objs = [];
  const n = paginas.length;
  // 1 catálogo, 2 páginas, 3 fuente, luego por página: página + contenido.
  objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  const kids = paginas.map((_, i) => `${4 + i * 2} 0 R`).join(' ');
  objs[2] = `<< /Type /Pages /Kids [${kids}] /Count ${n} >>`;
  objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  paginas.forEach((texto, i) => {
    const lineas = texto.split('\n').map((l, j) => `BT /F1 11 Tf 50 ${750 - j * 16} Td (${l.replace(/[()\\]/g, '\\$&')}) Tj ET`).join('\n');
    const flujo = Buffer.from(lineas, 'latin1');
    objs[4 + i * 2] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`;
    objs[5 + i * 2] = { flujo };
  });
  const partes = [Buffer.from('%PDF-1.4\n', 'latin1')];
  const offsets = [];
  let pos = partes[0].length;
  for (let k = 1; k < objs.length; k++) {
    offsets[k] = pos;
    const o = objs[k];
    const cuerpo = typeof o === 'string'
      ? Buffer.from(`${k} 0 obj\n${o}\nendobj\n`, 'latin1')
      : Buffer.concat([Buffer.from(`${k} 0 obj\n<< /Length ${o.flujo.length} >>\nstream\n`, 'latin1'), o.flujo, Buffer.from('\nendstream\nendobj\n', 'latin1')]);
    partes.push(cuerpo);
    pos += cuerpo.length;
  }
  const xref = ['xref', `0 ${objs.length}`, '0000000000 65535 f '];
  for (let k = 1; k < objs.length; k++) xref.push(`${String(offsets[k]).padStart(10, '0')} 00000 n `);
  partes.push(Buffer.from(`${xref.join('\n')}\ntrailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${pos}\n%%EOF\n`, 'latin1'));
  return Buffer.concat(partes);
}
