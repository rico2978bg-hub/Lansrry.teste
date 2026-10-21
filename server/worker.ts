import {createWorker} from './app';
import {assets} from './generated-assets';
export default createWorker(req=>{const asset=assets[new URL(req.url).pathname];if(!asset)return null;const bytes=Uint8Array.from(atob(asset.base64),x=>x.charCodeAt(0));return new Response(bytes,{headers:{'Content-Type':asset.mime,'Cache-Control':'public,max-age=3600','X-Content-Type-Options':'nosniff'}});});
