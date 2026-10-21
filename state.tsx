import React,{createContext,useContext,useEffect,useState} from 'react';
import {CartItem,Initial,Product} from './data';
export function useStored<T>(key:string,initial:T) {
  const [value,setValue]=useState<T>(initial),[ready,setReady]=useState(false);
  useEffect(()=>{try{const s=localStorage.getItem(key);if(s)setValue(JSON.parse(s));}catch{}setReady(true);},[key]);
  useEffect(()=>{if(ready)try{localStorage.setItem(key,JSON.stringify(value));}catch{ window.dispatchEvent(new CustomEvent('storage-error'));}},[key,value,ready]);
  return [value,setValue,ready] as const;
}
type Context={initial:Initial;products:Product[];setProducts:React.Dispatch<React.SetStateAction<Product[]>>;cart:CartItem[];setCart:React.Dispatch<React.SetStateAction<CartItem[]>>;toast:(t:string)=>void;demo:boolean;ready:boolean;add:(p:Product,v?:string,q?:number)=>void};
const ShopContext=createContext<Context>(null!);
export const useShop=()=>useContext(ShopContext);
export function ShopProvider({initial,children}:{initial:Initial;children:React.ReactNode}) {
  const [localProducts,setProducts,productReady]=useStored<Product[]>('lansrry:demo-products:v1',initial.products);
  const [cart,setCart,ready]=useStored<CartItem[]>('lansrry:cart:v1',[]);
  const [notice,setNotice]=useState('');
  useEffect(()=>{if(!notice)return;const id=setTimeout(()=>setNotice(''),4200);return()=>clearTimeout(id);},[notice]);
  useEffect(()=>{const cb=()=>setNotice('O armazenamento do navegador está cheio. Remova anexos de teste antes de continuar.');window.addEventListener('storage-error',cb);return()=>window.removeEventListener('storage-error',cb);},[]);
  const products=initial.mode==='demo'?localProducts:initial.products;
  const add=(p:Product,v='',q=1)=>{const max=p.variants?.find(x=>x.id===v)?.stock??p.stock;if(max<1){setNotice('Este item está indisponível.');return;}setCart(a=>{const previous=a.find(x=>x.id===p.id&&x.variant===v);const qty=(previous?.qty??0)+q;if(qty>max){setNotice('Quantidade limitada ao estoque disponível.');return a;}setNotice(p.demo?'Item DEMO adicionado ao carrinho.': 'Produto adicionado ao carrinho.');return previous?a.map(x=>x===previous?{...x,qty}:x):[...a,{id:p.id,variant:v,qty:q}];});};
  return <ShopContext.Provider value={{initial,products,setProducts,cart,setCart,toast:setNotice,demo:initial.mode==='demo',ready:ready&&productReady,add}}>{children}{notice&&<div className="toast" role="status">{notice}</div>}</ShopContext.Provider>;
}
export async function api(path:string,options:RequestInit={}) { const r=await fetch(path,{...options,headers:options.body instanceof FormData?options.headers:{'Content-Type':'application/json',...options.headers}});const data=await r.json();if(!r.ok)throw new Error(data.error||'Não foi possível concluir. Tente novamente.');return data; }
export const fileToData = (f:File)=>new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=reject;r.readAsDataURL(f);});
