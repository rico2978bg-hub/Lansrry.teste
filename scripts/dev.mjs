import http from 'node:http';
import fs from 'node:fs';
import worker from '../dist/server/index.js';
// No secrets are hardcoded. Local development reads the same environment names as production.
const env={...process.env};
http.createServer(async(req,res)=>{try{const body=[];for await(const chunk of req)body.push(chunk);const r=new Request(`http://${req.headers.host}${req.url}`,{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(body)});const response=await worker.fetch(r,env);res.statusCode=response.status;for(const[k,v]of response.headers)if(k!=='set-cookie')res.setHeader(k,v);const cookies=response.headers.getSetCookie();if(cookies.length)res.setHeader('Set-Cookie',cookies);res.end(Buffer.from(await response.arrayBuffer()));}catch{res.writeHead(500);res.end('Erro interno');}}).listen(4173,'0.0.0.0',()=>console.log('Lansrry disponível em http://localhost:4173'));
