import fs from 'node:fs/promises';
import {build} from 'esbuild';
import {pathToFileURL} from 'node:url';

let validator;
export async function configurationProblems(env){
 if(!env||Array.isArray(env)||typeof env!=='object'||Object.values(env).some(v=>typeof v!=='string'))return ['Valores de configuração devem ser strings'];
 if(!validator){
  const compiled=await build({entryPoints:['server/deployment.ts'],bundle:true,write:false,platform:'browser',format:'esm',target:'es2022'});
  validator=(await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].contents).toString('base64'))).productionProblems;
 }
 const missing=validator(env),pem=(env.FIREBASE_PRIVATE_KEY||'').replaceAll('\\n','\n');
 if(!pem.includes('-----BEGIN PRIVATE KEY-----')||!pem.includes('-----END PRIVATE KEY-----'))missing.push('Formato da chave privada');
 return [...new Set(missing)];
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const file=process.argv[2]||'company.secrets.json';
 let env;
 try{env=JSON.parse(await fs.readFile(file,'utf8'));}catch{console.error('Não foi possível ler o arquivo de configuração privada. Use o formato do company.secrets.example.json.');process.exit(1);}
 const missing=await configurationProblems(env);
 if(missing.length){console.error('Revise a configuração: '+missing.join(', ')+'. Nenhum valor secreto foi exibido.');process.exit(1);}
 console.log('Formato da configuração aprovado. Compra '+(env.CHECKOUT_ENABLED==='true'?'habilitada':'bloqueada')+'; pagamento em '+(env.PAYMENTS_MODE==='live'?'produção':'teste')+'. Esta verificação não valida contas externas nem substitui a homologação.');
}
