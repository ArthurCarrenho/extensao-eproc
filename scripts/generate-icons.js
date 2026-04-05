import sharp from 'sharp';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcSvg = resolve(__dirname, '../src/icons/icon.svg');
const outDir = resolve(__dirname, '../src/icons');

const sizes = [16, 48, 128];

for (const size of sizes) {
    const outPath = resolve(outDir, `icon${size}.png`);
    await sharp(srcSvg)
        .resize(size, size)
        .png()
        .toFile(outPath);
    console.log(`✓ icon${size}.png`);
}
