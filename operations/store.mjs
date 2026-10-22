import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {validateProduct,publicProduct,slugify} from '../lib/catalog.js';
import {requireValue,pricing,resolvePricingRules,validatePromotion,inventoryUpdate,orderTransition,analytics,cents} from './domain.mjs';
export const hash=value=>createHash('sha256').update(value).digest('hex');
export const now=()=>new Date().toISOString();
export const kinds=['products','categories','suppliers','pricingRules','inventoryLogs','priceChanges','shippingRules','returns','refundRequests','tickets','settings','checkouts','campaigns','promotions','customers'];
const secretKeys=/secret|password|apiKey|accessToken|privateKey/i;
function rejectSecrets(value){if(value&&typeof value==='object')for(const [key,item] of Object.entries(value)){requireValue(!secretKeys.test(key),'Credentials must be configured on the server, not stored in settings');rejectSecrets(item);}}
export class Store {
  constructor(path='private/operations.sqlite'){
    if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});
    this.db=new DatabaseSync(path);this.db.exec(readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));
  }
  close(){this.db.close();}
  transaction(fn){this.db.exec('BEGIN IMMEDIATE');try{const result=fn();this.db.exec('COMMIT');return result;}catch(error){this.db.exec('ROLLBACK');throw error;}}
  audit(actor,action,entity,details={}){this.db.prepare('INSERT INTO audit(actor,action,entity,details,created_at) VALUES(?,?,?,?,?)').run(actor,action,entity,JSON.stringify(details),now());}
  list(kind){requireValue(kinds.includes(kind),'Unknown collection',404);return this.db.prepare('SELECT data,version FROM records WHERE kind=? ORDER BY updated_at DESC').all(kind).map(r=>({...JSON.parse(r.data),version:r.version}));}
  get(kind,id){const row=this.db.prepare('SELECT data,version FROM records WHERE kind=? AND id=?').get(kind,id);return row?{...JSON.parse(row.data),version:row.version}:null;}
  rules(p,supplierId=p.supplierIds?.[0]){const rules=this.list('pricingRules');return resolvePricingRules(rules.find(r=>r.scope==='store')?.rules,rules.find(r=>r.scope==='supplier'&&r.targetId===supplierId)?.rules,rules.find(r=>r.scope==='category'&&r.targetId===p.category)?.rules,rules.find(r=>r.scope==='product'&&r.targetId===p.id)?.rules);}
  validate(kind,data){
    requireValue(kinds.includes(kind),'Unknown collection',404);requireValue(data&&typeof data==='object'&&!Array.isArray(data),'Record must be an object');
    requireValue(typeof data.id==='string'&&/^[A-Za-z0-9][A-Za-z0-9:_.-]{0,149}$/.test(data.id),'A safe record ID is required');rejectSecrets(data);
    if(kind==='products'){
      validateProduct(data);
      const current=this.list('products').filter(p=>p.id!==data.id),skuSet=new Set(current.flatMap(p=>(p.variants||[]).map(v=>v.sku)));
      for(const v of data.variants||[]){requireValue(v&&typeof v==='object'&&typeof v.id==='string'&&typeof v.sku==='string','Invalid variant');requireValue(!skuSet.has(v.sku),'Duplicate variant SKU');skuSet.add(v.sku);}
      if(data.status==='active'){
        const category=this.get('categories',data.category);requireValue(category&&category.children.some(s=>slugify(s)===data.subcategory),'Unknown category or subcategory');
        for(const v of data.variants){const result=pricing({...data,...v,sellingPriceCents:v.priceCents},this.rules(data));requireValue(!result.belowMinimum,'Product violates minimum price or margin rules');}
      }
      if(data.supplierIds)requireValue(Array.isArray(data.supplierIds)&&data.supplierIds.every(id=>this.get('suppliers',id)),'Unknown supplier association');
    }
    if(kind==='categories')requireValue(typeof data.name==='string'&&data.name.trim()&&Array.isArray(data.children)&&data.children.every(s=>typeof s==='string'&&s.trim()),'Category name and child names are required');
    if(kind==='suppliers'){requireValue(typeof data.name==='string'&&data.name.trim(),'Supplier name is required');requireValue(['draft','approved','disabled'].includes(data.status),'Invalid supplier status');requireValue(data.forwardingEnabled!==true,'Automated forwarding requires a separately approved adapter; it cannot be enabled here');}
    if(kind==='pricingRules'){requireValue(['store','category','supplier','product'].includes(data.scope),'Invalid pricing scope');pricing({supplierCostCents:10000},data.rules||{});}
    if(kind==='promotions')validatePromotion(data);
    if(kind==='shippingRules'){requireValue(Array.isArray(data.states)&&data.states.every(s=>/^[A-Z]{2}$/.test(s)),'Shipping states are required');requireValue(['standard','expedited'].includes(data.type),'Invalid shipping type');cents(data.amountCents);if(data.freeThresholdCents!=null)cents(data.freeThresholdCents);}
    if(kind==='settings')requireValue(data.currency==null||data.currency==='USD','Store currency must be USD');
    return data;
  }
  put(kind,input,actor,expectedVersion,{pricingApproved=false}={}){
    const data={...input};delete data.version;this.validate(kind,data);
    const existing=this.get(kind,data.id);
    if(kind==='products'&&(existing?.publishedAt||existing?.status==='active'))for(const variant of data.variants||[]){const before=existing.variants?.find(v=>v.id===variant.id);requireValue(!before||before.priceCents===variant.priceCents||pricingApproved,'Use a recorded pricing proposal to change published prices',409);}
    if(kind==='products'&&(existing?.publishedAt||data.status==='active'))data.publishedAt=existing?.publishedAt||now();
    if(kind==='products'&&existing&&data.supplierCostCents!==existing.supplierCostCents&&existing.supplierCostCents!=null){data.previousCostCents=existing.supplierCostCents;this.audit(actor,'supplier_cost_changed',data.id,{previousCostCents:existing.supplierCostCents,nextCostCents:data.supplierCostCents});}
    if(existing)requireValue(expectedVersion===existing.version,'Record changed; reload before saving',409);
    else requireValue(expectedVersion==null||expectedVersion===0,'Record no longer exists',409);
    const version=(existing?.version||0)+1;
    this.db.prepare('INSERT INTO records(kind,id,data,version,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(kind,id) DO UPDATE SET data=excluded.data,version=excluded.version,updated_at=excluded.updated_at').run(kind,data.id,JSON.stringify(data),version,now());
    this.audit(actor,existing?'update':'create',`${kind}/${data.id}`,{version});return {...data,version};
  }
  inventory(updates,actor){return this.transaction(()=>updates.map(update=>{
    const p=this.get('products',update.productId);requireValue(p,'Product not found',404);
    const v=p.variants.find(v=>v.id===update.variantId);requireValue(v,'Variant not found');
    const next=inventoryUpdate(v,update);p.variants=p.variants.map(v=>v.id===next.id?next:v);
    this.put('products',p,actor,p.version);
    this.put('inventoryLogs',{...update,id:randomUUID(),availability:next.availability,lowStock:next.lowStock,recordedAt:now()},actor);
    return {productId:p.id,variantId:v.id,availability:next.availability,lowStock:next.lowStock};
  }));}
  proposePrice(productId,variantId,actor){const p=this.get('products',productId),v=p?.variants.find(v=>v.id===variantId);requireValue(v,'Variant not found',404);const calculation=pricing({...p,...v,sellingPriceCents:v.priceCents},this.rules(p));return this.put('priceChanges',{id:randomUUID(),productId,variantId,productVersion:p.version,previousPriceCents:v.priceCents,nextPriceCents:calculation.suggestedPriceCents,calculation,status:calculation.requiresApproval?'approval_required':'proposed',createdAt:now()},actor);}
  applyPrice(id,actor,approved=false){return this.transaction(()=>{const change=this.get('priceChanges',id);requireValue(change&&['approval_required','proposed'].includes(change.status),'No pending change',409);requireValue(!change.calculation.requiresApproval||approved,'Owner approval required',403);const p=this.get('products',change.productId);requireValue(p.version===change.productVersion,'Product changed; calculate a fresh proposal',409);p.variants=p.variants.map(v=>v.id===change.variantId?{...v,priceCents:change.nextPriceCents}:v);this.put('products',p,actor,p.version,{pricingApproved:true});return this.put('priceChanges',{...change,status:'applied',approvedBy:approved?actor:null,appliedAt:now()},actor,change.version);});}
  applyPriceBatch(ids,actor,approved=false){return this.transaction(()=>{requireValue(Array.isArray(ids)&&ids.length>0&&ids.length<=1000&&new Set(ids).size===ids.length,'Choose unique pending proposals');const changes=ids.map(id=>this.get('priceChanges',id)),products=new Map(),variants=new Set();for(const c of changes){requireValue(c&&['approval_required','proposed'].includes(c.status),'Proposal is not pending',409);requireValue(!c.calculation.requiresApproval||approved,'Owner approval required',403);const p=products.get(c.productId)||this.get('products',c.productId);requireValue(p?.version===c.productVersion,'A product changed; create fresh proposals',409);const key=c.productId+':'+c.variantId;requireValue(!variants.has(key),'Multiple proposals target one variant');variants.add(key);p.variants=p.variants.map(v=>v.id===c.variantId?{...v,priceCents:c.nextPriceCents}:v);products.set(p.id,p);}for(const p of products.values())this.put('products',p,actor,p.version,{pricingApproved:true});return changes.map(c=>this.put('priceChanges',{...c,status:'applied',appliedAt:now(),approvedBy:approved?actor:null},actor,c.version));});}
  orders(){return this.db.prepare('SELECT data,version FROM orders ORDER BY created_at DESC').all().map(r=>({...JSON.parse(r.data),version:r.version}));}
  order(id){return this.orders().find(o=>o.id===id);}
  saveOrder(order,expectedVersion){const result=this.db.prepare('UPDATE orders SET data=?,version=version+1,payment_reference=? WHERE id=? AND version=?').run(JSON.stringify(order),order.paymentReference||null,order.id,expectedVersion);requireValue(result.changes===1,'Order changed; reload',409);return {...order,version:expectedVersion+1};}
  updateOrder(id,next,actor,details={}){return this.transaction(()=>{const order=this.order(id);requireValue(order,'Order not found',404);requireValue(order.version===details.version,'Order changed; reload',409);const result=orderTransition(order,next);if(next==='shipped')requireValue(order.carrier&&order.trackingNumber,'Carrier and tracking number required');result.history=[...(order.history||[]),{status:next,at:now(),actor}];this.saveOrder(result,order.version);this.audit(actor,'order_status',id,{from:order.status,to:next});this.enqueue(`order.${next}`,{orderId:id,email:order.email,orderNumber:order.orderNumber},`${id}:${next}`);return result;});}
  noteOrder(id,actor,{version,note,carrier,trackingNumber,trackingUrl,riskFlags}){return this.transaction(()=>{const o=this.order(id);requireValue(o&&o.version===version,'Order changed or missing',409);if(trackingUrl)requireValue(/^https:\/\//.test(trackingUrl),'Tracking URL must use HTTPS');if(riskFlags)requireValue(Array.isArray(riskFlags)&&riskFlags.every(f=>typeof f.reason==='string'&&typeof f.resolved==='boolean'),'Invalid risk flags');const next={...o,...(carrier?{carrier}:{}),...(trackingNumber?{trackingNumber}:{}),...(trackingUrl?{trackingUrl}:{}),...(riskFlags?{riskFlags}:{}),notes:[...(o.notes||[]),...(note?[{text:String(note).slice(0,5000),actor,at:now()}]:[])]};this.audit(actor,'order_details',id);return this.saveOrder(next,o.version);});}
  enqueue(kind,payload,eventKey){const id=randomUUID();this.db.prepare('INSERT OR IGNORE INTO outbox(id,event_key,kind,payload,next_attempt_at,updated_at) VALUES(?,?,?,?,?,?)').run(id,eventKey,kind,JSON.stringify(payload),Date.now(),now());return id;}
  notifications(){return this.db.prepare('SELECT id,event_key,kind,status,attempts,next_attempt_at,provider_reference,updated_at FROM outbox ORDER BY updated_at DESC').all();}
  report(includeProfit=false){return analytics(this.orders(),this.list('checkouts'),{includeProfit});}
  publicCatalog(){return this.list('products').filter(p=>p.status==='active').map(publicProduct);}
  limit(bucket,maximum=60,windowMs=60000){const time=Date.now();this.db.prepare('DELETE FROM rate_limits WHERE resets_at<?').run(time);const row=this.db.prepare('SELECT * FROM rate_limits WHERE bucket=?').get(bucket);if(!row||row.resets_at<=time){this.db.prepare('INSERT OR REPLACE INTO rate_limits VALUES(?,1,?)').run(bucket,time+windowMs);return true;}if(row.count>=maximum)return false;this.db.prepare('UPDATE rate_limits SET count=count+1 WHERE bucket=?').run(bucket);return true;}
}
