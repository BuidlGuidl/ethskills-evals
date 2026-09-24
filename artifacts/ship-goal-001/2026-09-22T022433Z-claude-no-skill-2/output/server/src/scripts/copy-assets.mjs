// tsc only emits .ts files; the SQL schema has to be copied next to it.
import { cpSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const srcDir = path.dirname(fileURLToPath(import.meta.url));
const destDir = path.resolve(srcDir, '..', '..', 'dist', 'db');
mkdirSync(destDir, { recursive: true });
cpSync(path.resolve(srcDir, '..', 'db', 'schema.sql'), path.join(destDir, 'schema.sql'));
console.log('copied schema.sql -> dist/db/schema.sql');
