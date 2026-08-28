import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { Store, reliability } from './store.js';

const port = Number(process.env.PORT || 3000);
const publicDir = resolve('src/public');
const store = new Store(resolve(process.env.DATA_FILE || './data/toolshed.json'));
const sessions = new Map();
await store.load();

const json = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
const body = async req => { const chunks=[]; for await (const c of req) chunks.push(c); return JSON.parse(Buffer.concat(chunks).toString() || '{}'); };
const memberFor = req => store.data.members.find(m => m.id === sessions.get((req.headers.authorization || '').replace('Bearer ', '')));
const clean = value => String(value || '').trim();

async function api(req, res, path) {
  if (req.method === 'GET' && path === '/api/config') return json(res, 200, { chainId: Number(process.env.CHAIN_ID || 84532), contract: process.env.TOOLSHED_ADDRESS || '', usdc: process.env.USDC_ADDRESS || '' });
  if (req.method === 'POST' && path === '/api/join') {
    const input = await body(req); const wallet = clean(input.wallet).toLowerCase();
    if (clean(input.inviteCode) !== (process.env.INVITE_CODE || 'change-me')) return json(res, 403, { error: 'Invalid association invite code' });
    if (!/^0x[0-9a-f]{40}$/.test(wallet) || !clean(input.name)) return json(res, 400, { error: 'Name and wallet are required' });
    let member = store.data.members.find(m => m.wallet === wallet);
    if (!member) { member = { id: store.id(), name: clean(input.name).slice(0, 80), wallet, joinedAt: new Date().toISOString() }; store.data.members.push(member); await store.save(); }
    const token = randomBytes(24).toString('hex'); sessions.set(token, member.id); return json(res, 200, { token, member });
  }
  const member = memberFor(req); if (!member) return json(res, 401, { error: 'Join or sign in first' });
  if (req.method === 'GET' && path === '/api/me') return json(res, 200, { ...member, reputation: reliability(member, store.data.requests) });
  if (req.method === 'GET' && path === '/api/tools') {
    const tools = store.data.tools.map(t => ({ ...t, owner: store.data.members.find(m => m.id === t.ownerId), ownerReputation: reliability(store.data.members.find(m => m.id === t.ownerId), store.data.requests) }));
    tools.sort((a,b) => (b.ownerReputation.score ?? -1) - (a.ownerReputation.score ?? -1) || b.ownerReputation.loans - a.ownerReputation.loans || b.createdAt.localeCompare(a.createdAt));
    return json(res, 200, tools);
  }
  if (req.method === 'POST' && path === '/api/tools') {
    const input=await body(req); if (!clean(input.name) || !clean(input.condition) || !/^https?:\/\//.test(clean(input.photoUrl))) return json(res,400,{error:'Name, condition, and an http(s) photo URL are required'});
    const tool={id:store.id(),ownerId:member.id,name:clean(input.name).slice(0,100),condition:clean(input.condition).slice(0,500),photoUrl:clean(input.photoUrl).slice(0,1000),available:true,createdAt:new Date().toISOString()}; store.data.tools.push(tool); await store.save(); return json(res,201,tool);
  }
  if (req.method === 'GET' && path === '/api/requests') {
    const mine = store.data.requests.filter(r => r.borrowerId===member.id || r.ownerId===member.id).map(r => ({...r,tool:store.data.tools.find(t=>t.id===r.toolId),borrower:store.data.members.find(m=>m.id===r.borrowerId),owner:store.data.members.find(m=>m.id===r.ownerId),borrowerReputation:reliability(store.data.members.find(m=>m.id===r.borrowerId),store.data.requests)}));
    mine.sort((a,b)=>(b.borrowerReputation.score??-1)-(a.borrowerReputation.score??-1)||b.borrowerReputation.loans-a.borrowerReputation.loans||b.createdAt.localeCompare(a.createdAt)); return json(res,200,mine);
  }
  if (req.method === 'POST' && path === '/api/requests') {
    const input=await body(req), tool=store.data.tools.find(t=>t.id===input.toolId&&t.available); if(!tool||tool.ownerId===member.id)return json(res,400,{error:'Tool is unavailable'});
    const days=Number(input.days), deposit=Number(input.deposit), dailyLateFee=Number(input.dailyLateFee); if(!Number.isInteger(days)||days<1||days>30||deposit<=0||dailyLateFee<0||dailyLateFee>deposit)return json(res,400,{error:'Invalid loan terms'});
    const request={id:store.id(),toolId:tool.id,ownerId:tool.ownerId,borrowerId:member.id,days,deposit,dailyLateFee,status:'requested',loanId:null,lateDays:0,createdAt:new Date().toISOString()}; store.data.requests.push(request); await store.save(); return json(res,201,request);
  }
  const match=path.match(/^\/api\/requests\/([^/]+)\/status$/);
  if(req.method==='PATCH'&&match){const input=await body(req),r=store.data.requests.find(x=>x.id===match[1]);if(!r)return json(res,404,{error:'Not found'});
    const allowed={requested:['funded','declined'],funded:['active','cancelled'],active:['returned']};if(!allowed[r.status]?.includes(input.status))return json(res,400,{error:'Invalid transition'});
    if((input.status==='declined'||input.status==='active'||input.status==='returned')&&r.ownerId!==member.id)return json(res,403,{error:'Owner action required'});if((input.status==='funded'||input.status==='cancelled')&&r.borrowerId!==member.id)return json(res,403,{error:'Borrower action required'});
    r.status=input.status;if(input.loanId)r.loanId=clean(input.loanId);if(input.status==='funded')r.dueAt=new Date(Date.now()+r.days*86400000).toISOString();if(input.status==='returned')r.lateDays=Math.max(0,Math.ceil((Date.now()-new Date(r.dueAt).getTime())/86400000));await store.save();return json(res,200,r);}
  return json(res,404,{error:'Not found'});
}

const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');if(url.pathname.startsWith('/api/'))return await api(req,res,url.pathname);const path=url.pathname==='/'?'index.html':url.pathname.slice(1);const file=join(publicDir,path);if(!file.startsWith(publicDir))throw new Error('Invalid path');const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream'});res.end(await readFile(file));}catch(error){if(error.code==='ENOENT'){res.writeHead(404);res.end('Not found');}else{console.error(error);json(res,500,{error:'Server error'});}}});
server.listen(port,()=>console.log(`Toolshed running at http://localhost:${port}`));
