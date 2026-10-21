// Minimal provider contract: snapshot reads, atomic commits, canonical errors and updateTime CAS.
// It deliberately stores data independently of the application's transaction callbacks.
export class FakeServices {
 constructor(codec){this.codec=codec;this.reset();}
 reset(){this.docs=new Map();this.transactions=new Map();this.objects=new Map();this.payments=new Map();this.preferences=new Map();this.sellerId=123;this.sellerTags=[];this.searchFails=false;this.closeFails=false;this.cancelFails=false;this.sequence=0;this.version=0;this.oauthCalls=0;this.authCalls=0;this.preferenceCalls=0;this.uploadCalls=0;this.failUpload=false;this.losePreferenceResponse=false;this.queryFailure=null;this.beforeCommit=null;}
 json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});}
 error(status,code){return this.json({error:{status:code,message:code}},status);}
 raw(path,data){return {name:'projects/test-project/databases/(default)/documents/'+path,fields:this.codec.fields(data),updateTime:'2026-10-02T00:00:00.'+String(++this.version).padStart(6,'0')+'Z'};}
 seed(path,data){this.docs.set(path,this.raw(path,data));}
 value(path){const raw=this.docs.get(path);return raw?this.codec.docData(structuredClone(raw)):null;}
 values(collection){return [...this.docs].filter(([path])=>path.startsWith(collection+'/')).map(([path])=>this.value(path));}
 async fetch(input,init={}){
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url),method=init.method||'GET';
  if(url.hostname==='oauth2.googleapis.com'){this.oauthCalls++;await Promise.resolve();return this.json({access_token:'fake-service-token',expires_in:3600});}
  if(url.hostname==='identitytoolkit.googleapis.com'){
   const b=JSON.parse(init.body||'{}');
   if(url.pathname.endsWith(':lookup'))return ['customer-a','customer-b','admin'].includes(b.idToken)?this.json({users:[{localId:b.idToken,email:b.idToken+'@example.test'}]}):this.error(400,'INVALID_ID_TOKEN');
   this.authCalls++;return this.error(400,'INVALID_LOGIN_CREDENTIALS');
  }
  if(url.hostname==='shipping.test')return this.json({amount:10,label:'Frete do provedor de teste'});
  if(url.hostname==='storage.googleapis.com'){
   if(url.pathname.startsWith('/upload/')){this.uploadCalls++;if(this.failUpload)throw new Error('Upload response lost');const name=url.searchParams.get('name');if(this.objects.has(name))return this.error(412,'PRECONDITION_FAILED');this.objects.set(name,init.body);return this.json({name});}
   const name=decodeURIComponent(url.pathname.split('/o/')[1]||'');return this.objects.has(name)?new Response(this.objects.get(name)):this.error(404,'NOT_FOUND');
  }
  if(url.hostname==='api.mercadopago.com'){
   if(url.pathname==='/users/me')return this.json({id:this.sellerId,tags:this.sellerTags});
   if(url.pathname==='/checkout/preferences'&&method==='POST'){this.preferenceCalls++;const b=JSON.parse(init.body);this.lastPreference=b;const p={...b,id:'preference-'+this.preferenceCalls,collector_id:this.sellerId,init_point:'https://payments.example.test/'+b.external_reference};this.preferences.set(p.id,p);if(this.losePreferenceResponse)throw new Error('Provider accepted request but response was lost');return this.json(p);}
   if(url.pathname.startsWith('/checkout/preferences/')){const id=decodeURIComponent(url.pathname.split('/').pop()),p=this.preferences.get(id);if(!p)return this.error(404,'NOT_FOUND');if(method==='PUT'){if(this.closeFails)return this.error(500,'UNKNOWN');Object.assign(p,JSON.parse(init.body));}return this.json(p);}
   if(url.pathname==='/v1/payments/search'){if(this.searchFails)throw new Error('Payment search timed out');const all=[...this.payments.values()].filter(p=>p.external_reference===url.searchParams.get('external_reference')),offset=Number(url.searchParams.get('offset')||0),limit=Number(url.searchParams.get('limit')||30);return this.json({results:all.slice(offset,offset+limit),paging:{total:all.length,offset,limit}});}
   if(url.pathname.startsWith('/v1/payments/')){const p=this.payments.get(decodeURIComponent(url.pathname.split('/').pop()));if(p&&method==='PUT'){if(this.cancelFails)throw new Error('Cancellation outcome unknown');Object.assign(p,JSON.parse(init.body));}return p?this.json(p):this.error(404,'NOT_FOUND');}
  }
  if(url.hostname!=='firestore.googleapis.com')throw new Error('Unexpected network endpoint: '+url.hostname+url.pathname);
  const suffix=url.pathname.split('/documents')[1],b=init.body?JSON.parse(init.body):{},transaction=url.searchParams.get('transaction')||b.transaction;
  if(suffix===':beginTransaction'){const id='tx-'+(++this.sequence);this.transactions.set(id,{snapshot:structuredClone(this.docs),reads:new Map()});return this.json({transaction:id});}
  if(suffix===':rollback'){this.transactions.delete(transaction);return this.json({});}
  const tx=transaction?this.transactions.get(transaction):null;
  if(transaction&&!tx)return this.error(409,'ABORTED');
  const read=path=>{const raw=(tx?.snapshot||this.docs).get(path);if(tx)tx.reads.set(path,raw?.updateTime||null);return raw?structuredClone(raw):null;};
  if(suffix===':runQuery'){
   if(this.queryFailure)return this.error(400,this.queryFailure);
   const q=b.structuredQuery,collection=q.from[0].collectionId,filter=q.where?.fieldFilter,result=[];
   for(const [path]of(tx?.snapshot||this.docs)){if(!path.startsWith(collection+'/'))continue;const raw=read(path),value=this.codec.docData(raw);if(filter){const actual=value[filter.field.fieldPath],expected=this.codec.unpack(filter.value);if(filter.op==='LESS_THAN_OR_EQUAL'?(typeof actual!==typeof expected||actual>expected):actual!==expected)continue;}result.push({document:raw});}
   if(q.orderBy?.length){const field=q.orderBy[0].field.fieldPath;result.sort((a,b)=>String(this.codec.docData(a.document)[field]).localeCompare(String(this.codec.docData(b.document)[field]))*(q.orderBy[0].direction==='DESCENDING'?-1:1));}
   return this.json(q.limit?result.slice(0,q.limit):result);
  }
  if(suffix===':commit'){
   if(this.beforeCommit){const work=this.beforeCommit;this.beforeCommit=null;await work(b);}
   for(const [path,version]of tx?.reads||[])if((this.docs.get(path)?.updateTime||null)!==version)return this.error(409,'ABORTED');
   for(const write of b.writes){const path=(write.update?.name||write.delete).split('/documents/')[1],current=this.docs.get(path),condition=write.currentDocument;
    if(condition&&'exists'in condition&&!!current!==condition.exists)return this.error(400,'ALREADY_EXISTS');
    if(condition?.updateTime&&current?.updateTime!==condition.updateTime)return this.error(400,'FAILED_PRECONDITION');
   }
   // Apply only after every read and precondition has been checked.
   for(const write of b.writes){const path=(write.update?.name||write.delete).split('/documents/')[1];if(write.delete)this.docs.delete(path);else this.docs.set(path,{...structuredClone(write.update),updateTime:'2026-10-02T00:00:00.'+String(++this.version).padStart(6,'0')+'Z'});}
   this.transactions.delete(transaction);return this.json({writeResults:[]});
  }
  if(suffix.startsWith('/')&&method==='GET'){
   const path=suffix.slice(1);
   if(!path.includes('/')){const documents=[...this.docs].filter(([p])=>p.startsWith(path+'/')).map(([,raw])=>structuredClone(raw));return this.json({documents});}
   const raw=read(path);return raw?this.json(raw):this.error(404,'NOT_FOUND');
  }
  throw new Error('Unsupported Firestore operation: '+method+' '+suffix);
 }
}
