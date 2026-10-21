import fs from 'node:fs/promises';

export async function buildGuide(){
 const guide=await fs.readFile('docs/CONFIGURACAO.md','utf8');
 const escape=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
 let fenced=false;
 const html=guide.split('\n').map(line=>{
  if(line.startsWith('```')){fenced=!fenced;return fenced?'<pre><code>':'</code></pre>';}
  if(fenced)return escape(line)+'\n';
  if(!line.trim())return '';
  const heading=line.match(/^(#{1,3}) (.*)/);
  if(heading)return `<h${heading[1].length}>${escape(heading[2])}</h${heading[1].length}>`;
  if(line.startsWith('- '))return `<p>• ${escape(line.slice(2))}</p>`;
  return `<p>${escape(line).replace(/`([^`]+)`/g,'<code>$1</code>')}</p>`;
 }).join('');
 await fs.writeFile('server/generated-guide.ts','export const guide='+JSON.stringify(html)+';');
}
