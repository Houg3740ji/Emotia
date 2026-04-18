import sharp from 'sharp';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

// SVG icon: fondo teal, letra E blanca centrada
function makeSvg(size) {
  const fontSize = Math.round(size * 0.52);
  const r = Math.round(size * 0.18); // border-radius para maskable
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="#0d968b"/>
      <text
        x="50%" y="50%"
        dominant-baseline="central"
        text-anchor="middle"
        font-family="Inter, system-ui, sans-serif"
        font-weight="800"
        font-size="${fontSize}"
        fill="white"
        letter-spacing="-2"
      >E</text>
    </svg>
  `);
}

async function generate(size, filename) {
  await sharp(makeSvg(size))
    .png()
    .toFile(join(publicDir, filename));
  console.log(`✓ ${filename} (${size}×${size})`);
}

await generate(512, 'icon-512.png');
await generate(192, 'icon-192.png');
await generate(180, 'apple-touch-icon.png');
console.log('Icons generados en public/');
