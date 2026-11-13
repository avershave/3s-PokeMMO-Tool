// Rewrites tags/version.json with the current UTC time. Run: npm run overlay:bump
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../../tags/version.json', import.meta.url));
const generatedAt = new Date().toISOString();
await writeFile(OUT, JSON.stringify({ generatedAt }, null, 2) + '\n');
console.log(`generatedAt = ${generatedAt}`);
