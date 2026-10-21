import {HttpError} from './firebase';

const crcTable=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=(n&1)?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
const dimensions=(w:number,h:number)=>w>0&&h>0&&w<=12000&&h<=12000&&w*h<=40000000;
function png(bytes:Uint8Array,view:DataView,ascii:(a:number,b:number)=>string){
 if(bytes.length<57||!bytes.slice(0,8).every((x,i)=>x===[137,80,78,71,13,10,26,10][i]))return false;
 let offset=8,header=false,pixels=false,endedPixels=false;
 while(offset+12<=bytes.length){
  const size=view.getUint32(offset),end=offset+12+size;if(end>bytes.length)return false;
  const type=ascii(offset+4,offset+8);if(!/^[A-Za-z]{4}$/.test(type))return false;
  let crc=0xffffffff;for(let i=offset+4;i<offset+8+size;i++)crc=crcTable[(crc^bytes[i])&255]^(crc>>>8);
  if(((crc^0xffffffff)>>>0)!==view.getUint32(offset+8+size))return false;
  if(!header){
   if(type!=='IHDR'||size!==13||!dimensions(view.getUint32(offset+8),view.getUint32(offset+12)))return false;
   const depth=bytes[offset+16],color=bytes[offset+17],depths:Record<number,number[]>={0:[1,2,4,8,16],2:[8,16],3:[1,2,4,8],4:[8,16],6:[8,16]};
   if(!depths[color]?.includes(depth)||bytes[offset+18]!==0||bytes[offset+19]!==0||bytes[offset+20]>1)return false;
   header=true;
  }else if(type==='IHDR')return false;
  if(type==='IDAT'){if(endedPixels)return false;pixels=pixels||size>0;}else if(pixels)endedPixels=true;
  if(type==='IEND')return size===0&&pixels&&end===bytes.length;
  if(!['IHDR','PLTE','IDAT','IEND'].includes(type)&&type[0]===type[0].toUpperCase())return false;
  offset=end;
 }
 return false;
}
function jpeg(bytes:Uint8Array,view:DataView){
 if(bytes.length<4||bytes[0]!==255||bytes[1]!==216)return false;
 let offset=2,frame=false,scanned=false;
 while(offset<bytes.length){
  if(bytes[offset++]!==255)return false;while(bytes[offset]===255)offset++;
  const marker=bytes[offset++];if(marker===217)return frame&&scanned&&offset===bytes.length;
  if(marker===0||marker===216||(marker>=208&&marker<=215)||offset+2>bytes.length)return false;
  const length=view.getUint16(offset);if(length<2||offset+length>bytes.length)return false;
  if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)){
   if(length<11||!dimensions(view.getUint16(offset+5),view.getUint16(offset+3)))return false;
   const components=bytes[offset+7];if(![1,3,4].includes(components)||length!==8+3*components)return false;frame=true;
  }
  offset+=length;
  if(marker===218){
   if(!frame||length<6)return false;let entropy=0;
   while(offset<bytes.length){if(bytes[offset]!==255){offset++;entropy++;continue;}const next=bytes[offset+1];if(next===0||(next>=208&&next<=215)){offset+=2;entropy++;continue;}if(next===255){offset++;continue;}break;}
   if(!entropy)return false;scanned=true;
  }
 }
 return false;
}
function webp(bytes:Uint8Array,view:DataView,ascii:(a:number,b:number)=>string){
 if(bytes.length<20||ascii(0,4)!=='RIFF'||ascii(8,12)!=='WEBP'||view.getUint32(4,true)+8!==bytes.length)return false;
 let offset=12,pixels=false;
 while(offset+8<=bytes.length){
  const type=ascii(offset,offset+4),size=view.getUint32(offset+4,true),start=offset+8,end=start+size;
  if(end>bytes.length||type==='ANIM'||type==='ANMF')return false;
  let w=0,h=0;
  if(type==='VP8X'){if(size!==10||(bytes[start]&2))return false;w=1+bytes[start+4]+(bytes[start+5]<<8)+(bytes[start+6]<<16);h=1+bytes[start+7]+(bytes[start+8]<<8)+(bytes[start+9]<<16);}
  if(type==='VP8L'){if(pixels||size<6||bytes[start]!==47)return false;const bits=view.getUint32(start+1,true);w=(bits&0x3fff)+1;h=((bits>>>14)&0x3fff)+1;pixels=true;}
  if(type==='VP8 '){if(pixels||size<11||bytes[start+3]!==157||bytes[start+4]!==1||bytes[start+5]!==42)return false;w=view.getUint16(start+6,true)&0x3fff;h=view.getUint16(start+8,true)&0x3fff;pixels=true;}
  if(['VP8X','VP8L','VP8 '].includes(type)&&!dimensions(w,h))return false;
  offset=end+(size%2);
 }
 return pixels&&offset===bytes.length;
}

// Content validation supplements extension/MIME checks. This is not a malware scanner.
export async function validateUpload(file:File,kind:'image'|'reference'){
 const limit=kind==='image'?2*1024*1024:10*1024*1024;
 if(!file.size||file.size>limit)throw new HttpError(400,'O arquivo está vazio ou excede o limite permitido.');
 const bytes=new Uint8Array(await file.arrayBuffer()),view=new DataView(bytes.buffer);
 const ascii=(start:number,end:number)=>new TextDecoder().decode(bytes.subarray(start,end));
 const ext=file.name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];let detected='';
 if(png(bytes,view,ascii))detected='image/png';
 else if(webp(bytes,view,ascii))detected='image/webp';
 else if(jpeg(bytes,view))detected='image/jpeg';
 if(kind==='reference'&&ext==='pdf'&&ascii(0,8).match(/^%PDF-1\.[0-9]/)&&ascii(Math.max(0,bytes.length-1024),bytes.length).includes('%%EOF'))detected='application/pdf';
 if(kind==='reference'&&ext==='stl'){
  const binary=bytes.length>=84&&84+view.getUint32(80,true)*50===bytes.length&&view.getUint32(80,true)>0;
  let valid=binary;
  if(binary)for(let offset=84;offset<bytes.length&&valid;offset+=50)for(let i=0;i<12;i++)if(!Number.isFinite(view.getFloat32(offset+4*i,true)))valid=false;
  if(!binary&&bytes.length<=limit){const value=ascii(0,bytes.length).trim();const number='[-+]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][-+]?\\d+)?';const vertex=new RegExp('^vertex\\s+'+number+'\\s+'+number+'\\s+'+number+'$');const normal=new RegExp('^facet normal\\s+'+number+'\\s+'+number+'\\s+'+number+'$');const lines=value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);let pos=1,count=0;valid=/^solid(?:\s.*)?$/.test(lines[0]||'');while(valid&&pos<lines.length-1){valid=normal.test(lines[pos++]||'')&&lines[pos++]==='outer loop'&&vertex.test(lines[pos++]||'')&&vertex.test(lines[pos++]||'')&&vertex.test(lines[pos++]||'')&&lines[pos++]==='endloop'&&lines[pos++]==='endfacet';count++;}valid=valid&&count>0&&pos===lines.length-1&&/^endsolid(?:\s.*)?$/.test(lines[pos]||'');}
  if(valid&&!binary){const lines=ascii(0,bytes.length).split(/\r?\n/).map(line=>line.trim());valid=lines.filter(line=>/^(vertex|facet normal)\s/.test(line)).every(line=>line.replace(/^(vertex|facet normal)\s+/, '').split(/\s+/).every(value=>Number.isFinite(Number(value))));}
  if(valid)detected='model/stl';
 }
 const extensions:Record<string,string[]>= {'image/png':['png'],'image/jpeg':['jpg','jpeg'],'image/webp':['webp'],'application/pdf':['pdf'],'model/stl':['stl']};
 if(!detected||!extensions[detected]?.includes(ext||'')||(file.type&&file.type!=='application/octet-stream'&&file.type!==detected&&!(detected==='model/stl'&&['application/sla','application/vnd.ms-pki.stl'].includes(file.type))))throw new HttpError(400,'O conteúdo do arquivo não corresponde a um formato permitido. Exporte um novo arquivo e tente novamente.');
 return new File([bytes],file.name,{type:detected});
}
