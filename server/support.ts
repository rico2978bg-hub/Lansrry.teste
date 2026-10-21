import {Env,HttpError,configured,docData,documentWrite,transactionDoc,withTransaction} from './firebase';
import {bodyJson,digest,rateRequest,requestKey} from './security';
import {auditWrite} from './audit';

const field=(value:any,max:number,required=true)=>{if(typeof value!=='string'||value.trim().length>max||(required&&!value.trim()))throw new HttpError(400,'Confira os campos do atendimento.');return value.trim();};
export async function receiveSupport(req:Request,env:Env){
 if(!configured(env))throw new HttpError(503,'O atendimento pelo formulário aguarda configuração. Use os canais de contato.');
 if(!env.PRIVACY_POLICY_TEXT)throw new HttpError(503,'O atendimento aguarda a política de privacidade oficial.');
 const key=requestKey(req);
 await rateRequest(req,env,'support',6,60000);
 const b=await bodyJson(req,14000);
 if(b.company)throw new HttpError(400,'Não foi possível registrar. Use os canais de contato.');
 const name=field(b.name,100),email=field(b.email,150).toLowerCase(),message=field(b.message,5000),orderId=field(b.orderId||'',100,false);
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!['atendimento','devolucao'].includes(b.type))throw new HttpError(400,'Confira o e-mail e o tipo de solicitação.');
 const data={name,email,message,orderId,type:b.type},requestHash=await digest(JSON.stringify(data));
 const id='AT-'+await digest(JSON.stringify([env.FIREBASE_PROJECT_ID,'support',key]));
 return withTransaction(env,async tx=>{
  const raw=await transactionDoc(env,'supportRequests/'+id,tx);
  if(raw){const previous=docData(raw);if(previous.requestHash!==requestHash)throw new HttpError(409,'Este envio já foi usado com outros dados.');return {writes:[],result:{id,protocol:previous.protocol,createdAt:previous.createdAt,confirmation:'registered'}};}
  const createdAt=new Date().toISOString(),protocol='LAN-'+crypto.randomUUID().toUpperCase();
  const record={...data,requestHash,protocol,createdAt,updatedAt:createdAt,status:'open'};
  return {writes:[documentWrite(env,'supportRequests/'+id,record,null)],result:{id,protocol,createdAt,confirmation:'registered'}};
 });
}
export async function updateSupport(env:Env,id:string,b:any,actor:string){
 if(!/^AT-[a-f0-9]{64}$/.test(id)||!['open','in_progress','closed'].includes(b.status))throw new HttpError(400,'Solicitação ou situação inválida.');
 return withTransaction(env,async tx=>{
  const raw=await transactionDoc(env,'supportRequests/'+id,tx);
  if(!raw)throw new HttpError(404,'Atendimento não encontrado.');
  if(typeof b.version!=='string'||raw.updateTime!==b.version)throw new HttpError(409,'Este atendimento mudou. Atualize o painel.');
  const current=docData(raw);
  return {writes:[documentWrite(env,'supportRequests/'+id,{...current,status:b.status,updatedAt:new Date().toISOString()},raw),auditWrite(env,actor,'support.status.'+b.status,id)],result:{ok:true}};
 });
}
