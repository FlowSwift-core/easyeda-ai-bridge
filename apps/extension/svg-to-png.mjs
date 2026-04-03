import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const input = resolve(__dirname, 'images/logo.svg');
const output = resolve(__dirname, 'images/logo.png');

sharp(input)
  .resize(1024, 1024)
  .png()
  .toFile(output)
  .then(() => console.log('logo.png generated'))
  .catch(err => { console.error(err); process.exit(1); });
