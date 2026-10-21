import {build} from 'esbuild';
import fs from 'node:fs/promises';
import {buildGuide} from './build-guide.mjs';

const out='dist/company';
await fs.rm(out,{recursive:true,force:true});
await fs.mkdir(out+'/public/assets',{recursive:true});
// Only storefront assets go to the CDN: no source ZIP, technical documents,
// credentials, or demonstration HTML can be served by the asset binding.
await fs.cp('public/assets',out+'/public/assets',{recursive:true});
await fs.copyFile('public/favicon.ico',out+'/public/favicon.ico');
await build({entryPoints:['src/client.tsx'],bundle:true,minify:true,format:'esm',platform:'browser',target:'es2022',outfile:out+'/public/assets/app.js',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'}});
await buildGuide();
await build({entryPoints:['server/cloudflare.ts'],bundle:true,minify:true,platform:'browser',format:'esm',target:'es2022',outfile:out+'/worker.js',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},conditions:['worker','browser']});
console.log('Entrega Cloudflare compilada em dist/company: SSR, API e assets separados. Nenhuma publicação realizada.');
