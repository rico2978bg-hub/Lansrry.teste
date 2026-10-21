import {business,Product} from '../src/data';
import {Env,HttpError,dbFetch,docData,documentWrite,getDoc,requireUser,transactionDoc,withTransaction} from './firebase';
import {digest,rateLimits,requestKey,trustedClient} from './security';
import {shipping} from './shipping';
import {paymentAccount,providerRequest,searchOrderPayments,closePreference} from './payments-provider';

const text=(value:any,max:number)=>{if(typeof value!=='string'||!value.trim()||value.trim().length>max)throw new HttpError(400,'Confira os dados do pedido.');return value.trim();};
const safeId=(id:any)=>{if(typeof id!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(id))throw new HttpError(400,'Identificador inválido.');return id;};
const cepValue=(value:any)=>{const cep=String(value||'').replace(/\D/g,'');if(cep.length!==8)throw new HttpError(400,'Informe um CEP com 8 dígitos.');return cep;};
function priorOrder(order:any,hash:string){
 if(order.requestHash!==hash)throw new HttpError(409,'Este pedido já foi iniciado com outros dados. Confira Minha conta antes de criar um novo pedido.');
 if(order.released||order.closureRequestedAt||Date.parse(order.expiresAt)<=Date.now()||['paid','paid_review_required','refund_review_required','dispute_review_required'].includes(order.status))return {...order,checkoutUrl:undefined};
 if(order.checkoutState==='creating'||order.checkoutState==='review_required')throw new HttpError(409,'Este pedido já foi registrado e o pagamento aguarda confirmação. Confira Minha conta ou fale com a Lansrry antes de tentar novamente.',5);
 return order;
}
export async function reserveOrder(req:Request,env:Env,b:any){
 const user=await requireUser(req,env),key=requestKey(req);
 if(!env.PRIVACY_POLICY_TEXT)throw new HttpError(503,'A loja aguarda a política de privacidade oficial.');
 if(!Array.isArray(b.items)||!b.items.length||b.items.length>100)throw new HttpError(400,'O carrinho está vazio ou inválido.');
 const customer={name:text(b.customer?.name,100),email:text(b.customer?.email,150),phone:text(b.customer?.phone,20),address:text(b.customer?.address,160),city:text(b.customer?.city,120),cep:cepValue(b.customer?.cep)};
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email))throw new HttpError(400,'Informe um e-mail válido.');
 const cep=cepValue(b.cep);if(customer.cep!==cep)throw new HttpError(400,'O CEP calculado precisa ser igual ao CEP de entrega.');
 const counts=new Map<string,{id:string;variant:string;qty:number}>();
 for(const item of b.items){
  const id=safeId(item.id),variant=item.variant?safeId(item.variant):'';
  if(!Number.isInteger(item.qty)||item.qty<1||item.qty>1000)throw new HttpError(400,'Quantidade inválida.');
  const itemKey=id+':'+variant,qty=(counts.get(itemKey)?.qty||0)+item.qty;
  if(qty>1000)throw new HttpError(400,'Quantidade inválida.');
  counts.set(itemKey,{id,variant,qty});
 }
 const items=[...counts.values()].sort((a,b)=>(a.id+':'+a.variant).localeCompare(b.id+':'+b.variant));
 const hash=await digest(JSON.stringify({customer,items,cep}));
 const id='ORD-'+await digest(JSON.stringify([env.FIREBASE_PROJECT_ID,'order',user.uid,key])),path='orders/'+id;
 await rateLimits(env,[{bucket:'checkout-ip',subject:trustedClient(req),max:20,period:60000},{bucket:'checkout-user',subject:user.uid,max:20,period:60000}]);
 let previous:any;
 try{previous=await getDoc(env,path);}catch(e){if(!(e instanceof HttpError)||e.status!==404)throw e;}
 if(previous)return priorOrder(previous,hash);
 const live=env.PAYMENTS_MODE==='live';
 const account=await paymentAccount(env);
 if(live&&!env.SHIPPING_QUOTE_URL)throw new HttpError(503,'O frete real ainda precisa ser configurado.');
 const minutes=Number(env.RESERVATION_MINUTES||30);
 if(!Number.isInteger(minutes)||minutes<10||minutes>1440)throw new HttpError(503,'Confira a duração das reservas.');
 const shippingQuote=await shipping(env,cep,items);
 const result=await withTransaction(env,async tx=>{
  const existing=await transactionDoc(env,path,tx);
  if(existing)return {writes:[],result:{owner:false,order:priorOrder(docData(existing),hash)}};
  const found=new Map<string,{raw:any;p:Product}>();
  for(const item of items)if(!found.has(item.id)){
   const raw=await transactionDoc(env,'products/'+item.id,tx);if(!raw)throw new HttpError(409,'Um produto do carrinho está indisponível.');
   found.set(item.id,{raw,p:docData(raw)});
  }
  const entries:any[]=[];let subtotalCents=0;
  for(const item of items){
   const p=found.get(item.id)!.p;
   if(p.demo)throw new HttpError(400,'Produtos de demonstração não podem receber pagamento real.');
   const variant=p.variants?.find(v=>v.id===item.variant);
   if(p.variants?.length&&!variant)throw new HttpError(400,`Selecione uma variação para ${p.name}.`);
   if(!p.variants?.length&&item.variant)throw new HttpError(400,'Variação inválida.');
   if(item.qty>(variant?.stock??p.stock)||item.qty>p.stock)throw new HttpError(409,`O estoque de ${p.name} mudou. Revise o carrinho.`);
   const price=variant?.price??p.price;
   if(!Number.isFinite(price)||price<=0||!Number.isSafeInteger(p.stock)||p.stock<0)throw new HttpError(503,'Confira os dados do produto com a Lansrry.');
   subtotalCents+=Math.round(price*100)*item.qty;
   entries.push({id:p.id,name:p.name,variant:item.variant,quantity:item.qty,price});
   if(variant)variant.stock-=item.qty;p.stock-=item.qty;
  }
  const createdAt=new Date().toISOString(),expiresAt=new Date(Date.now()+minutes*60000).toISOString();
  const order={id,userId:user.uid,requestKey:key,requestHash:hash,createdAt,expiresAt,nextReconcileAt:expiresAt,paymentMode:live?'live':'test',sellerId:String(account.id),customer,items:entries,shipping:shippingQuote,total:(subtotalCents+Math.round(shippingQuote.amount*100))/100,status:'pending_payment',demo:false,reserved:true,released:false,checkoutState:'creating'};
  const writes:any[]=[documentWrite(env,path,order,null)];
  for(const [productId,{raw,p}]of found)writes.push(documentWrite(env,'products/'+productId,p,raw));
  return {writes,result:{owner:true,order}};
 });
 if(!result.owner)return result.order;
 let preference:any;
 try{
  const origin=env.SITE_URL||business.origin;
  preference=await providerRequest(env,'/checkout/preferences',{method:'POST',headers:{'X-Idempotency-Key':id},body:JSON.stringify({items:result.order.items.map((x:any)=>({id:x.id,title:x.name,quantity:x.quantity,unit_price:x.price,currency_id:'BRL'})),payer:{email:customer.email},shipments:{cost:shippingQuote.amount,mode:'not_specified'},external_reference:id,notification_url:origin+'/api/payments/webhook',back_urls:{success:origin+'/conta',pending:origin+'/conta',failure:origin+'/conta'},auto_return:'approved',expires:true,expiration_date_from:result.order.createdAt,expiration_date_to:result.order.expiresAt})});
  if(!preference.id||String(preference.collector_id)!==String(account.id)||typeof preference.init_point!=='string'||new URL(preference.init_point).protocol!=='https:')throw new Error('Unconfirmed checkout');
 }catch{
  await markCheckoutForReview(env,id).catch(()=>{});
  // A timeout can occur after the provider created a preference. Never issue a second POST or free this reservation blindly.
  throw new HttpError(503,'O pedido foi registrado, mas não conseguimos confirmar o pagamento. Confira Minha conta ou fale com a Lansrry antes de tentar novamente.');
 }
 return completePreference(env,id,preference);
}
export async function markCheckoutForReview(env:Env,id:string){
 return withTransaction(env,async tx=>{
  const raw=await transactionDoc(env,'orders/'+safeId(id),tx);if(!raw)throw new HttpError(404,'Pedido não encontrado.');
  const current=docData(raw);
  return {writes:[documentWrite(env,'orders/'+id,{...current,checkoutState:'review_required'},raw)],result:undefined};
 });
}
export async function completePreference(env:Env,id:string,preference:any){
 return withTransaction(env,async tx=>{
  const raw=await transactionDoc(env,'orders/'+safeId(id),tx);if(!raw)throw new HttpError(404,'Pedido não encontrado.');
  const current=docData(raw);
  const available=!current.released&&!current.closureRequestedAt&&!(Date.parse(current.expiresAt)<=Date.now())&&!['paid','paid_review_required','refund_review_required','dispute_review_required'].includes(current.status);
  const order={...current,preferenceId:preference.id,checkoutState:available?'ready':'review_required',checkoutUrl:available?preference.init_point:null};
  return {writes:[documentWrite(env,'orders/'+id,order,raw)],result:available?order:{...order,checkoutUrl:undefined}};
 });
}
function validatePayment(order:any,payment:any){
 if(order.demo||String(payment.external_reference)!==String(order.id)||!payment.id||payment.currency_id!=='BRL'||!Number.isFinite(payment.transaction_amount)||Math.round(payment.transaction_amount*100)!==Math.round(order.total*100)||payment.live_mode!==(order.paymentMode!=='test')||(order.sellerId&&String(payment.collector_id)!==String(order.sellerId)))throw new HttpError(400,'Pagamento incompatível com o pedido.');
}
export async function releaseReservation(env:Env,id:string,status:string,_payment?:any){
 return withTransaction(env,async tx=>{
  const raw=await transactionDoc(env,'orders/'+safeId(id),tx);if(!raw)throw new HttpError(404,'Pedido não encontrado.');
  const order=docData(raw);
  if(!order.reserved||order.released||order.paymentStatus==='approved'||['paid','paid_review_required','refund_review_required'].includes(order.status))return {writes:[],result:undefined};
  if(env.RESERVATION_AUTO_RELEASE!=='true')throw new HttpError(409,'A reposição automática de reservas aguarda homologação e aprovação dos responsáveis.');
  const snapshots=Object.values(order.paymentSnapshots||{}) as any[];
  const observed=Date.parse(order.terminalObservedAt||''),confirmed=Date.parse(order.terminalConfirmedAt||''),closed=Date.parse(order.preferenceClosedAt||'');
  // A negative search alone is not proof that no charge is still propagating.
  if(![observed,confirmed,closed].every(Number.isFinite)||confirmed-observed<900000||confirmed-closed<900000||!snapshots.length||snapshots.some(p=>!['cancelled','rejected'].includes(p.status)))throw new HttpError(409,'A reserva exige preferência fechada e duas conciliações terminais consistentes após 15 minutos.');
  const products=new Map<string,{raw:any;p:Product}>();
  for(const item of order.items)if(!products.has(item.id)){
   const product=await transactionDoc(env,'products/'+safeId(item.id),tx);
   if(!product)throw new HttpError(409,'Um produto reservado precisa de conferência manual.');
   const p:Product=docData(product);
   if(item.variant&&!p.variants?.some(v=>v.id===item.variant))throw new HttpError(409,'Uma variação reservada precisa de conferência manual.');
   products.set(item.id,{raw:product,p});
  }
  for(const item of order.items){
   const product=products.get(item.id)!;
   const variant=product.p.variants?.find(v=>v.id===item.variant);
   if((item.variant&&!variant)||(!item.variant&&product.p.variants?.length)||!Number.isSafeInteger(item.quantity)||item.quantity<1||!Number.isSafeInteger(product.p.stock)||product.p.stock<0||(variant&&(!Number.isSafeInteger(variant.stock)||variant.stock<0)))throw new HttpError(409,'O estoque reservado precisa de conferência manual.');
   product.p.stock+=item.quantity;if(variant)variant.stock+=item.quantity;
  }
  const writes:any[]=[documentWrite(env,'orders/'+id,{...order,status,released:true,releasedAt:new Date().toISOString(),reconciliationState:'confirmed',nextReconcileAt:new Date(Date.now()+86400000).toISOString(),checkoutUrl:null},raw)];
  for(const [productId,{raw,p}]of products)writes.push(documentWrite(env,'products/'+productId,p,raw));
  return {writes,result:undefined};
 });
}
export async function recordPayment(env:Env,payment:any){
 const id=safeId(String(payment.external_reference||''));
 await withTransaction(env,async tx=>{
  const raw=await transactionDoc(env,'orders/'+id,tx);if(!raw)throw new HttpError(404,'Pedido não encontrado.');
  const order=docData(raw);
  validatePayment(order,payment);
  const snapshots={...(order.paymentSnapshots||{})},paymentId=String(payment.id),prior=snapshots[paymentId];
  const updated=Date.parse(payment.date_last_updated||''),refundedAmount=Number(payment.transaction_amount_refunded||0);
  if(!Number.isFinite(updated))throw new HttpError(400,'O pagamento exige uma data de atualização verificável.');
  if(!Number.isFinite(refundedAmount)||refundedAmount<0)throw new HttpError(400,'Valor de reembolso incompatível.');
  if(prior&&(prior.updated>updated||(prior.status==='refunded'&&!['refunded','charged_back'].includes(payment.status))||(prior.status==='charged_back'&&payment.status!=='charged_back')||(prior.status==='in_mediation'&&payment.status==='approved'&&updated<=prior.updated)||(prior.status==='approved'&&['pending','in_process','authorized','rejected','cancelled'].includes(payment.status)&&updated<=prior.updated)||(prior.status===payment.status&&prior.updated===updated&&prior.amountRefunded>=refundedAmount)))return {writes:[],result:undefined};
  if(!prior&&Object.keys(snapshots).length>=100)throw new HttpError(409,'Muitos pagamentos vinculados. Exige conferência manual.');
  snapshots[paymentId]={id:paymentId,status:String(payment.status),updated,amountRefunded:Math.max(prior?.amountRefunded||0,refundedAmount)};
  let next:any={...order,paymentSnapshots:snapshots};
  if(payment.status==='approved'){
   const multiple=order.paymentId&&String(order.paymentId)!==String(payment.id);
   next={...next,status:order.released||multiple?'paid_review_required':'paid',paymentStatus:'approved',paymentId:order.paymentId||payment.id,checkoutUrl:null,...(multiple?{additionalPaymentId:payment.id}:{})};
   if(snapshots[paymentId].amountRefunded>0)next={...next,status:'refund_review_required',paymentStatus:'partially_refunded'};
  }else if(payment.status==='refunded'||payment.status==='charged_back'||payment.status==='in_mediation'){
   // Refunds of paid/fulfilled orders require operational review; do not silently put sold goods back in stock.
   next={...next,status:payment.status==='refunded'?'refund_review_required':'dispute_review_required',paymentStatus:payment.status,paymentId:order.paymentId||payment.id,checkoutUrl:null};
  }else if(!order.released&&!['paid','paid_review_required','refund_review_required','dispute_review_required'].includes(order.status)){
   next={...next,status:['cancelled','rejected'].includes(payment.status)?'closure_review_required':'pending_payment',paymentStatus:payment.status};
  }
  const known=Object.values(snapshots) as any[];
  if(known.some(p=>['charged_back','in_mediation'].includes(p.status))||order.status==='dispute_review_required')next={...next,status:'dispute_review_required',paymentStatus:known.some(p=>p.status==='charged_back')?'charged_back':'in_mediation',checkoutUrl:null};
  else if(known.some(p=>p.status==='refunded'||p.amountRefunded>0)||order.status==='refund_review_required')next={...next,status:'refund_review_required',paymentStatus:known.some(p=>p.status==='refunded')?'refunded':'partially_refunded',checkoutUrl:null};
  else if(known.filter(p=>p.status==='approved').length>1||order.status==='paid_review_required')next={...next,status:'paid_review_required',checkoutUrl:null};
  return {writes:next?[documentWrite(env,'orders/'+id,next,raw)]:[],result:undefined};
 });
}

async function updateOrder(env:Env,id:string,work:(order:any)=>any){return withTransaction(env,async tx=>{const raw=await transactionDoc(env,'orders/'+safeId(id),tx);if(!raw)throw new HttpError(404,'Pedido não encontrado.');const next=work(docData(raw));return {writes:[documentWrite(env,'orders/'+id,next,raw)],result:next};});}

// Called only by authenticated administration or the company's scheduled Worker.
export async function reconcileOrder(env:Env,id:string,{cancel=false}={}){
 const account=await paymentAccount(env);
 let order=await getDoc(env,'orders/'+safeId(id));
 if(order.demo)return {id,status:order.status,released:!!order.released};
 if(String(order.sellerId)!==String(account.id)||order.paymentMode!==env.PAYMENTS_MODE)throw new HttpError(409,'Use o ambiente e vendedor originais deste pedido.');
 try{
  const closing=cancel||Date.parse(order.expiresAt)<=Date.now()||!!order.closureRequestedAt;
  if(closing&&!order.released){
   order=await updateOrder(env,id,o=>({...o,closureRequestedAt:o.closureRequestedAt||new Date().toISOString(),closureReason:o.closureReason||(cancel?'cancelled':'expired'),checkoutUrl:null}));
   try{await closePreference(env,order);order=await updateOrder(env,id,o=>({...o,preferenceClosedAt:o.preferenceClosedAt||new Date().toISOString(),preferenceClosureState:'confirmed'}));}
   catch(error){if(!['paid','paid_review_required','refund_review_required','dispute_review_required'].includes(order.status))throw error;order=await updateOrder(env,id,o=>({...o,preferenceClosureState:'review_required'}));}
  }
  let payments=await searchOrderPayments(env,id);
  for(const p of payments){validatePayment(order,p);await recordPayment(env,p);}
  if(closing&&!order.released){
   // Closing a preference does not cancel an existing boleto/Pix or an in-flight charge.
   for(const p of payments)if(['pending','in_process','authorized'].includes(p.status)){
    await providerRequest(env,'/v1/payments/'+encodeURIComponent(String(p.id)),{method:'PUT',headers:{'X-Idempotency-Key':'cancel-'+id+'-'+String(p.id)},body:JSON.stringify({status:'cancelled'})});
   }
   if(payments.some(p=>['pending','in_process','authorized'].includes(p.status))){payments=await searchOrderPayments(env,id);for(const p of payments){validatePayment(order,p);await recordPayment(env,p);}}
  }
  const terminal=closing&&payments.length>0&&payments.every(p=>['cancelled','rejected'].includes(p.status));
  const fingerprint=terminal?await digest(JSON.stringify(payments.map(p=>[String(p.id),p.status,p.date_last_updated||'',Number(p.transaction_amount_refunded||0)]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))))):null;
  order=await updateOrder(env,id,o=>{
   const now=new Date().toISOString(),consistent=terminal&&o.terminalFingerprint===fingerprint;
   return {...o,reconciledAt:now,terminalFingerprint:fingerprint,terminalObservedAt:terminal?(consistent?o.terminalObservedAt:now):null,terminalConfirmedAt:consistent?now:null,nextReconcileAt:new Date(Date.now()+((o.released||['paid','paid_review_required','refund_review_required','dispute_review_required'].includes(o.status))?86400000:900000)).toISOString(),reconciliationState:terminal&&!o.released?'quiescence_confirming':payments.length?'confirmed':'no_payment_review_required'};
  });
  if(terminal&&!order.released&&order.terminalConfirmedAt&&Date.parse(order.terminalConfirmedAt)-Date.parse(order.terminalObservedAt)>=900000&&Date.parse(order.terminalConfirmedAt)-Date.parse(order.preferenceClosedAt)>=900000){
   if(env.RESERVATION_AUTO_RELEASE==='true')await releaseReservation(env,id,order.closureReason||'expired');
   else await updateOrder(env,id,o=>({...o,reconciliationState:'terminal_ready_review_required'}));
  }
  const final=await getDoc(env,'orders/'+id);
  return {id,status:final.status,released:!!final.released,reconciliationState:final.reconciliationState};
 }catch(error){
  await updateOrder(env,id,o=>({...o,reconciliationState:'review_required',nextReconcileAt:new Date(Date.now()+900000).toISOString(),reconciliationFailedAt:new Date().toISOString()})).catch(()=>{});
  throw error;
 }
}
export const cancelOrder=(env:Env,id:string)=>reconcileOrder(env,id,{cancel:true});

export async function reconcileReservations(env:Env){
 const query=await dbFetch(env,':runQuery',{method:'POST',body:JSON.stringify({structuredQuery:{from:[{collectionId:'orders'}],where:{fieldFilter:{field:{fieldPath:'nextReconcileAt'},op:'LESS_THAN_OR_EQUAL',value:{stringValue:new Date().toISOString()}}},orderBy:[{field:{fieldPath:'nextReconcileAt'},direction:'ASCENDING'}],limit:1}})});
 const results=[];
 for(const row of query){if(!row.document)continue;const order=docData(row.document);try{results.push(await reconcileOrder(env,order.id));}catch{await updateOrder(env,order.id,o=>({...o,reconciliationState:'review_required',nextReconcileAt:new Date(Date.now()+900000).toISOString(),reconciliationFailedAt:new Date().toISOString()})).catch(()=>{});results.push({id:order.id,reconciliationState:'review_required'});}}
 const run={id:crypto.randomUUID(),createdAt:new Date().toISOString(),processed:results.length,reviewRequired:results.filter(r=>['review_required','no_payment_review_required','terminal_ready_review_required'].includes(r.reconciliationState||'')).length};
 await withTransaction(env,async()=>({writes:[documentWrite(env,'paymentRuns/'+run.id,run,null)],result:undefined}));
 return run;
}
