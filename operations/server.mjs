import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {Store,hash,now} from './store.mjs';
import {login,session,logout,permits,safeOrder} from './auth.mjs';
import {Commerce} from './commerce.mjs';
import {DomainError,requireValue,pricing} from './domain.mjs';
import {parseCSV,importProducts,importTemplate} from './import.mjs';
import {randomUUID} from 'node:crypto';
const writableKinds=new Set(['products','categories','suppliers','pricingRules','shippingRules','promotions','settings','campaigns']);
const cookieValue=(request,name)=>String(request.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(name+'='))?.slice(name.length+1);
async function body(request,raw=false){const chunks=[];let size=0;for await(const chunk of request){size+=chunk.length;requireValue(size<=5_500_000,'Request is too large',413);chunks.push(chunk);}const value=Buffer.concat(chunks);return raw?value:value.toString('utf8');}
export function createOperationsServer({store=new Store(),origin='http://127.0.0.1:8788',adapters={},production=false}={}) {
  const url=new URL(origin);requireValue(url.origin===origin,'APP_ORIGIN must be an origin without a path');
  requireValue(!production||url.protocol==='https:','Production requires an HTTPS origin');
  requireValue(production||['127.0.0.1','localhost','[::1]'].includes(url.hostname),'Development HTTP access is limited to loopback');
  const cookie=production?'__Host-dialashop-admin':'dialashop-admin',commerce=new Commerce(store,adapters);
  const server=createServer(async(req,res)=>{
    const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"};
    const send=(status,data,extra={})=>{res.writeHead(status,{...headers,...extra});res.end(typeof data==='string'?data:JSON.stringify(data));};
    try{
      const path=new URL(req.url,origin).pathname,method=req.method;
      requireValue(req.headers.host===url.host,'Host rejected',403);
      requireValue(store.limit('request:'+req.socket.remoteAddress,120),'Too many requests',429);
      if(method!=='GET'&&method!=='HEAD'&&!path.startsWith('/api/commerce/webhooks/'))requireValue(req.headers.origin===origin,'Origin rejected',403);
      if(path==='/health')return send(200,{status:'ok',paymentsConfigured:!!adapters.payments});
      if(path==='/api/admin/login'&&method==='POST'){
        const input=JSON.parse(await body(req));requireValue(typeof input.email==='string'&&input.email.length<=254,'Invalid credentials',401);
        requireValue(store.limit('login-ip:'+req.socket.remoteAddress,15,15*60000)&&store.limit('login-email:'+hash(input.email.toLowerCase()),8,15*60000),'Too many login attempts. Try later.',429);
        const result=await login(store,input.email,input.password);
        return send(200,{user:result.user,csrf:result.csrf},{'Set-Cookie':`${cookie}=${result.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${production?'; Secure':''}`});
      }
      const token=cookieValue(req,cookie),staff=session(store,token);
      if(path==='/admin/'||path==='/admin'){
        return send(200,await readFile(new URL(staff?'./admin/index.html':'./admin/login.html',import.meta.url),'utf8'),{'Content-Type':'text/html; charset=utf-8'});
      }
      if(path==='/admin/login.js'||path==='/admin/admin.css')return send(200,await readFile(new URL('./admin/'+path.split('/').pop(),import.meta.url),'utf8'),{'Content-Type':path.endsWith('.js')?'text/javascript; charset=utf-8':'text/css; charset=utf-8'});
      if(path==='/admin/admin.js'){requireValue(staff,'Sign in required',401);return send(200,await readFile(new URL('./admin/admin.js',import.meta.url),'utf8'),{'Content-Type':'text/javascript; charset=utf-8'});}
      if(path.startsWith('/api/admin/')){
        requireValue(staff,'Sign in required',401);
        if(method!=='GET')requireValue(req.headers['x-csrf-token']===staff.csrf,'CSRF validation failed',403);
        const scope=(resource,write=false)=>requireValue(permits(staff.role,resource,write),'Access denied',403);
        const input=method==='GET'?null:JSON.parse(await body(req)||'{}');
        const route=path.slice('/api/admin/'.length),parts=route.split('/');
        if(route==='session'&&method==='GET')return send(200,{user:{id:staff.id,email:staff.email,role:staff.role},csrf:staff.csrf});
        if(route==='logout'&&method==='POST'){logout(store,token);return send(200,{signedOut:true},{'Set-Cookie':`${cookie}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${production?'; Secure':''}`});}
        if(route==='overview'&&method==='GET'){
          const report=permits(staff.role,'analytics')?store.report(staff.role==='owner'):null;
          return send(200,{report,productCount:permits(staff.role,'products')?store.list('products').length:null,orderCount:permits(staff.role,'orders')?store.orders().length:null,lowStockAlerts:permits(staff.role,'inventoryLogs')?store.list('inventoryLogs').filter(l=>l.lowStock).length:null,integrations:{payments:!!adapters.payments,tax:!!adapters.tax,email:!!adapters.email,customerIdentity:!!adapters.customerAuth,supplierForwarding:false}});
        }
        if(route==='analytics'&&method==='GET'){scope('analytics');return send(200,store.report(staff.role==='owner'));}
        if(route==='audit'&&method==='GET'){scope('audit');return send(200,store.db.prepare('SELECT * FROM audit ORDER BY id DESC LIMIT 500').all());}
        if(route==='notifications'&&method==='GET'){scope('notifications');return send(200,store.notifications());}
        if(parts[0]==='import'){
          scope('import',true);
          if(route==='import/template'&&method==='GET')return send(200,importTemplate,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="dialashop-product-import.csv"'});
          requireValue(method==='POST','Method not allowed',405);requireValue(['import/preview','import/commit'].includes(route),'Unknown import operation',404);
          const execute=()=>{const report=importProducts(input.csv,input.mapping||{},store.list('products'));if(route==='import/commit'){requireValue(report.errors.length===0&&report.products.length>0,'Resolve every import error before committing');for(const p of report.products)store.put('products',p,staff.id);}return report;};
          return send(200,route==='import/commit'?store.transaction(execute):execute());
        }
        if(route==='inventory'&&method==='POST'){scope('inventory',true);requireValue(Array.isArray(input.updates)&&input.updates.length<=1000,'Provide up to 1000 inventory updates');return send(200,store.inventory(input.updates,staff.id));}
        if(route==='pricing/preview'&&method==='POST'){scope('pricing',true);return send(200,pricing(input.costs,input.rules));}
        if(route==='pricing/propose'&&method==='POST'){scope('pricing',true);return send(200,store.proposePrice(input.productId,input.variantId,staff.id));}
        if(route==='pricing/apply'&&method==='POST'){scope('pricing',true);if(input.approve)requireValue(staff.role==='owner','Owner approval required',403);return send(200,store.applyPrice(input.id,staff.id,input.approve===true));}
        if(route==='pricing/apply-batch'&&method==='POST'){scope('pricing',true);if(input.approve)requireValue(staff.role==='owner','Owner approval required',403);return send(200,store.applyPriceBatch(input.ids,staff.id,input.approve===true));}
        if(route==='products/bulk'&&method==='POST'){scope('products',true);requireValue(Array.isArray(input.ids)&&input.ids.length>0&&input.ids.length<=1000,'Choose products');const allowed=['category','subcategory','status','brand'];requireValue(input.patch&&Object.keys(input.patch).every(k=>allowed.includes(k)),'Unsupported bulk field');return send(200,store.transaction(()=>input.ids.map(id=>{const p=store.get('products',id);requireValue(p,'Product not found',404);requireValue(input.versions?.[id]===p.version,'Products changed; reload',409);return store.put('products',{...p,...input.patch},staff.id,p.version); })));}
        if(route==='export'&&method==='GET'){scope('export');const products=store.publicCatalog(),categories=store.list('categories').map(({id,name,children})=>({slug:id,name,children}));return send(200,{products,categories},{'Content-Disposition':'attachment; filename="dialashop-public-catalog.json"'});}
        if(parts[0]==='orders'){
          scope('orders',method!=='GET');if(method==='GET')return send(200,store.orders().map(o=>safeOrder(o,staff.role)));
          if(method==='POST'&&parts[2]==='transition')return send(200,store.updateOrder(parts[1],input.status,staff.id,input));
          if(method==='POST'&&parts[2]==='details')return send(200,store.noteOrder(parts[1],staff.id,input));
          if(method==='POST'&&parts[2]==='refund'){requireValue(staff.role==='owner','Only the owner can request refunds',403);return send(200,await commerce.requestRefund(parts[1],staff.id));}
          throw new DomainError('Order operation unavailable',404);
        }
        if(parts[0]==='returns'&&parts[2]==='review'&&method==='POST'){
          requireValue(['owner','fulfillment'].includes(staff.role),'Return review access denied',403);
          const r=store.get('returns',parts[1]);requireValue(r&&r.version===input.version,'Return request changed or missing',409);requireValue(['approved','rejected'].includes(input.status)&&r.status==='requested','Invalid return review',409);return send(200,store.put('returns',{...r,status:input.status,reviewNote:String(input.note||'').slice(0,5000),reviewedAt:now(),reviewedBy:staff.id},staff.id,r.version));
        }
        if(parts[0]==='tickets'&&parts[2]==='status'&&method==='POST'){scope('tickets',true);const t=store.get('tickets',parts[1]);requireValue(t&&t.version===input.version,'Ticket changed or missing',409);requireValue(['open','in_progress','waiting_customer','closed'].includes(input.status),'Invalid ticket status');return send(200,store.put('tickets',{...t,status:input.status,adminNote:String(input.note||'').slice(0,5000)},staff.id,t.version));}
        if(parts[0]==='records'){
          const kind=parts[1];scope(kind,method!=='GET');
          if(method==='GET')return send(200,store.list(kind));
          requireValue(method==='POST'&&writableKinds.has(kind),'This collection cannot be edited directly',403);
          return send(200,store.transaction(()=>store.put(kind,input.record,staff.id,input.version)));
        }
        throw new DomainError('Endpoint not found',404);
      }
      if(path.startsWith('/api/commerce/')){
        const route=path.slice('/api/commerce/'.length);
        if(route.startsWith('webhooks/')&&method==='POST')return send(200,await commerce.paymentWebhook(route.split('/')[1],await body(req,true),req.headers));
        requireValue(adapters.customerAuth?.authenticate,'Customer identity service is not configured',503);
        const identity=await adapters.customerAuth.authenticate(req);requireValue(identity?.id&&identity?.email,'Customer verification is required',401);
        if(method!=='GET')requireValue(await adapters.customerAuth.verifyCSRF?.(req,identity),'Customer CSRF verification failed',403);
        const input=method==='GET'?{}:JSON.parse(await body(req));
        if(route==='quote'&&method==='POST')return send(200,await commerce.quote(input,identity));
        if(route==='checkout'&&method==='POST')return send(200,await commerce.checkout(input,identity));
        if(route==='tracking'&&method==='POST')return send(200,commerce.tracking(input.orderId,identity));
        if(route==='returns'&&method==='POST')return send(200,commerce.requestReturn(input,identity));
        if(route==='returns'&&method==='GET')return send(200,store.list('returns').filter(r=>r.customerId===identity.id));
        if(route==='tickets'&&method==='POST')return send(200,commerce.ticket(input,identity));
        if(route==='tickets'&&method==='GET')return send(200,store.list('tickets').filter(t=>t.customerId===identity.id).map(({adminNote,...t})=>t));
        if(route==='recovery'&&method==='POST')return send(200,commerce.saveRecovery(input,identity));
        if(route==='recover'&&method==='POST')return send(200,commerce.restore(input.token,identity));
        if(route==='preferences'&&method==='POST')return send(200,commerce.preferences(identity,input.recoveryConsent));
        if(route==='orders'&&method==='GET')return send(200,store.orders().filter(o=>o.customerId===identity.id).map(o=>({...commerce.tracking(o.id,identity),items:o.items.map(({productId,variantId,name,quantity,priceCents})=>({productId,variantId,name,quantity,priceCents})),totalCents:o.totalCents})));
      }
      return send(404,{error:'Not found'});
    }catch(error){const status=error instanceof DomainError?error.status:error instanceof SyntaxError?400:error.code?.startsWith('ERR_SQLITE')?409:500;return send(status,{error:status===500?'Service error; check server logs':status===409&&!(error instanceof DomainError)?'Record conflicts with existing data':error.message});}
  });
  server.requestTimeout=30000;server.headersTimeout=15000;
  return {server,store,commerce};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const adapters=process.env.OPERATIONS_ADAPTER_MODULE?(await import(pathToFileURL(resolve(process.env.OPERATIONS_ADAPTER_MODULE)).href)).default:{};
  const port=Number(process.env.OPERATIONS_PORT||8788),origin=process.env.APP_ORIGIN||`http://127.0.0.1:${port}`;
  const {server}=createOperationsServer({store:new Store(process.env.OPERATIONS_DB),origin,adapters,production:process.env.NODE_ENV==='production'});
  server.listen(port,'127.0.0.1',()=>console.log(`Private operations server: ${origin}/admin/`));
}
