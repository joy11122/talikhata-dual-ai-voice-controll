import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
const walk = (dir) => fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
  const p=path.join(dir,e.name);
  if(e.isDirectory() && !['node_modules','.next','.git'].includes(e.name)) return walk(p);
  return e.isFile() ? [p] : [];
});
const files=walk(root).filter(f=>/\.(ts|tsx|mjs|js)$/.test(f));
const read=f=>fs.readFileSync(f,'utf8');

const middleware=read(path.join(root,'middleware.ts'));
for (const bad of ['mongoose','mongodb','bcryptjs','@/lib/db','@/lib/auth','@/models/','@/services/']) {
  if(middleware.includes(bad)) failures.push(`Edge middleware imports forbidden Node dependency: ${bad}`);
}
const edgeConfig=read(path.join(root,'auth.config.ts'));
for (const bad of ['mongoose','mongodb','bcryptjs','@/lib/db','@/lib/auth','@/models/','@/services/']) {
  if(edgeConfig.includes(bad)) failures.push(`Edge auth config imports forbidden Node dependency: ${bad}`);
}
for (const f of files) {
  const s=read(f);
  if(/^['\"]use client['\"]/.test(s.trimStart())) {
    if(/from ['\"](?:@\/auth|@\/lib\/auth|@\/lib\/db|@\/models\/|@\/services\/)/.test(s)) failures.push(`Client module imports server-only module: ${path.relative(root,f)}`);
  }
  if(/\.tmp$|\.bak$/.test(f)) failures.push(`Temporary file included: ${path.relative(root,f)}`);
}
const required=['app','components','hooks','lib','models','services','types','tests'];
for(const d of required) if(!fs.existsSync(path.join(root,d))) failures.push(`Missing core directory: ${d}`);
for(const f of ['types/domain/party.ts','types/domain/product.ts','types/domain/transaction.ts','types/domain/error.ts','types/domain/index.ts']) if(!fs.existsSync(path.join(root,f))) failures.push(`Missing domain type contract: ${f}`);
if(fs.existsSync(path.join(root,'types/domain.ts'))) failures.push('Legacy monolithic types/domain.ts still exists; use types/domain/* instead.');
if(!fs.existsSync(path.join(root,'auth.config.ts'))) failures.push('Missing Edge-safe auth.config.ts');
if(!fs.existsSync(path.join(root,'lib/server-only.ts'))) failures.push('Missing server-only boundary marker');
if(failures.length){ console.error(failures.map(x=>`✗ ${x}`).join('\n')); process.exit(1); }
console.log('Static QA passed: Edge boundary, client/server boundary, domain types, core folders, and temp-file checks.');
