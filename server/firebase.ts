export type Env={APP_MODE?:string;CHECKOUT_ENABLED?:string;FIREBASE_PROJECT_ID?:string;FIREBASE_API_KEY?:string;FIREBASE_CLIENT_EMAIL?:string;FIREBASE_PRIVATE_KEY?:string;FIREBASE_STORAGE_BUCKET?:string;ADMIN_UIDS?:string;MERCADO_PAGO_ACCESS_TOKEN?:string;MERCADO_PAGO_WEBHOOK_SECRET?:string;MERCADO_PAGO_SELLER_ID?:string;RESERVATION_MINUTES?:string;RESERVATION_AUTO_RELEASE?:string;PAYMENTS_MODE?:string;SHIPPING_QUOTE_URL?:string;SHIPPING_API_KEY?:string;SITE_URL?:string;PRIVACY_POLICY_TEXT?:string;OFFICIAL_BANNER_URL?:string;LEGAL_APPROVED?:string;TERMS_TEXT?:string;RETURNS_POLICY_TEXT?:string;LEGAL_CONTROLLER_NAME?:string;LEGAL_CONTROLLER_DOCUMENT?:string;PRIVACY_CONTACT?:string;DATA_RETENTION_POLICY?:string;GA_MEASUREMENT_ID?:string;GA_API_SECRET?:string;GA_ANALYTICS_ENABLED?:string;ASSETS?:any};
export const configured=(env:Env)=>!!(env.FIREBASE_PROJECT_ID&&env.FIREBASE_API_KEY&&env.FIREBASE_CLIENT_EMAIL&&env.FIREBASE_PRIVATE_KEY);
export class HttpError extends Error{constructor(public status:number,message:string,public retryAfter?:number,public retryable=false){super(message)}}
const b64=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
let tokenCache:{identity:string;token:string;expires:number}|null=null;
const pendingTokens=new Map<string,Promise<string>>();
export async function serviceToken(env:Env){
 if(!configured(env))throw new HttpError(503,'A integração de dados ainda precisa ser configurada.');
 const identity=env.FIREBASE_CLIENT_EMAIL+'\0'+env.FIREBASE_PRIVATE_KEY;
 if(tokenCache&&tokenCache.identity===identity&&tokenCache.expires>Date.now()+60000)return tokenCache.token;
 if(pendingTokens.has(identity))return pendingTokens.get(identity)!;
 const pending=(async()=>{
  const now=Math.floor(Date.now()/1000),enc=new TextEncoder(),encode=(o:any)=>b64(enc.encode(JSON.stringify(o)));
  const input=encode({alg:'RS256',typ:'JWT'})+'.'+encode({iss:env.FIREBASE_CLIENT_EMAIL,scope:'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/devstorage.read_write',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
  const pem=env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g,'\n').replace(/-----[^-]+-----/g,'').replace(/\s/g,'');
  const key=await crypto.subtle.importKey('pkcs8',Uint8Array.from(atob(pem),c=>c.charCodeAt(0)),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
  const signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,enc.encode(input));
  let r:Response;try{r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:input+'.'+b64(new Uint8Array(signature))})});}catch{throw new HttpError(503,'Não foi possível conectar ao banco de dados.');}
  const data=await r.json() as any;
  if(!r.ok||typeof data.access_token!=='string'||!Number.isFinite(data.expires_in))throw new HttpError(503,'Não foi possível conectar ao banco de dados.');
  tokenCache={identity,token:data.access_token,expires:Date.now()+data.expires_in*1000};return data.access_token as string;
 })();
 pendingTokens.set(identity,pending);
 try{return await pending;}finally{pendingTokens.delete(identity);}
}
export function pack(v:any):any{if(v===null||v===undefined)return {nullValue:null};if(typeof v==='string')return {stringValue:v};if(typeof v==='boolean')return {booleanValue:v};if(typeof v==='number')return Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v};if(Array.isArray(v))return {arrayValue:{values:v.map(pack)}};return {mapValue:{fields:Object.fromEntries(Object.entries(v).filter(([,x])=>x!==undefined).map(([k,x])=>[k,pack(x)]))}};}
export function unpack(v:any):any{if('stringValue'in v)return v.stringValue;if('integerValue'in v)return Number(v.integerValue);if('doubleValue'in v)return v.doubleValue;if('booleanValue'in v)return v.booleanValue;if('arrayValue'in v)return(v.arrayValue.values||[]).map(unpack);if('mapValue'in v)return Object.fromEntries(Object.entries(v.mapValue.fields||{}).map(([k,x])=>[k,unpack(x)]));return null;}
export const fields=(o:any)=>pack(o).mapValue.fields;
export const docData=(doc:any):any=>({...Object.fromEntries(Object.entries(doc.fields||{}).map(([k,v])=>[k,unpack(v)])),id:doc.name?.split('/').pop()});
export const dbBase=(env:Env)=>`https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
export const docName=(env:Env,path:string)=>`projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${path}`;
export async function dbFetch(env:Env,path:string,options:RequestInit={}){
 let r:Response;try{r=await fetch(dbBase(env)+path,{...options,signal:options.signal||AbortSignal.timeout(15000),headers:{Authorization:`Bearer ${await serviceToken(env)}`,'Content-Type':'application/json',...options.headers}});}catch{throw new HttpError(503,'Não foi possível acessar os dados da loja. Tente novamente.');}
 let data:any;try{data=r.status===204?{}:await r.json();}catch{throw new HttpError(503,'O banco de dados não confirmou a operação.');}
 if(!r.ok){
  if(r.status===404)throw new HttpError(404,'Registro não encontrado.');
  const code=data.error?.status;
  if(code==='ABORTED'||(path===':commit'&&code==='ALREADY_EXISTS'))throw new HttpError(409,'Os dados foram atualizados. Recarregue e tente novamente.',undefined,true);
  if(path===':commit'&&code==='FAILED_PRECONDITION')throw new HttpError(409,'Os dados foram atualizados. Recarregue e tente novamente.');
  throw new HttpError(503,'Não foi possível acessar os dados da loja.');
 }
 return data;
}
export async function listDocs(env:Env,collection:string){let next='',docs:any[]=[];do{const r=await dbFetch(env,`/${collection}?pageSize=100${next?'&pageToken='+encodeURIComponent(next):''}`);docs.push(...(r.documents||[]).map((d:any)=>({...docData(d),...(['products','supportRequests'].includes(collection)?{version:d.updateTime}:{})})));next=r.nextPageToken||'';}while(next);return docs;}
export const getDoc=async(env:Env,path:string)=>docData(await dbFetch(env,'/'+path));
export async function putDoc(env:Env,path:string,data:any){return dbFetch(env,'/'+path,{method:'PATCH',body:JSON.stringify({fields:fields(data)})});}
export function cookies(req:Request){const result:Record<string,string>={};for(const entry of (req.headers.get('cookie')||'').split(';')){const i=entry.indexOf('=');if(i<1)continue;try{result[entry.slice(0,i).trim()]=decodeURIComponent(entry.slice(i+1));}catch{}}return result;}
export async function userFromRequest(req:Request,env:Env){if(!env.FIREBASE_API_KEY)return null;const token=cookies(req).lansrry_session;if(!token)return null;const r=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${env.FIREBASE_API_KEY}`,{method:'POST',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:token})});if(!r.ok)return null;const d=await r.json() as any;const u=d.users?.[0];if(!u||u.disabled)return null;return {uid:u.localId,email:u.email||'',admin:(env.ADMIN_UIDS||'').split(',').map(x=>x.trim()).includes(u.localId)};}
export async function requireUser(req:Request,env:Env,admin=false){const u=await userFromRequest(req,env);if(!u)throw new HttpError(401,'Entre na sua conta para continuar.');if(admin&&!u.admin)throw new HttpError(403,'Sua conta não tem acesso ao painel administrativo.');return u;}
export async function uploadFile(env:Env,path:string,file:File){if(!env.FIREBASE_STORAGE_BUCKET)throw new HttpError(503,'O armazenamento de arquivos ainda precisa ser configurado.');const r=await fetch(`https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(env.FIREBASE_STORAGE_BUCKET)}/o?uploadType=media&ifGenerationMatch=0&name=${encodeURIComponent(path)}`,{method:'POST',signal:AbortSignal.timeout(30000),headers:{Authorization:`Bearer ${await serviceToken(env)}`,'Content-Type':file.type||'application/octet-stream'},body:await file.arrayBuffer()});if(r.status===412)return path;if(!r.ok)throw new HttpError(503,'Não foi possível salvar o arquivo.');return path;}

export async function transactionDoc(env:Env,path:string,transaction:string){
 try{return await dbFetch(env,`/${path}?transaction=${encodeURIComponent(transaction)}`);}
 catch(e){if(e instanceof HttpError&&e.status===404)return null;throw e;}
}
export async function withTransaction<T>(env:Env,work:(transaction:string)=>Promise<{writes:any[];result:T}>):Promise<T>{
 for(let attempt=0;attempt<8;attempt++){
  const {transaction}=await dbFetch(env,':beginTransaction',{method:'POST',body:'{}'});
  try{
   const {writes,result}=await work(transaction);
   if(writes.length)await dbFetch(env,':commit',{method:'POST',body:JSON.stringify({transaction,writes})});
   else await dbFetch(env,':rollback',{method:'POST',body:JSON.stringify({transaction})});
   return result;
  }catch(e){
   await dbFetch(env,':rollback',{method:'POST',body:JSON.stringify({transaction})}).catch(()=>{});
   if(e instanceof HttpError&&e.retryable&&attempt<7){await new Promise(r=>setTimeout(r,Math.min(250,10*2**attempt)+Math.random()*20));continue;}
   throw e;
  }
 }
 throw new HttpError(503,'Não foi possível concluir agora. Tente novamente.');
}
export const documentWrite=(env:Env,path:string,data:any,raw:any|null)=>({update:{name:docName(env,path),fields:fields(data)},currentDocument:raw?{updateTime:raw.updateTime}:{exists:false}});
export async function downloadFile(env:Env,path:string){const r=await fetch(`https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(env.FIREBASE_STORAGE_BUCKET!)}/o/${encodeURIComponent(path)}?alt=media`,{signal:AbortSignal.timeout(15000),headers:{Authorization:`Bearer ${await serviceToken(env)}`}});if(!r.ok)throw new HttpError(404,'Arquivo não encontrado.');return r;}
