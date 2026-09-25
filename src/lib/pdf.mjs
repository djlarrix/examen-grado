/**
 * Extracción de texto de PDF, página por página.
 *
 * Se usa pdf.js (Mozilla) porque es JavaScript puro: nada que compilar en la
 * máquina del estudiante, que suele ser un notebook con Windows. Un PDF
 * escaneado sin capa de texto devuelve páginas vacías; eso se informa en vez
 * de indexar un manual "vacío" que después no encuentra nada.
 */
import { readFile } from 'node:fs/promises';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

/**
 * @param {string} ruta
 * @returns {Promise<{paginas: {numero: number, texto: string}[], total: number, sinTexto: number}>}
 */
export async function extraerPaginas(ruta) {
  const datos = new Uint8Array(await readFile(ruta));
  const tarea = getDocument({ data: datos, useSystemFonts: true, verbosity: 0 });
  const doc = await tarea.promise;
  const paginas = [];
  let sinTexto = 0;
  for (let i = 1; i <= doc.numPages; i++) {
    const pag = await doc.getPage(i);
    const contenido = await pag.getTextContent();
    // pdf.js entrega fragmentos sueltos; `hasEOL` marca dónde el PDF cortaba la
    // línea. Sin respetarlo, los párrafos quedan pegados palabra con palabra.
    let texto = '';
    for (const it of contenido.items) {
      texto += it.str + (it.hasEOL ? '\n' : ' ');
    }
    texto = texto.replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    if (texto.length < 20) sinTexto++;
    paginas.push({ numero: i, texto });
    pag.cleanup();
  }
  const total = doc.numPages;
  await tarea.destroy();
  return { paginas, total, sinTexto };
}
