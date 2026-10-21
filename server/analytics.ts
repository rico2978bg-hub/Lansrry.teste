import {Env,HttpError,configured} from './firebase';
import {bodyJson,rateRequest} from './security';

export const analyticsPages=['/','/loja','/produtos','/servicos','/sobre','/localizacao'];
export function analyticsConfigured(env:Env){return env.LEGAL_APPROVED==='true'&&env.GA_ANALYTICS_ENABLED==='true'&&/^G-[A-Z0-9]{4,20}$/.test(env.GA_MEASUREMENT_ID||'')&&!!env.GA_API_SECRET?.trim();}
export async function receiveAnalytics(req:Request,env:Env):Promise<Response>{
 const empty=()=>new Response(null,{status:204,headers:{'Cache-Control':'no-store'}});
 if(!analyticsConfigured(env))return empty();
 const body=await bodyJson(req,512);
 if(body.consent!==true)return empty();
 if(Object.keys(body).sort().join(',')!=='clientId,consent,page'||typeof body.page!=='string'||!analyticsPages.includes(body.page)||typeof body.clientId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.clientId))throw new HttpError(400,'Evento inválido.');
 let origin:URL;try{origin=new URL(env.SITE_URL||'');if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)throw new Error();}catch{return empty();}
 if(configured(env))await rateRequest(req,env,'analytics',60,60000);
 const payload={client_id:body.clientId.toLowerCase(),consent:{ad_user_data:'DENIED',ad_personalization:'DENIED'},events:[{name:'page_view',params:{page_location:origin.origin+body.page,page_title:'Lansrry '+body.page}}]};
 // Never spread input, incoming headers, user identity, request URL or referrer into provider data.
 const target=new URL('https://www.google-analytics.com/mp/collect');target.searchParams.set('measurement_id',env.GA_MEASUREMENT_ID!);target.searchParams.set('api_secret',env.GA_API_SECRET!);
 try{await fetch(target,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(5000)});}catch{/* Measurement is optional; never retry or affect the shopping flow. */}
 // 204 means only that this endpoint completed. Google receipt/processing requires external validation.
 return empty();
}
