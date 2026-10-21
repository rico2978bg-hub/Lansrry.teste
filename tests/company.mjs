import assert from 'node:assert/strict';
import test from 'node:test';
import {build} from 'esbuild';
import {mkdtemp,rm,readdir,mkdir,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {generateKeyPairSync,randomUUID} from 'node:crypto';
import {FakeServices} from './fake-firebase.mjs';
import {configurationProblems} from '../scripts/check-company.mjs';
import {sourceArchive} from '../scripts/source-archive.mjs';

const temporary=await mkdtemp(resolve(tmpdir(),'lansrry-company-'));
await build({stdin:{contents:"export {default as worker} from './server/cloudflare';export {default as sites} from './server/worker';export * from './server/firebase';",resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},outfile:temporary+'/server.mjs'});
const module=await import(pathToFileURL(temporary+'/server.mjs').href);
const services=new FakeServices(module),originalFetch=globalThis.fetch;
globalThis.fetch=services.fetch.bind(services);
const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}});
const env={FIREBASE_PROJECT_ID:'test-project',FIREBASE_API_KEY:'fake-web-key',FIREBASE_CLIENT_EMAIL:'fake@example.test',FIREBASE_PRIVATE_KEY:privateKey,FIREBASE_STORAGE_BUCKET:'fake-bucket',ADMIN_UIDS:'admin',PRIVACY_POLICY_TEXT:'Política oficial de teste',TERMS_TEXT:'Termos exclusivamente para teste',RETURNS_POLICY_TEXT:'Devoluções exclusivamente para teste',LEGAL_APPROVED:'true',LEGAL_CONTROLLER_NAME:'Empresa fictícia de teste',LEGAL_CONTROLLER_DOCUMENT:'Documento fictício de teste',PRIVACY_CONTACT:'privacidade@example.test',DATA_RETENTION_POLICY:'Retenção fictícia para teste',SITE_URL:'https://dominio-comprado.test',PAYMENTS_MODE:'test',CHECKOUT_ENABLED:'false'};
const req=(path,user,body)=>new Request(env.SITE_URL+path,{method:body?'POST':'GET',headers:{...(user?{Cookie:'lansrry_session='+user}:{}),...(body?{'Content-Type':'application/json','Idempotency-Key':randomUUID(),'CF-Connecting-IP':'10.20.0.1'}:{})},body:body?JSON.stringify(body):undefined});
const product={id:'product-a',slug:'produto-real',name:'Produto da empresa',description:'Peça real de teste',category:'filamentos',kind:'spool',price:20,stock:2,featured:true,variants:[],images:[],demo:false};
const body={cep:'92702470',customer:{name:'Cliente',email:'cliente@example.test',phone:'51900000000',address:'Rua de teste,1',city:'Guaíba RS',cep:'92702470'},items:[{id:'product-a',variant:'',qty:1}]};

try{
 await test('company target refuses demonstration even when APP_MODE is changed',async()=>{
  for(const path of ['/','/loja','/admin','/orcamento','/api/quotes']){
   const response=await module.worker.fetch(req(path),{APP_MODE:'demo'});
   assert.equal(response.status,503,path);
   const content=await response.text();assert.ok(!content.includes('DEMO'));assert.ok(!content.includes('demo-filamento'));
  }
 });
 await test('configured company store uses real catalog and purchased-domain origin',async()=>{
  services.reset();services.seed('products/product-a',product);
  const response=await module.worker.fetch(req('/loja'),env);assert.equal(response.status,200);
  const content=await response.text();assert.ok(content.includes(product.name));assert.ok(content.includes('https://dominio-comprado.test/loja'));assert.ok(!content.includes('demo-filamento'));assert.ok(!content.includes('rico2978bg.chatgpt.site'));
  const page=await module.worker.fetch(req('/checkout'),env);assert.ok((await page.text()).includes('Estamos preparando as compras pelo site'));
 });
 await test('checkout gate blocks direct API requests before any order or gateway call',async()=>{
  services.reset();services.seed('products/product-a',product);
  const response=await module.worker.fetch(req('/api/orders','customer-a',body),env);
  assert.equal(response.status,503);assert.equal(services.values('orders').length,0);assert.equal(services.preferenceCalls,0);assert.equal(services.value('products/product-a').stock,2);
 });
 await test('enabled company checkout preserves the transactional gateway path',async()=>{
  services.reset();services.seed('products/product-a',product);
  const enabled={...env,CHECKOUT_ENABLED:'true',PAYMENTS_MODE:'live',MERCADO_PAGO_SELLER_ID:'123',MERCADO_PAGO_ACCESS_TOKEN:'fake-access-token',MERCADO_PAGO_WEBHOOK_SECRET:'fake-webhook-secret',SHIPPING_QUOTE_URL:'https://shipping.test/quote'};
  const response=await module.worker.fetch(req('/api/orders','customer-a',body),enabled);assert.equal(response.status,201,await response.clone().text());
  assert.equal(services.values('orders').length,1);assert.equal(services.preferenceCalls,1);assert.equal(services.value('products/product-a').stock,1);
 });
 await test('technical guide and source download require administrator identity',async()=>{
  services.reset();
  for(const worker of [module.worker,module.sites])for(const path of ['/guia','/downloads/lansrry-fonte.zip']){
   assert.equal((await worker.fetch(req(path),env)).status,401);
   assert.equal((await worker.fetch(req(path,'customer-a'),env)).status,403);
  }
  assert.equal((await module.worker.fetch(req('/guia','admin'),env)).status,200);
  assert.equal((await module.worker.fetch(req('/downloads/lansrry-fonte.zip','admin'),env)).status,404);
  const download=await module.sites.fetch(req('/downloads/lansrry-fonte.zip','admin'),env);assert.equal(download.status,200);assert.equal(download.headers.get('Content-Type'),'application/zip');assert.equal(download.headers.get('Cache-Control'),'no-store');
 });
 await test('public asset binding cannot serve fallback HTML or handoff files',async()=>{
  let calls=0;const binding={fetch:async()=>{calls++;return new Response('public asset');}};
  assert.equal((await module.worker.fetch(req('/assets/app.css'),{ASSETS:binding})).status,200);
  assert.equal((await module.worker.fetch(req('/downloads/private.zip'),{ASSETS:binding})).status,503);
  assert.equal((await module.worker.fetch(req('/index.html'),{ASSETS:binding})).status,503);assert.equal(calls,1);
  async function walk(directory){let files=[];for(const item of await readdir(directory,{withFileTypes:true})){const path=directory+'/'+item.name;files.push(...(item.isDirectory()?await walk(path):[path]));}return files;}
  const files=await walk('dist/company/public');assert.ok(files.some(path=>path.endsWith('/app.js')));assert.ok(files.every(path=>! /\.(html|zip|md|json|env)$/.test(path)));
 });
 await test('readiness probe reveals no private configuration and checks missing setup',async()=>{
  const ready=await module.worker.fetch(req('/healthz'),env);assert.equal(ready.status,200);assert.deepEqual(await ready.json(),{ready:true});
  const missing=await module.worker.fetch(req('/healthz'),{...env,ADMIN_UIDS:''});assert.equal(missing.status,503);assert.deepEqual(await missing.json(),{ready:false});
 });
 await test('configuration checker reports names without printing private values',async()=>{
  const missing=await configurationProblems({...env,SITE_URL:'',FIREBASE_API_KEY:'unique-secret-sentinel'});
  const report=missing.join(', ');assert.ok(report.includes('Endereço HTTPS'));assert.ok(!report.includes('unique-secret-sentinel'));assert.ok(!report.includes(privateKey));
  assert.deepEqual(await configurationProblems(env),[]);
  assert.ok((await configurationProblems({...env,SHIPPING_QUOTE_URL:'http://shipping.test'})).includes('Frete HTTPS'));
  assert.ok((await configurationProblems({...env,CHECKOUT_ENABLED:'yes'})).includes('Liberação da compra'));
 });
 await test('handoff archive excludes nested env files and refuses service-account keys',async()=>{
  const root=temporary+'/source';
  for(const dir of ['src','server','scripts','docs','tests','public','cloudflare'])await mkdir(root+'/'+dir,{recursive:true});
  for(const file of ['README.md','package.json','package-lock.json','tsconfig.json','.env.example','.gitignore','firebase.json','firestore.rules','storage.rules','company.secrets.example.json'])await writeFile(root+'/'+file,file.endsWith('.json')?'{}':'template');
  await writeFile(root+'/cloudflare/wrangler.json','{}');
  await writeFile(root+'/cloudflare/.dev.vars','SECRET=test-only-sensitive-sentinel');
  await writeFile(root+'/server/.env.production','SECRET=test-only-sensitive-sentinel');
  await writeFile(root+'/server/generated-assets.ts','stale build output');
  await mkdir(root+'/tests/screenshots',{recursive:true});await writeFile(root+'/tests/screenshots/private.png','local screenshot');
  await writeFile(root+'/cloudflare/payment.secrets.json','{"TOKEN":"test-only-sensitive-sentinel"}');
  // A source tree with no Sites identity can also repackage using defaults.
  const archive=temporary+'/handoff.zip';await sourceArchive(archive,{rootDir:root});
  const bytes=await readFile(archive);assert.ok(bytes.includes(Buffer.from('lansrry/cloudflare/wrangler.json')));assert.ok(!bytes.includes(Buffer.from('.dev.vars')));assert.ok(!bytes.includes(Buffer.from('.env.production')));assert.ok(!bytes.includes(Buffer.from('payment.secrets.json')));assert.ok(!bytes.includes(Buffer.from('generated-assets.ts')));assert.ok(!bytes.includes(Buffer.from('screenshots/private.png')));assert.ok(!bytes.includes(Buffer.from('lansrry\\')));
  await writeFile(root+'/server/service-account.json',JSON.stringify({type:'service_account',private_key:'test-only-private-key-sentinel'}));
  await assert.rejects(sourceArchive(archive,{includeSites:false,rootDir:root}),error=>error.message.includes('credenciais')&&!error.message.includes('test-only-private-key-sentinel'));
 });
}finally{globalThis.fetch=originalFetch;await rm(temporary,{recursive:true,force:true});}
