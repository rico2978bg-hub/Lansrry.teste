import {createWorker} from './app';
import {Env} from './firebase';
import {reconcileReservations} from './orders';

const app=createWorker(async(req,env)=>{
 const path=new URL(req.url).pathname;
 if(!path.startsWith('/assets/')&&path!=='/favicon.ico')return null;
 if(!env.ASSETS)return new Response('Arquivo indisponível',{status:503});
 return env.ASSETS.fetch(req);
});

// This target is exclusively for the company's store. Even an absent or
// incorrectly set APP_MODE cannot publish the demonstration on this target.
export default {
 fetch(req:Request,env:Env){return app.fetch(req,{...env,APP_MODE:'production'});},
 scheduled(_event:unknown,env:Env,ctx:{waitUntil:(work:Promise<unknown>)=>void}){ctx.waitUntil(reconcileReservations({...env,APP_MODE:'production'}));}
};
