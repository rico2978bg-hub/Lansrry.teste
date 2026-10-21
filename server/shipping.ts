import {Env,HttpError} from './firebase';
export async function shipping(env:Env,cep:string,items:any[]=[]){
 if(!env.SHIPPING_QUOTE_URL)return {cep,amount:18.90,simulated:true,label:'Simulação sem transportadora ou prazo de entrega.'};
 const endpoint=new URL(env.SHIPPING_QUOTE_URL);if(endpoint.protocol!=='https:')throw new HttpError(503,'O serviço de frete precisa usar HTTPS.');
 const r=await fetch(endpoint,{method:'POST',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/json',...(env.SHIPPING_API_KEY?{Authorization:`Bearer ${env.SHIPPING_API_KEY}`}:{})},body:JSON.stringify({fromCep:'92702470',toCep:cep,items})});
 if(!r.ok)throw new HttpError(503,'O cálculo de frete está indisponível.');
 const d=await r.json() as any;
 if(!Number.isFinite(d.amount)||d.amount<0||typeof d.label!=='string')throw new HttpError(503,'O serviço de frete retornou um valor inválido.');
 return {cep,amount:Math.round(d.amount*100)/100,label:d.label,simulated:false};
}
