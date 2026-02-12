const fs = require('fs');
const path = require('path');

// Tiny 8x8 PNG (light gray) base64
const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAK0lEQVR42mNgGAXUBwQmYGBg+M8w4T8wMDAwM/8P4n4GJgYGBgYGABBgABGQCBq2s9XwAAAABJRU5ErkJggg==';
const buffer = Buffer.from(base64, 'base64');

const outDir = path.join(process.cwd(), 'public', 'avatars', 'avatar_animals');
fs.mkdirSync(outDir, { recursive: true });

for (let i = 1; i <= 12; i++) {
  const filename = `avatar_animal_${i}.png`;
  fs.writeFileSync(path.join(outDir, filename), buffer);
}

console.log('Wrote 12 PNG avatar files to', outDir);
