import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root=resolve('dist');
const config=JSON.parse(await readFile('vercel.json','utf8'));
const headers=Object.fromEntries(config.headers[0].headers.map(h=>[h.key,h.value]));
const mime={'.html':'text/html;charset=utf-8','.js':'application/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.json':'application/json;charset=utf-8'};
createServer(async(req,res)=>{
 try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const path=resolve(root,pathname==='/'?'index.html':`.${pathname}`);if(path!==root&&!path.startsWith(root+sep)){res.writeHead(403,headers);return res.end();}const content=await readFile(path);res.writeHead(200,{...headers,'Content-Type':mime[extname(path)]??'application/octet-stream'});res.end(content);}catch{res.writeHead(404,headers);res.end();}
}).listen(5194,'127.0.0.1');
