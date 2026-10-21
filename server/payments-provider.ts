import {Env,HttpError} from './firebase';

// No retries for mutations: a timeout may happen after Mercado Pago accepted them.
export async function providerRequest(env:Env,path:string,options:RequestInit={}){
 if(!env.MERCADO_PAGO_ACCESS_TOKEN)throw new HttpError(503,'O Mercado Pago ainda precisa ser configurado.');
 let response:Response,data:any;
 try{response=await fetch('https://api.mercadopago.com'+path,{...options,redirect:'error',signal:AbortSignal.timeout(15000),headers:{Authorization:`Bearer ${env.MERCADO_PAGO_ACCESS_TOKEN}`,'Content-Type':'application/json',...options.headers}});data=await response.json();}
 catch{throw new HttpError(503,'O Mercado Pago não confirmou a operação. A reserva permanece protegida.');}
 if(!response.ok)throw new HttpError(503,'O Mercado Pago não confirmou a operação. A reserva permanece protegida.');
 return data;
}
export async function paymentAccount(env:Env){
 if(!['test','live'].includes(env.PAYMENTS_MODE||'')||!/^\d{1,20}$/.test(env.MERCADO_PAGO_SELLER_ID||'')||!env.MERCADO_PAGO_WEBHOOK_SECRET)throw new HttpError(503,'Configure o modo, vendedor e assinatura de pagamentos.');
 const account=await providerRequest(env,'/users/me');
 const test=Array.isArray(account.tags)&&account.tags.includes('test_user');
 if(String(account.id)!==env.MERCADO_PAGO_SELLER_ID||!Array.isArray(account.tags)||test!==(env.PAYMENTS_MODE==='test'))throw new HttpError(503,'A conta Mercado Pago não corresponde ao vendedor e ao modo configurados.');
 return account;
}
export async function searchOrderPayments(env:Env,id:string){
 const results:any[]=[];
 // Bounded, complete pagination; exceeding the bound is uncertainty, never permission to release.
 for(let offset=0;offset<100;offset+=50){
  const page=await providerRequest(env,`/v1/payments/search?external_reference=${encodeURIComponent(id)}&limit=50&offset=${offset}&sort=date_created&criteria=asc`);
  if(!Array.isArray(page.results)||!Number.isSafeInteger(page.paging?.total)||page.paging.total<0)throw new HttpError(503,'A consulta de pagamentos ficou incompleta.');
  results.push(...page.results);
  if(results.length>=page.paging.total){
   if(results.length!==page.paging.total||new Set(results.map(p=>String(p.id))).size!==results.length)throw new HttpError(503,'A consulta de pagamentos ficou inconsistente.');
   // A search snapshot may lag behind a recent refund/cancellation; read each resource again.
   const confirmed=[];for(const p of results)confirmed.push(await providerRequest(env,'/v1/payments/'+encodeURIComponent(String(p.id))));return confirmed;
  }
  if(page.results.length!==50)throw new HttpError(503,'A consulta de pagamentos ficou incompleta.');
 }
 throw new HttpError(503,'Há muitos pagamentos para conciliação automática. Confira no Mercado Pago.');
}
export async function closePreference(env:Env,order:any){
 if(!order.preferenceId)throw new HttpError(409,'A preferência não foi confirmada. Confira o pedido no Mercado Pago; a reserva foi mantida.');
 const endpoint='/checkout/preferences/'+encodeURIComponent(String(order.preferenceId));
 const validate=(p:any)=>{if(String(p.id)!==String(order.preferenceId)||p.external_reference!==order.id||String(p.collector_id)!==String(order.sellerId))throw new HttpError(409,'A preferência não corresponde ao pedido.');return p;};
 let preference=validate(await providerRequest(env,endpoint));
 const closed=(p:any)=>p.expires===true&&Number.isFinite(Date.parse(p.expiration_date_to))&&Date.parse(p.expiration_date_to)<=Date.now();
 if(!closed(preference)){
  const end=new Date(Date.now()-1000).toISOString();
  await providerRequest(env,endpoint,{method:'PUT',body:JSON.stringify({expires:true,expiration_date_from:new Date(Math.min(Date.parse(order.createdAt)||Date.now()-60000,Date.now()-60000)).toISOString(),expiration_date_to:end})});
  preference=validate(await providerRequest(env,endpoint));
 }
 if(!closed(preference))throw new HttpError(409,'O Mercado Pago ainda não confirmou o fechamento da preferência.');
 return preference;
}
