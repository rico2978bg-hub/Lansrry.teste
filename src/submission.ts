// Keep only the operation UUID across reloads. Customer data and attachments stay in the form.
const keys=new Map<string,string>();
const storageKey=(scope:string)=>'lansrry:submission:'+scope;
export function submissionKey(scope:string){
 let key=keys.get(scope);
 if(!key)try{key=sessionStorage.getItem(storageKey(scope))||undefined;}catch{}
 if(!key||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key))key=crypto.randomUUID();
 keys.set(scope,key);
 try{sessionStorage.setItem(storageKey(scope),key);}catch{}
 return key;
}
export function forgetSubmission(scope:string){keys.delete(scope);try{sessionStorage.removeItem(storageKey(scope));}catch{}}
export function finishKnownOrders(scope:string,orders:any[]){
 let key=keys.get(scope);if(!key)try{key=sessionStorage.getItem(storageKey(scope))||undefined;}catch{}
 if(key&&orders.some(o=>o.requestKey===key&&(o.released||['paid','paid_review_required','teste_sem_cobranca','refund_review_required'].includes(o.status))))forgetSubmission(scope);
}
