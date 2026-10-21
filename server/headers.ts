export async function secureResponse(response:Response,req:Request){
 const headers=new Headers(response.headers);
 headers.set('X-Content-Type-Options','nosniff');
 headers.set('Referrer-Policy','no-referrer');
 headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=(), payment=()');
 headers.set('X-Frame-Options','SAMEORIGIN');
 if(new URL(req.url).protocol==='https:')headers.set('Strict-Transport-Security','max-age=31536000');
 if(headers.get('Content-Type')?.includes('text/html')){
  const nonce=crypto.randomUUID().replaceAll('-','');
  const html=(await response.text()).replace(/<script(?=[\s>])/g,`<script nonce="${nonce}"`);
  headers.set('Content-Security-Policy',`default-src 'self'; script-src 'self' 'nonce-${nonce}'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self'; connect-src 'self'; frame-src https://maps.google.com; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'self'`);
  headers.delete('Content-Length');
  return new Response(html,{status:response.status,statusText:response.statusText,headers});
 }
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
