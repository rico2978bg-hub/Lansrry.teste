import {configured, Env} from './firebase';

export function legalReady(env:Env){return env.LEGAL_APPROVED==='true'&&[env.PRIVACY_POLICY_TEXT,env.TERMS_TEXT,env.RETURNS_POLICY_TEXT,env.LEGAL_CONTROLLER_NAME,env.LEGAL_CONTROLLER_DOCUMENT,env.PRIVACY_CONTACT,env.DATA_RETENTION_POLICY].every(v=>!!v?.trim());}

// Production must never silently fall back to local demonstration data.
export function productionProblems(env:Env):string[]{
 const missing:string[]=[];
 if(!configured(env)||![env.FIREBASE_PROJECT_ID,env.FIREBASE_API_KEY,env.FIREBASE_CLIENT_EMAIL,env.FIREBASE_PRIVATE_KEY].every(v=>v?.trim()))missing.push('Firebase');
 if(!env.FIREBASE_STORAGE_BUCKET?.trim())missing.push('Storage');
 if(!(env.ADMIN_UIDS||'').split(',').some(uid=>uid.trim()))missing.push('Administração');
 if(!env.PRIVACY_POLICY_TEXT?.trim())missing.push('Privacidade');
 if(!legalReady(env))missing.push('Documentos e identificação aprovados');
 try{const origin=new URL(env.SITE_URL||'');if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)missing.push('Endereço HTTPS');}catch{missing.push('Endereço HTTPS');}
 if(!['test','live'].includes(env.PAYMENTS_MODE||''))missing.push('Modo de pagamento');
 if(!['true','false'].includes(env.CHECKOUT_ENABLED||''))missing.push('Liberação da compra');
 if(env.SHIPPING_QUOTE_URL)try{if(new URL(env.SHIPPING_QUOTE_URL).protocol!=='https:')missing.push('Frete HTTPS');}catch{missing.push('Frete HTTPS');}
 if(env.CHECKOUT_ENABLED==='true'&&(!env.MERCADO_PAGO_ACCESS_TOKEN||!env.MERCADO_PAGO_WEBHOOK_SECRET||!/^\d+$/.test(env.MERCADO_PAGO_SELLER_ID||'')))missing.push('Pagamento de homologação/produção');
 if(env.PAYMENTS_MODE==='live'&&env.CHECKOUT_ENABLED==='true'&&!env.SHIPPING_QUOTE_URL)missing.push('Frete');
 if(env.GA_ANALYTICS_ENABLED==='true'&&(!/^G-[A-Z0-9]+$/.test(env.GA_MEASUREMENT_ID||'')||!env.GA_API_SECRET))missing.push('Analytics');
 return missing;
}

export function unavailablePage(){return new Response('<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Loja em preparação | Lansrry</title><body><main><h1>A loja está sendo preparada.</h1><p>Volte em breve para conhecer os produtos da Lansrry.</p></main></body></html>',{status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Retry-After':'300','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff'}});}
