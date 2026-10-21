import {Product} from '../src/data';
import {Env,HttpError,dbFetch,docData,docName,documentWrite,transactionDoc,withTransaction} from './firebase';
import {auditWrite} from './audit';

export async function saveProduct(env:Env,product:Product,version?:string,actor?:string){
 return withTransaction(env,async tx=>{
  const path='products/'+product.id,raw=await transactionDoc(env,path,tx);
  if(raw&&(!version||version!==raw.updateTime))throw new HttpError(409,'O produto ou estoque mudou enquanto você editava. Recarregue o painel antes de salvar.');
  if(!raw&&version)throw new HttpError(409,'Este produto foi removido. Recarregue o painel.');
  const current=raw?docData(raw):null;
  const slugPath='productSlugs/'+product.slug,slugRaw=await transactionDoc(env,slugPath,tx);
  if(slugRaw&&docData(slugRaw).productId!==product.id)throw new HttpError(409,'Este endereço já está cadastrado.');
  // Check records created before the atomic slug index existed.
  const matches=await dbFetch(env,':runQuery',{method:'POST',body:JSON.stringify({transaction:tx,structuredQuery:{from:[{collectionId:'products'}],where:{fieldFilter:{field:{fieldPath:'slug'},op:'EQUAL',value:{stringValue:product.slug}}},limit:2}})});
  if(matches.some((x:any)=>x.document&&docData(x.document).id!==product.id))throw new HttpError(409,'Este endereço já está cadastrado.');
  let oldSlugRaw:any=null;
  if(current&&current.slug!==product.slug)oldSlugRaw=await transactionDoc(env,'productSlugs/'+current.slug,tx);
  const clean={...product};delete clean.version;
  const writes:any[]=[documentWrite(env,path,clean,raw),documentWrite(env,slugPath,{productId:product.id},slugRaw)];
  if(oldSlugRaw&&docData(oldSlugRaw).productId===product.id)writes.push({delete:oldSlugRaw.name,currentDocument:{updateTime:oldSlugRaw.updateTime}});
  if(actor)writes.push(auditWrite(env,actor,'product.save',product.id));
  return {writes,result:{id:product.id}};
 });
}
export async function deleteProduct(env:Env,id:string,version:string,actor?:string){
 if(!version)throw new HttpError(409,'Recarregue o painel antes de excluir o produto.');
 return withTransaction(env,async tx=>{
  const raw=await transactionDoc(env,'products/'+id,tx);
  if(!raw||raw.updateTime!==version)throw new HttpError(409,'O produto ou estoque mudou. Recarregue o painel antes de excluir.');
  const current=docData(raw),slugRaw=await transactionDoc(env,'productSlugs/'+current.slug,tx);
  const writes:any[]=[{delete:docName(env,'products/'+id),currentDocument:{updateTime:raw.updateTime}}];
  if(slugRaw&&docData(slugRaw).productId===id)writes.push({delete:slugRaw.name,currentDocument:{updateTime:slugRaw.updateTime}});
  if(actor)writes.push(auditWrite(env,actor,'product.delete',id));
  return {writes,result:{ok:true}};
 });
}
