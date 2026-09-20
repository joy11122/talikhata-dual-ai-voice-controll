import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const required = [
  'app', 'components', 'services', 'models', 'lib', 'types', 'hooks', 'tests', 'public'
];
const missing = required.filter((name) => !fs.existsSync(path.join(root, name)));
if (missing.length) {
  console.error(`Missing required directories: ${missing.join(', ')}`);
  process.exit(1);
}
const typeFiles = [
  'types/auth.ts',
  'types/shop.ts',
  'types/voice.ts',
  'types/api.ts',
  'types/domain/party.ts',
  'types/domain/product.ts',
  'types/domain/transaction.ts',
  'types/domain/error.ts',
];
const missingTypes = typeFiles.filter((file) => !fs.existsSync(path.join(root, file)));
if (missingTypes.length) {
  console.error(`Missing type contracts: ${missingTypes.join(', ')}`);
  process.exit(1);
}
console.log(`Structure audit passed: ${required.length} core directories and ${typeFiles.length} domain type contracts verified.`);
