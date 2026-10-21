import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const dir=await mkdtemp(path.join(tmpdir(),'lansrry-analytics-'));
const previous=globalThis.fetch;
try{
 await build({entryPoints:['server/analytics.ts'],bundle:true,platform:'node',format:'esm',outfile:path.join(dir,'analytics.mjs')});
 const {receiveAnalytics}=await import(pathToFileURL(path.join(dir,'analytics.mjs')));
 const env={LEGAL_APPROVED:'true',GA_ANALYTICS_ENABLED:'true',GA_MEASUREMENT_ID:'G-TEST123',GA_API_SECRET:'private-example-only',SITE_URL:'https://lansrry.example'};
 const event={consent:true,clientId:'67ac4928-f0f9-4ef4-bb4c-6ec6c9c7c709',page:'/loja'};let sent=[];
 globalThis.fetch=async(url,init)=>{sent.push({url:String(url),init});return new Response(null,{status:204});};
 const request=b=>new Request('https://lansrry.example/api/analytics?email=never@example.test',{method:'POST',headers:{'Content-Type':'application/json','Referer':'https://lansrry.example?secret=example','User-Agent':'private-browser','CF-Connecting-IP':'192.0.2.12'},body:JSON.stringify(b)});
 for(const override of [{GA_ANALYTICS_ENABLED:'false'},{LEGAL_APPROVED:'false'},{GA_API_SECRET:''},{GA_MEASUREMENT_ID:'bad'}])assert.equal((await receiveAnalytics(request(event),{...env,...override})).status,204);
 assert.equal(sent.length,0);
 assert.equal((await receiveAnalytics(request({...event,consent:false}),env)).status,204);assert.equal(sent.length,0);
 for(const invalid of [{...event,page:'/atendimento'},{...event,page:'/loja?q=private'},{...event,email:'never@example.test'},{...event,clientId:'account-id'}])await assert.rejects(receiveAnalytics(request(invalid),env),e=>e.status===400);
 assert.equal(sent.length,0);
 assert.equal((await receiveAnalytics(request(event),env)).status,204);assert.equal(sent.length,1);
 assert.deepEqual(JSON.parse(sent[0].init.body),{client_id:event.clientId,consent:{ad_user_data:'DENIED',ad_personalization:'DENIED'},events:[{name:'page_view',params:{page_location:'https://lansrry.example/loja',page_title:'Lansrry /loja'}}]});
 assert.deepEqual(sent[0].init.headers,{'Content-Type':'application/json'});
 assert.equal(JSON.stringify(sent).includes('never@example.test'),false);assert.equal(JSON.stringify(sent).includes('192.0.2.12'),false);assert.equal(JSON.stringify(sent).includes('private-browser'),false);
 globalThis.fetch=async()=>{throw new Error('offline');};assert.equal((await receiveAnalytics(request(event),env)).status,204);
 console.log('Analytics: configuração, consentimento, allowlist, minimização e falha opcional verificados (serviço simulado).');
}finally{globalThis.fetch=previous;await rm(dir,{recursive:true,force:true});}
