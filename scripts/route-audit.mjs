import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const app=path.join(root,'app');
const routes=new Set(['/']);
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(e.name==='page.tsx'||e.name==='page.ts'||e.name==='route.ts'||e.name==='route.tsx'){let rel=path.relative(app,path.dirname(p)).split(path.sep).join('/');rel=rel.replace(/^\(.*?\)\//,'');let r='/' + rel.replace(/\[.*?\]/g,':param');if(r==='/.')r='/';routes.add(r.replace(/\/+/g,'/'));}}}
walk(app);
const files=[];function collect(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())collect(p);else if(/\.(tsx|ts|md)$/.test(e.name))files.push(p)}}collect(root);
const hrefs=new Set();for(const f of files){const s=fs.readFileSync(f,'utf8');for(const m of s.matchAll(/href=["'`]([^"'`#?]+)["'`]/g)){const h=m[1];if(h.startsWith('/'))hrefs.add(h)}}
const normalize=h=>{const base=h.replace(/\/$/,'')||'/';for(const r of routes){const rp=r.replace(/:param/g,'[^/]+');if(new RegExp('^'+rp+'$').test(base))return true}return false};
const broken=[...hrefs].filter(h=>!normalize(h)&&!h.startsWith('/api/'));
console.log(`Routes discovered: ${routes.size}`);console.log(`Internal hrefs: ${hrefs.size}`);if(broken.length){console.error('Potential broken internal links:');for(const h of broken)console.error(' -',h);process.exitCode=1}else console.log('No obvious broken internal links found.');
