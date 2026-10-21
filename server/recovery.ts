import {Env,HttpError,configured} from './firebase';
import {bodyJson,rateRequest} from './security';

export async function recoverAccount(req:Request,env:Env){
 if(!configured(env))throw new HttpError(503,'A recuperação de conta aguarda configuração.');
 const b=await bodyJson(req,2000),email=typeof b.email==='string'?b.email.trim().toLowerCase():'';
 if(email.length>150||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new HttpError(400,'Informe um e-mail válido.');
 await rateRequest(req,env,'recover',5,15*60000,email);
 let response:Response;
 try{response=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${env.FIREBASE_API_KEY}`,{method:'POST',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/json'},body:JSON.stringify({requestType:'PASSWORD_RESET',email})});}
 catch{throw new HttpError(503,'Não foi possível solicitar a recuperação. Tente mais tarde.');}
 const data=await response.json() as any;
 if(!response.ok&&data.error?.message!=='EMAIL_NOT_FOUND')throw new HttpError(503,'Não foi possível solicitar a recuperação. Tente mais tarde.');
 // Same result for known and unknown addresses. Enable Firebase enumeration protection too.
 return {ok:true,message:'Se houver uma conta com esse e-mail, você receberá as instruções de recuperação.'};
}
