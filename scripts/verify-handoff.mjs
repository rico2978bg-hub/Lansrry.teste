import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {inflateRawSync} from 'node:zlib';
import {spawn} from 'node:child_process';
import {sourceArchive} from './source-archive.mjs';

// Extract the exact generated ZIP rather than copying a working tree that may
// accidentally supply dependencies or ignored build products.
const scratch=path.resolve('work');await fs.mkdir(scratch,{recursive:true});
const temporary=await fs.mkdtemp(path.join(scratch,'lansrry-clean-'));
const archive=path.join(temporary,'lansrry-fonte.zip');
const source=path.join(temporary,'lansrry');
const npm=process.env.npm_execpath;
if(!npm)throw new Error('Execute npm run verify:handoff para usar o npm desta instalação.');
async function exists(file){return fs.access(file).then(()=>true,()=>false);}
async function run(args){
 console.log('\nVerificação em cópia limpa: npm '+args.join(' '));
 const code=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[npm,...args],{cwd:source,stdio:'inherit',env:{...process.env,APP_MODE:'',CHECKOUT_ENABLED:'false'}});child.once('error',reject);child.once('exit',resolve);});
 if(code!==0)throw new Error('Falhou: npm '+args.join(' ')+' (código '+code+').');
}
try{
 await sourceArchive(archive,{includeSites:false});
 const bytes=await fs.readFile(archive);let offset=0,count=0;
 while(bytes.readUInt32LE(offset)===0x04034b50){
  const method=bytes.readUInt16LE(offset+8),compressed=bytes.readUInt32LE(offset+18),size=bytes.readUInt32LE(offset+22),nameLength=bytes.readUInt16LE(offset+26),extraLength=bytes.readUInt16LE(offset+28);
  const name=bytes.subarray(offset+30,offset+30+nameLength).toString('utf8');
  assert.ok(name.startsWith('lansrry/')&&!name.includes('\\')&&!name.split('/').includes('..'),'Nome ZIP seguro e portátil');
  const target=path.resolve(temporary,...name.split('/'));
  assert.ok(target.startsWith(temporary+path.sep));
  const start=offset+30+nameLength+extraLength;
  assert.equal(method,8,'O arquivo gerado usa DEFLATE');
  const output=inflateRawSync(bytes.subarray(start,start+compressed));assert.equal(output.length,size);
  await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,output);
  offset=start+compressed;count++;
 }
 assert.ok(count>30,'Fonte completa extraída');
 for(const file of ['.openai','.git','dist','node_modules','server/generated-assets.ts','server/generated-guide.ts'])assert.equal(await exists(path.join(source,file)),false,'O pacote não deve trazer '+file);
 await run(['ci','--no-audit','--no-fund']);
 await run(['run','typecheck']);
 await run(['test']); // pretest generates both independent targets from scratch.
 assert.equal(await exists(path.join(source,'.openai')),false,'O build não inventa identidade Sites');
 assert.equal(await exists(path.join(source,'dist','.openai')),false,'O build independente não exige manifest Sites');
 await run(['run','package:handoff']);
 console.log('\nPacote independente aprovado: instalação, TypeScript, dois builds, testes e reempacotamento sem .openai ou artefatos prévios. Não testa serviços reais.');
 await fs.rm(temporary,{recursive:true,force:true});
}catch(error){
 console.error('Cópia preservada para diagnóstico em '+temporary);
 throw error;
}
