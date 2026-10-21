import {Env,HttpError,configured,docData,documentWrite,transactionDoc,withTransaction} from './firebase';

const encoder=new TextEncoder();
const hex=(data:ArrayBuffer)=>Array.from(new Uint8Array(data),x=>x.toString(16).padStart(2,'0')).join('');
export async function digest(value:string|ArrayBuffer){return hex(await crypto.subtle.digest('SHA-256',typeof value==='string'?encoder.encode(value):value));}
export async function privateKey(env:Env,value:string){
 if(!env.FIREBASE_PRIVATE_KEY)throw new HttpError(503,'A proteção de acesso ainda precisa ser configurada.');
 const key=await crypto.subtle.importKey('raw',encoder.encode(env.FIREBASE_PRIVATE_KEY),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return hex(await crypto.subtle.sign('HMAC',key,encoder.encode(value)));
}
export function requestKey(req:Request){
 const value=req.headers.get('Idempotency-Key')||'';
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))throw new HttpError(400,'Recarregue o formulário e tente novamente.');
 return value.toLowerCase();
}
export function trustedClient(req:Request){
 // Cloudflare supplies this header at ingress. Never trust client-supplied X-Forwarded-For.
 const ip=req.headers.get('cf-connecting-ip')||'';
 return /^[0-9a-f:.]{3,64}$/i.test(ip)?ip.toLowerCase():'unknown';
}
type Limit={bucket:string;subject:string;max:number;period:number};
export async function rateLimits(env:Env,limits:Limit[]){
 if(!configured(env))throw new HttpError(503,'A proteção de acesso ainda precisa ser configurada.');
 const keys=await Promise.all(limits.map(l=>privateKey(env,l.bucket+':'+l.subject)));
 await withTransaction(env,async tx=>{
  const now=Date.now(),writes=[];
  for(let i=0;i<limits.length;i++){
   const l=limits[i],path='securityLimits/'+keys[i],raw=await transactionDoc(env,path,tx),previous=raw?docData(raw):null;
   const active=previous&&previous.resetAt>now;
   const count=active?previous.count:0,resetAt=active?previous.resetAt:now+l.period;
   if(count>=l.max)throw new HttpError(429,'Muitas tentativas. Aguarde antes de tentar novamente.',Math.max(1,Math.ceil((resetAt-now)/1000)));
   const write=documentWrite(env,path,{count:count+1,resetAt},raw);
   write.update.fields.expiresAt={timestampValue:new Date(resetAt+86400000).toISOString()};
   writes.push(write);
  }
  return {writes,result:undefined};
 });
}
export async function rateRequest(req:Request,env:Env,bucket:string,max:number,period:number,account?:string){
 const limits:Limit[]=[{bucket:bucket+'-ip',subject:trustedClient(req),max,period}];
 if(account)limits.push({bucket:bucket+'-account',subject:account.trim().toLowerCase(),max:8,period:15*60000});
 await rateLimits(env,limits);
}
export async function readBytes(req:Request,max:number){
 const declared=req.headers.get('content-length');
 if(declared&&(!/^\d+$/.test(declared)||Number(declared)>max))throw new HttpError(413,'O envio excedeu o tamanho permitido.');
 const reader=req.body?.getReader();if(!reader)return new Uint8Array();
 const chunks:Uint8Array[]=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel().catch(()=>{});throw new HttpError(413,'O envio excedeu o tamanho permitido.');}chunks.push(value);}}
 finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 return bytes;
}
export async function bodyJson(req:Request,max=32000){
 const bytes=await readBytes(req,max);
 try{const value=JSON.parse(new TextDecoder().decode(bytes));if(!value||typeof value!=='object'||Array.isArray(value))throw new Error();return value;}catch{throw new HttpError(400,'Dados inválidos.');}
}
export async function bodyForm(req:Request,max:number){
 const bytes=await readBytes(req,max);
 try{return await new Response(bytes,{headers:{'Content-Type':req.headers.get('Content-Type')||''}}).formData();}
 catch{throw new HttpError(400,'O formulário não pôde ser lido. Tente novamente.');}
}
