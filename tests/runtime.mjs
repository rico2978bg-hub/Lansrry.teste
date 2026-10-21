import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
const base='https://lansrry.test';
const request=(p,method='GET',body,headers={})=>new Request(base+p,{method,headers:{...headers,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
try{
 const routes=['/','/produtos','/loja','/servicos','/sobre','/orcamento','/contato','/localizacao','/privacidade','/carrinho','/checkout','/conta','/admin','/produto/demo-filamento-azul'];
 const titles=new Set();
 for(const p of routes){const r=await worker.fetch(request(p),{});assert.equal(r.status,200,p);const html=await r.text();assert.equal((html.match(/<h1(?:\s|>)/g)||[]).length,1,p+' has one h1');assert.ok(html.includes('<html lang="pt-BR">'));assert.ok(html.includes('rel="canonical"'));const title=html.match(/<title>(.*?)<\/title>/)[1];assert.ok(!titles.has(title),'unique title for '+p);titles.add(title);}
 const home=await(await worker.fetch(request('/'),{})).text();assert.ok(home.includes('Rua São Geraldo, 489'));assert.ok(home.includes('Lansrry@gmail.com'));assert.ok(!home.includes('AggregateRating'));assert.ok(home.includes('DEMO'));
 const links=[...home.matchAll(/href="(\/[^"#]*)"/g)].map(x=>x[1].replaceAll('&amp;','&'));
 for(const p of new Set(links)){const r=await worker.fetch(request(p),{});assert.ok(r.status<400,'Internal link '+p);}
 assert.equal((await worker.fetch(request('/nao-existe'),{})).status,404);
 const sitemap=await(await worker.fetch(request('/sitemap.xml'),{})).text();assert.ok(!sitemap.includes('demo-filamento'));assert.ok(!sitemap.includes('/admin'));assert.ok(!sitemap.includes('/privacidade'));
 const robots=await(await worker.fetch(request('/robots.txt'),{})).text();assert.ok(robots.includes('Disallow: /admin'));assert.ok(robots.includes('Sitemap:'));
 let r=await worker.fetch(request('/api/shipping','POST',{cep:'123'}),{});assert.equal(r.status,400);
 r=await worker.fetch(request('/api/shipping','POST',{cep:'92702-470'}),{});const quote=await r.json();assert.equal(r.status,200);assert.equal(quote.simulated,true);assert.equal(quote.amount,18.9);assert.equal(quote.cep,'92702470');
 r=await worker.fetch(request('/api/shipping','POST',{cep:'92702-470'},{Origin:'https://other.example'}),{});assert.equal(r.status,403);
 for(const p of ['/api/admin/orders','/api/admin/quotes','/api/admin/quotes/id/file'])assert.equal((await worker.fetch(request(p),{})).status,401,p+' is protected');
 assert.equal((await worker.fetch(request('/api/orders'),{})).status,401);
 assert.equal((await worker.fetch(request('/api/orders','POST',{items:[]}),{})).status,503);
 assert.equal((await worker.fetch(request('/api/media?name=quotes/private'),{})).status,404);
 const injected=await(await worker.fetch(request('/loja?q=%3Cscript%3Ealert(1)%3C%2Fscript%3E'),{})).text();assert.ok(!injected.includes('<script>alert(1)</script>'));
 for(const p of ['/favicon.ico','/assets/app.css','/assets/app.js','/assets/logo.png','/assets/og-lansrry.png','/guia','/llms.txt'])assert.equal((await worker.fetch(request(p),{})).status,200,p);
 console.log('Verificação concluída: SSR, metadados, links, arquivos, CEP, simulação, origem e acesso privado.');
 process.exit(0);
}catch(e){console.error(e);process.exit(1);}
