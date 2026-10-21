import {Env,documentWrite} from './firebase';

// Metadata only: never include passwords, tokens, form contents or payment payloads.
export function auditWrite(env:Env,actor:string,action:string,target:string){
 return documentWrite(env,'adminAudit/'+crypto.randomUUID(),{actor,action,target,createdAt:new Date().toISOString()},null);
}
