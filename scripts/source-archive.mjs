import fs from 'node:fs/promises';
import path from 'node:path';
import {deflateRawSync} from 'node:zlib';
const crcTable=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=(n&1)?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc(buf){let c=0xffffffff;for(const x of buf)c=crcTable[(c^x)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
export async function sourceArchive(dest,{includeSites=true,rootDir='.'}={}){
 const hasSites=includeSites&&await fs.access(path.join(rootDir,'.openai','hosting.json')).then(()=>true,error=>{if(error.code==='ENOENT')return false;throw error;});
 const roots=['src','server','scripts','docs','tests','public','cloudflare',...(hasSites?['.openai']:[])];
 const files=['README.md','package.json','package-lock.json','tsconfig.json','.env.example','.gitignore','firebase.json','firestore.rules','storage.rules','company.secrets.example.json'];
 async function walk(dir){for(const f of await fs.readdir(path.join(rootDir,dir),{withFileTypes:true})){
  // ZIP member names always use '/', including when built on Windows.
  const p=path.posix.join(dir,f.name);
  if(f.isSymbolicLink()||['node_modules','.wrangler','screenshots','downloads'].includes(f.name)||(/^(\.env(?:\..*)?|\.dev\.vars(?:\..*)?)$/i.test(f.name)&&f.name!=='.env.example')||/\.(secrets\.json|pem|key|p12|pfx)$/i.test(f.name)||p.endsWith('generated-assets.ts')||p.endsWith('generated-guide.ts'))continue;
  if(f.isDirectory())await walk(p);else files.push(p);
 }}
 for(const d of roots)await walk(d);
 let offset=0;const parts=[],central=[];
 for(const p of files.sort()){
  const name=Buffer.from('lansrry/'+p),bytes=await fs.readFile(path.join(rootDir,p)),compressed=deflateRawSync(bytes),checksum=crc(bytes);
  if(p.endsWith('.json')){let data;try{data=JSON.parse(bytes.toString('utf8'));}catch{}if(data&&(data.type==='service_account'||data.private_key||data.FIREBASE_PRIVATE_KEY))throw new Error('Remova arquivos de credenciais da pasta de fonte antes de empacotar.');}
  const header=Buffer.alloc(30);header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(0x800,6);header.writeUInt16LE(8,8);header.writeUInt32LE(checksum,14);header.writeUInt32LE(compressed.length,18);header.writeUInt32LE(bytes.length,22);header.writeUInt16LE(name.length,26);parts.push(header,name,compressed);
  const entry=Buffer.alloc(46);entry.writeUInt32LE(0x02014b50);entry.writeUInt16LE(20,4);entry.writeUInt16LE(20,6);entry.writeUInt16LE(0x800,8);entry.writeUInt16LE(8,10);entry.writeUInt32LE(checksum,16);entry.writeUInt32LE(compressed.length,20);entry.writeUInt32LE(bytes.length,24);entry.writeUInt16LE(name.length,28);entry.writeUInt32LE(offset,42);central.push(entry,name);offset+=header.length+name.length+compressed.length;
 }
 const centralBytes=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(centralBytes.length,12);end.writeUInt32LE(offset,16);
 await fs.mkdir(path.dirname(dest),{recursive:true});await fs.writeFile(dest,Buffer.concat([...parts,centralBytes,end]));
}
