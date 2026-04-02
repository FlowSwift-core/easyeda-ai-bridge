import fs from 'fs-extra';
import path from 'path';

const extDir = __dirname;
const packageJsonPath = path.join(extDir, 'package.json');
const extensionJsonPath = path.join(extDir, 'extension.json');
const versionTsPath = path.join(extDir, 'src/version.ts');
const eextVersionTsPath = path.join(extDir, '../eext-frontend/src/version.ts');

const pkg = fs.readJsonSync(packageJsonPath);
const version = pkg.version;

const extConfig = fs.readJsonSync(extensionJsonPath);
extConfig.version = version;
fs.writeJsonSync(extensionJsonPath, extConfig, { spaces: '\t', EOL: '\n' });

fs.writeFileSync(versionTsPath, `export const VERSION = '${version}';\n`);
fs.writeFileSync(eextVersionTsPath, `export const VERSION = '${version}';\n`);

console.log(`Version synced from package.json: ${version}`);
