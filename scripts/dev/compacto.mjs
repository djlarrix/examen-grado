import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
const d = parse(readFileSync(process.argv[2], 'utf8'));
const nivel = new RegExp(process.argv[3] ?? '^(\\d+\\.|[A-Z]\\)|[a-z]\\))\\s');
for (const c of d.cedulas) {
  const items = (c.contenido ?? '').split('\n').filter((l) => nivel.test(l)).map((l) => l.replace(/\s+/g, ' ').slice(0, 70));
  console.log(`## ${c.numero}. ${c.tema}${c.excluidas ? `  [EXCL: ${c.excluidas.replace(/\s+/g, ' ').slice(0, 160)}]` : ''}`);
  if (items.length) console.log('   ' + items.join(' | ').slice(0, 900));
}
