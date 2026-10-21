import {parseQuoteContact,quoteContactError} from '../src/quote-contact';
import {Env,HttpError,configured,docData,documentWrite,transactionDoc,uploadFile,withTransaction} from './firebase';
import {bodyForm,digest,rateRequest,requestKey} from './security';
import {validateUpload} from './uploads';

function text(value:FormDataEntryValue|null,max:number,required=true){
 if(typeof value!=='string'||value.trim().length>max||(required&&!value.trim()))throw new HttpError(400,'Confira os campos obrigatórios do formulário.');
 return value.trim();
}
let activeQuotes=0;
export async function receiveQuote(req:Request,env:Env){
 // Bound multipart memory in each Worker; the persistent limiter below also covers other Workers.
 if(activeQuotes>=1)throw new HttpError(429,'O formulário está ocupado por instantes. Tente novamente.',5);
 activeQuotes++;
 try{return await receiveQuoteRequest(req,env);}finally{activeQuotes--;}
}
async function receiveQuoteRequest(req:Request,env:Env){
 if(!configured(env))throw new HttpError(503,'Use o formulário de demonstração ou converse pelo WhatsApp.');
 if(!env.PRIVACY_POLICY_TEXT)throw new HttpError(503,'O formulário real aguarda a política de privacidade oficial.');
 const key=requestKey(req);
 await rateRequest(req,env,'quote',10,60000);
 const form=await bodyForm(req,11*1024*1024);
 if(form.get('website'))return {id:'IGNORED'};
 const name=text(form.get('name'),100),contact=text(form.get('contact'),100),description=text(form.get('description'),4000),need=text(form.get('need'),100);
 const reply=parseQuoteContact(text(form.get('email')||'',150,false));
 if(!reply)throw new HttpError(400,quoteContactError);
 const instagram=text(form.get('instagram')||reply.instagram,100,false);
 if(instagram&&!parseQuoteContact(instagram)?.instagram)throw new HttpError(400,quoteContactError);
 const reference=form.get('reference');
 const file=reference instanceof File&&reference.size?await validateUpload(reference,'reference'):null;
 if(file&&(file.size>10*1024*1024||!/\.(stl|png|jpe?g|webp|pdf)$/i.test(file.name)))throw new HttpError(400,'Envie STL, PNG, JPG, WEBP ou PDF de até 10 MB.');
 const data={name,contact,email:reply.email,instagram,description,need};
 const fileInfo=file?{name:file.name.slice(0,150),size:file.size,type:file.type,hash:await digest(await file.arrayBuffer())}:null;
 const requestHash=await digest(JSON.stringify({data,file:fileInfo}));
 const id='Q-'+await digest(JSON.stringify([env.FIREBASE_PROJECT_ID,'quote',key])),path='quotes/'+id;
 const owner=await withTransaction(env,async tx=>{
  const raw=await transactionDoc(env,path,tx);
  if(raw){
   const previous=docData(raw);
   if(previous.requestHash!==requestHash)throw new HttpError(409,'Esta solicitação já foi usada com outros dados. Crie uma nova solicitação.');
   if(previous.status==='processing')throw new HttpError(409,'Seu orçamento já está sendo registrado. Aguarde alguns segundos e tente novamente.',5);
   return {writes:[],result:false};
  }
  const record={...data,createdAt:new Date().toISOString(),requestHash,status:file?'processing':'received',file:null,attachmentPending:!!file,attachmentName:fileInfo?.name||''};
  return {writes:[documentWrite(env,path,record,null)],result:true};
 });
 if(owner&&file){
  let attachment:{name:string;path:string}|null=null;
  try{const storagePath=`quotes/${id}/reference`;await uploadFile(env,storagePath,file);attachment={name:fileInfo!.name,path:storagePath};}
  catch{/* The quote is already recorded; clearly mark the missing attachment instead of duplicating it. */}
  await withTransaction(env,async tx=>{
   const raw=await transactionDoc(env,path,tx);
   if(!raw)throw new HttpError(503,'Não foi possível confirmar seu orçamento. Tente novamente com os mesmos dados.');
   const current=docData(raw);
   if(current.requestHash!==requestHash)throw new HttpError(409,'Os dados da solicitação foram alterados.');
   return {writes:[documentWrite(env,path,{...current,status:'received',file:attachment,attachmentPending:!attachment},raw)],result:undefined};
  });
 }
 const record=await withTransaction(env,async tx=>{const raw=await transactionDoc(env,path,tx);if(!raw)throw new HttpError(503,'Não foi possível confirmar seu orçamento.');return {writes:[],result:docData(raw)};});
 return {id,attachmentPending:!!record.attachmentPending};
}
