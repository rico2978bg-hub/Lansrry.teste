import React,{createContext,useContext,useEffect,useRef,useState} from 'react';
import {useShop} from './state';
import {business,maps} from './data';

export const CONSENT_KEY='lansrry:consent:v1';
const CLIENT_KEY='lansrry:analytics-client:v1',MAX_AGE=180*86400000;
type Choice={version:1;analytics:boolean;at:number};
type Consent={open:()=>void};
const ConsentContext=createContext<Consent>({open:()=>{}});
const measuredPages=new Set(['/','/loja','/produtos','/servicos','/sobre','/localizacao']);
function readChoice():Choice|null{try{const c=JSON.parse(localStorage.getItem(CONSENT_KEY)||'null');return c?.version===1&&typeof c.analytics==='boolean'&&Number.isFinite(c.at)&&c.at<=Date.now()&&Date.now()-c.at<MAX_AGE?c:null;}catch{return null;}}
export function ConsentProvider({children}:{children:React.ReactNode}){
 const {initial}=useShop();const [choice,setChoice]=useState<Choice|null>(null),[ready,setReady]=useState(false),[shown,setShown]=useState(false),[storageError,setStorageError]=useState(false);
 const heading=useRef<HTMLHeadingElement>(null),returnFocus=useRef<HTMLElement|null>(null),manual=useRef(false);
 useEffect(()=>{const c=readChoice();setChoice(c);setShown(!c);setReady(true);const sync=(e:StorageEvent)=>{if(e.key===CONSENT_KEY){const next=readChoice();setChoice(next);setShown(!next);}};window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync);},[]);
 useEffect(()=>{document.documentElement.dataset.consentBanner=shown?'true':'false';const panel=heading.current?.parentElement;const resize=()=>document.documentElement.style.setProperty('--consent-height',(panel?.getBoundingClientRect().height||0)+'px');const observer=new ResizeObserver(resize);if(panel)observer.observe(panel);resize();if(shown&&manual.current)heading.current?.focus();return()=>{observer.disconnect();delete document.documentElement.dataset.consentBanner;document.documentElement.style.removeProperty('--consent-height');};},[shown]);
 useEffect(()=>{
  if(!ready||!choice?.analytics||!initial.analyticsId||!initial.legalApproved||!measuredPages.has(initial.path)||initial.user?.admin)return;
  let clientId:string;try{clientId=localStorage.getItem(CLIENT_KEY)||crypto.randomUUID();localStorage.setItem(CLIENT_KEY,clientId);}catch{return;}
  const abort=new AbortController();
  // Only a fixed route and a random browser identifier. No DOM/form event collection or external browser script.
  fetch('/api/analytics',{method:'POST',credentials:'omit',referrerPolicy:'no-referrer',headers:{'Content-Type':'application/json'},body:JSON.stringify({consent:true,clientId,page:initial.path}),signal:abort.signal}).catch(()=>{});
  return()=>abort.abort();
 },[ready,choice?.analytics,initial.analyticsId,initial.legalApproved,initial.path,initial.user?.admin]);
 const open=()=>{returnFocus.current=document.activeElement as HTMLElement;manual.current=true;setShown(true);};
 function choose(analytics:boolean){const c:Choice={version:1,analytics,at:Date.now()};try{localStorage.setItem(CONSENT_KEY,JSON.stringify(c));if(!analytics)localStorage.removeItem(CLIENT_KEY);setStorageError(false);}catch{setStorageError(true);if(analytics){setChoice(null);return;}}setChoice(c);setShown(false);manual.current=false;returnFocus.current?.focus();}
 return <ConsentContext.Provider value={{open}}>{children}{ready&&shown&&<section className="consent-panel" aria-labelledby="consent-title"><h2 id="consent-title" ref={heading} tabIndex={-1}>Sua privacidade</h2><p>Usamos armazenamento necessário para conta e carrinho. A medição de visitas é opcional, começa após seu aceite e pode ser revogada no rodapé. <a href="/cookies">Cookies e preferências</a></p><div className="consent-actions"><button className="button secondary" onClick={()=>choose(false)}>Recusar medição</button><button className="button secondary" onClick={()=>choose(true)}>Aceitar medição</button>{choice&&<button className="text-button" onClick={()=>{setShown(false);manual.current=false;returnFocus.current?.focus();}}>Manter escolha atual</button>}</div>{choice&&<p role="status">Escolha atual: medição {choice.analytics?'aceita':'recusada'}. Para revogar, escolha “Recusar medição”.</p>}{storageError&&<p className="form-error" role="alert">Não foi possível guardar a escolha neste navegador. A medição continua bloqueada. Você pode recusar e continuar.</p>}</section>}</ConsentContext.Provider>;
}
export function ConsentSettingsButton(){const {open}=useContext(ConsentContext);return <button type="button" className="consent-settings" onClick={open}>Preferências de privacidade</button>;}
export function PrivateMap(){const [loaded,setLoaded]=useState(false);return <div className="map-wrap">{loaded?<><iframe title="Mapa da localização da Lansrry em Guaíba" src={`https://maps.google.com/maps?q=${encodeURIComponent(business.address)}&output=embed`} referrerPolicy="no-referrer"/><button className="map-remove" onClick={()=>setLoaded(false)}>Remover mapa</button></>:<div className="map-placeholder"><strong>Mapa do Google desativado</strong><p>Carregar o mapa conecta seu navegador ao Google, que poderá receber dados técnicos como seu IP.</p><button className="button secondary" onClick={()=>setLoaded(true)}>Carregar mapa do Google</button><a className="text-link" href={maps} target="_blank" rel="noreferrer">Abrir endereço no Google Maps</a></div>}</div>;}
