// Dibuja recursos/icono.png (512×512): el ícono de la extensión de Claude Desktop.
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';

for (const f of ['/System/Library/Fonts/Supplemental/Georgia Bold.ttf', '/System/Library/Fonts/Supplemental/Georgia.ttf']) {
  try { GlobalFonts.registerFromPath(f, 'Georgia'); } catch {}
}
const n = 512;
const c = createCanvas(n, n);
const g = c.getContext('2d');
const r = 112;
g.beginPath();
g.moveTo(r, 0); g.arcTo(n, 0, n, n, r); g.arcTo(n, n, 0, n, r); g.arcTo(0, n, 0, 0, r); g.arcTo(0, 0, n, 0, r);
g.closePath();
const fondo = g.createLinearGradient(0, 0, n, n);
fondo.addColorStop(0, '#16325c');
fondo.addColorStop(1, '#0c1d38');
g.fillStyle = fondo;
g.fill();
// Sello: el signo de sección, símbolo de los códigos.
g.fillStyle = '#f4efe3';
g.font = 'bold 330px Georgia';
g.textAlign = 'center';
g.textBaseline = 'middle';
g.fillText('§', n / 2, n / 2 - 22);
// Una línea de acento dorada y la palabra.
g.fillStyle = '#d4a64a';
g.fillRect(n / 2 - 90, 392, 180, 8);
g.fillStyle = '#f4efe3';
g.font = 'bold 44px Georgia';
g.fillText('GRADO', n / 2, 448);
writeFileSync(new URL('../../recursos/icono.png', import.meta.url), c.toBuffer('image/png'));
console.log('recursos/icono.png');
