import {build} from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import {sourceArchive} from './source-archive.mjs';
import {buildGuide} from './build-guide.mjs';
const out='dist';
// The company source package intentionally has no Sites identity. A local
// build must work without inventing one or depending on a previous build.
const hasSites=await fs.access('.openai/hosting.json').then(()=>true,error=>{if(error.code==='ENOENT')return false;throw error;});
await fs.rm(out,{recursive:true,force:true});await fs.mkdir(out+'/client/assets',{recursive:true});
await fs.cp('public',out+'/client',{recursive:true});
await sourceArchive(out+'/client/downloads/lansrry-fonte.zip',{includeSites:hasSites});
await fs.cp('docs',out+'/client/downloads',{recursive:true});
await build({entryPoints:['src/client.tsx'],bundle:true,minify:true,format:'esm',platform:'browser',target:'es2022',outfile:out+'/client/assets/app.js',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'}});
await buildGuide();
const mime={'.png':'image/png','.ico':'image/x-icon','.jpg':'image/jpeg','.webp':'image/webp','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.woff2':'font/woff2','.zip':'application/zip','.md':'text/plain; charset=utf-8'};
const assets={};async function walk(dir){for(const f of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,f.name);if(f.isDirectory())await walk(p);else{const bytes=await fs.readFile(p);const key='/'+path.relative(out+'/client',p).replaceAll('\\','/');assets[key]={base64:bytes.toString('base64'),mime:mime[path.extname(p)]||'application/octet-stream'};}}}
await walk(out+'/client');await fs.writeFile('server/generated-assets.ts','export const assets:Record<string,{base64:string;mime:string}>='+JSON.stringify(assets)+';');
await build({entryPoints:['server/worker.ts'],bundle:true,minify:true,platform:'browser',format:'esm',target:'es2022',outfile:out+'/server/index.js',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},conditions:['worker','browser']});
// Static fallback also contains actual server-rendered public HTML, never a blank app shell.
await build({entryPoints:['server/render.tsx'],bundle:true,platform:'node',format:'esm',packages:'external',outfile:out+'/render.mjs',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'}});
const {renderPage}=await import('../dist/render.mjs');const {demoProducts,publicRoutes}=await import('../src/data.ts');
const routes=[...publicRoutes,'/carrinho','/checkout','/conta','/admin',...demoProducts.map(p=>'/produto/'+p.slug),'/404'];
for(const route of routes){const dest=out+'/client/'+(route==='/'?'index.html':route.slice(1)+'/index.html');await fs.mkdir(path.dirname(dest),{recursive:true});await fs.writeFile(dest,renderPage({path:route,query:'',products:demoProducts,mode:'demo',paymentMode:'test'}));}
await fs.rm(out+'/render.mjs');
if(hasSites){await fs.mkdir(out+'/.openai',{recursive:true});await fs.copyFile('.openai/hosting.json',out+'/.openai/hosting.json');}
console.log('Build completo: cliente otimizado, HTML SSR e Worker.');
