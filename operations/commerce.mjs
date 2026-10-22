import {randomUUID,randomBytes} from 'node:crypto';
import {validateAddress} from '../lib/catalog.js';
import {requireValue,discount,shippingQuote,orderTransition,pricing} from './domain.mjs';
import {hash,now} from './store.mjs';
export class Commerce {
  constructor(store,adapters={}){this.store=store;this.adapters=adapters;}
  cart(items){requireValue(Array.isArray(items)&&items.length>0&&items.length<=100,'Invalid cart');const seen=new Set();return items.map(item=>{
    requireValue(Number.isSafeInteger(item.quantity)&&item.quantity>0&&item.quantity<=99,'Invalid quantity');const p=this.store.get('products',item.productId),v=p?.variants.find(v=>v.id===item.variantId);requireValue(p?.status==='active'&&v?.availability==='in_stock','Product unavailable',409);
    const key=JSON.stringify([p.id,v.id]);requireValue(!seen.has(key),'Duplicate cart line');seen.add(key);
    const protection=pricing({...p,...v,sellingPriceCents:v.priceCents},this.store.rules(p));requireValue(!protection.belowMinimum,'Product pricing needs review',409);
    requireValue(v.stockQuantity!=null&&v.inventoryCheckedAt&&Date.now()-Date.parse(v.inventoryCheckedAt)<(this.store.get('settings','inventory')?.maxAgeMinutes??60)*60000,'Reliable inventory is not available',409);
    requireValue(v.stockQuantity>=item.quantity,'Insufficient inventory',409);
    return {productId:p.id,variantId:v.id,name:p.name,category:p.category,supplierId:p.supplierIds?.[0]||null,priceCents:v.priceCents,quantity:item.quantity,productVersion:p.version,returnPolicy:p.returnPolicy};
  });}
  async quote(input,identity){
    requireValue(validateAddress(input.address),'A complete US shipping address is required');const items=this.cart(input.items),methods=shippingQuote(input.address,items,this.store.list('shippingRules'));
    requireValue(this.adapters.tax?.calculate,'Tax service is not configured',503);
    let promotion=null,applied={discountCents:0,freeShipping:false};
    if(input.coupon){promotion=this.store.list('promotions').find(p=>p.code===String(input.coupon).toUpperCase());requireValue(promotion,'Invalid promotion code');const used=this.store.db.prepare('SELECT count(*) AS count FROM promotion_redemptions WHERE code=?').get(promotion.code).count;applied=discount(items,promotion,{used});}
    const subtotalCents=items.reduce((s,l)=>s+l.priceCents*l.quantity,0),quoteMethods=[];
    for(const method of methods){const shippingCents=applied.freeShipping?0:method.amountCents;const tax=await this.adapters.tax.calculate({address:input.address,items,discountCents:applied.discountCents,shippingCents,currency:'USD'});requireValue(Number.isSafeInteger(tax?.taxCents)&&tax.taxCents>=0&&tax.reference,'Tax provider returned no valid calculation',502);quoteMethods.push({...method,amountCents:shippingCents,taxCents:tax.taxCents,taxReference:tax.reference,totalCents:subtotalCents-applied.discountCents+shippingCents+tax.taxCents});}
    const record={id:randomUUID(),kind:'quote',customerId:identity.id,email:identity.email,items,address:input.address,shippingMethods:quoteMethods,subtotalCents,discountCents:applied.discountCents,promotionCode:promotion?.code||null,currency:'USD',expiresAt:Date.now()+15*60000,createdAt:now()};this.store.put('checkouts',record,identity.id);
    return record;
  }
  async checkout(input,identity){
    requireValue(typeof input.idempotencyKey==='string'&&/^[\w-]{16,100}$/.test(input.idempotencyKey),'A valid idempotency key is required');
    requireValue(['stripe','paypal'].includes(input.provider),'Choose a supported payment provider');const provider=this.adapters.payments?.[input.provider];requireValue(provider?.createSession&&provider?.verifyEvent,'Payment provider is not configured',503);
    const fingerprint=hash(JSON.stringify({customerId:identity.id,quoteId:input.quoteId,shippingMethodId:input.shippingMethodId,provider:input.provider}));
    const order=this.store.transaction(()=>{
      const previous=this.store.db.prepare('SELECT data,request_hash FROM orders WHERE idempotency_key=?').get(input.idempotencyKey);
      if(previous){requireValue(previous.request_hash===fingerprint,'Idempotency key is already used for another request',409);return JSON.parse(previous.data);}
      const q=this.store.get('checkouts',input.quoteId);requireValue(q?.kind==='quote'&&q.customerId===identity.id&&q.expiresAt>Date.now(),'Quote expired or unavailable',409);this.cart(q.items);
      for(const line of q.items)requireValue(this.store.get('products',line.productId).version===line.productVersion,'Product changed; obtain a fresh quote',409);
      const method=q.shippingMethods.find(m=>m.id===input.shippingMethodId);requireValue(method,'Invalid shipping method');
      if(q.promotionCode){const p=this.store.list('promotions').find(p=>p.code===q.promotionCode);requireValue(p,'Promotion no longer available',409);const used=this.store.db.prepare('SELECT count(*) AS count FROM promotion_redemptions WHERE code=?').get(p.code).count;discount(q.items,p,{used});}
      const id=randomUUID(),data={id,orderNumber:'DS-'+randomBytes(8).toString('hex').toUpperCase(),customerId:identity.id,email:identity.email,address:q.address,items:q.items,provider:input.provider,status:'pending_payment',paymentStatus:'pending',subtotalCents:q.subtotalCents,discountCents:q.discountCents,taxCents:method.taxCents,shippingCents:method.amountCents,totalCents:method.totalCents,currency:'USD',riskFlags:[],history:[{status:'pending_payment',at:now(),actor:'checkout'}],createdAt:now(),quoteId:q.id};
      // Pending orders reserve known inventory; availability checks are serialized by BEGIN IMMEDIATE.
      for(const line of q.items){const existing=this.store.orders().filter(o=>o.status==='pending_payment'&&Date.parse(o.createdAt)>Date.now()-30*60000).flatMap(o=>o.items).filter(l=>l.productId===line.productId&&l.variantId===line.variantId).reduce((s,l)=>s+l.quantity,0);const v=this.store.get('products',line.productId).variants.find(v=>v.id===line.variantId);requireValue(v.stockQuantity-existing>=line.quantity,'Inventory is reserved by another checkout',409);}
      this.store.db.prepare('INSERT INTO orders(id,order_number,customer_id,data,idempotency_key,request_hash,created_at) VALUES(?,?,?,?,?,?,?)').run(id,data.orderNumber,identity.id,JSON.stringify(data),input.idempotencyKey,fingerprint,now());
      if(q.promotionCode)this.store.db.prepare('INSERT INTO promotion_redemptions VALUES(?,?)').run(q.promotionCode,id);
      this.store.audit(identity.id,'checkout_created',id);return data;
    });
    // Provider must honor this stable key; retries recover the same remote session.
    const result=await provider.createSession({order,idempotencyKey:order.id,expiresAfterMinutes:30});
    requireValue(result?.id&&typeof result.url==='string'&&provider.allowedCheckoutHosts?.includes(new URL(result.url).hostname)&&new URL(result.url).protocol==='https:','Payment provider returned an invalid hosted session',502);
    this.store.transaction(()=>{const latest=this.store.order(order.id);if(latest.paymentReference)requireValue(latest.paymentReference===result.id,'Payment reference mismatch',409);else this.store.saveOrder({...latest,paymentReference:result.id},latest.version);});
    return {orderId:order.id,url:result.url};
  }
  async paymentWebhook(providerName,raw,headers){
    const adapter=this.adapters.payments?.[providerName];requireValue(adapter?.verifyEvent,'Webhook verifier is not configured',503);
    const event=await adapter.verifyEvent(raw,headers); // Must verify signature and freshness before returning a normalized event.
    requireValue(event?.id&&event.orderId&&event.reference,'Webhook verification failed',401);
    return this.store.transaction(()=>{
      if(this.store.db.prepare('SELECT 1 FROM webhook_events WHERE provider=? AND event_id=?').get(providerName,event.id))return {duplicate:true};
      const order=this.store.order(event.orderId);requireValue(order&&order.provider===providerName&&order.paymentReference===event.reference,'Webhook does not match an order',409);
      requireValue(event.currency==='USD'&&event.amountCents===order.totalCents,'Payment amount or currency mismatch',409);
      let next;
      if(event.type==='paid'){
        if(order.paymentStatus==='paid')next=order;
        else {next=orderTransition(order,'paid',{verifiedPayment:true});
          for(const line of order.items){const p=this.store.get('products',line.productId),v=p?.variants.find(v=>v.id===line.variantId);if(!v||v.stockQuantity<line.quantity||Date.parse(order.createdAt)<Date.now()-30*60000){next.riskFlags=[...next.riskFlags,{reason:'Inventory or payment timing requires manual review',resolved:false}];continue;}const quantity=v.stockQuantity-line.quantity;p.variants=p.variants.map(v=>v.id===line.variantId?{...v,stockQuantity:quantity,availability:quantity===0?'out_of_stock':v.availability}:v);this.store.put('products',p,'verified-payment',p.version);}
        }
      }else if(event.type==='refunded'){
        requireValue(order.paymentStatus==='paid','Original payment is not confirmed',409);
        // Full refunds are verified independently of operational return/cancellation status.
        next={...order,status:'refunded',paymentStatus:'refunded',refundedCents:event.amountCents};
      }else throw Object.assign(Error('Unsupported normalized payment event'),{status:400});
      next.history=[...(next.history||[]),{status:next.status,at:now(),actor:`webhook:${providerName}`}];
      this.store.saveOrder(next,order.version);this.store.db.prepare('INSERT INTO webhook_events VALUES(?,?,?)').run(providerName,event.id,now());
      this.store.enqueue(`order.${next.status}`,{orderId:order.id,orderNumber:order.orderNumber,email:order.email},`${order.id}:payment:${event.type}`);this.store.audit(`provider:${providerName}`,event.type,order.id);return {accepted:true};
    });
  }
  tracking(orderId,identity){const o=this.store.order(orderId);requireValue(o&&o.customerId===identity.id,'Order not found',404);return {id:o.id,orderNumber:o.orderNumber,status:o.status,paymentStatus:o.paymentStatus,carrier:o.carrier||null,trackingNumber:o.trackingNumber||null,trackingUrl:o.trackingUrl||null,history:o.history.map(({status,at})=>({status,at}))};}
  async requestRefund(orderId,actor){
    const order=this.store.order(orderId);requireValue(order&&order.paymentStatus==='paid'&&['cancelled','returned'].includes(order.status),'Order must be paid and cancelled or returned before requesting a full refund',409);
    const provider=this.adapters.payments?.[order.provider];requireValue(provider?.requestRefund,'Refund provider is not configured',503);
    const id='refund-'+order.id,existing=this.store.get('refundRequests',id);if(existing?.status==='submitted')return existing;
    const request=existing||this.store.put('refundRequests',{id,orderId,amountCents:order.totalCents,status:'requested',createdAt:now()},actor);
    const receipt=await provider.requestRefund({order,idempotencyKey:id});requireValue(receipt?.id,'Provider did not acknowledge the refund request',502);
    return this.store.put('refundRequests',{...request,status:'submitted',providerReference:receipt.id,submittedAt:now()},actor,request.version);
  }
  requestReturn(input,identity){const order=this.store.order(input.orderId);requireValue(order&&order.customerId===identity.id,'Order not found',404);const policy=this.store.get('settings','returns');requireValue(policy?.enabled&&Number.isInteger(policy.windowDays),'Return policy is not configured',503);requireValue(['delivered','shipped'].includes(order.status),'This order requires manual support review',409);const delivered=order.history.find(h=>h.status==='delivered')?.at;requireValue(delivered&&Date.now()-Date.parse(delivered)<=policy.windowDays*86400000,'Return eligibility requires support review',409);requireValue(typeof input.reason==='string'&&input.reason.trim().length>=3,'A return reason is required');requireValue(Array.isArray(input.items)&&input.items.length>0&&new Set(input.items.map(l=>l.variantId)).size===input.items.length,'Choose items to return');for(const l of input.items){const original=order.items.find(i=>i.productId===l.productId&&i.variantId===l.variantId);requireValue(original&&Number.isInteger(l.quantity)&&l.quantity>0&&l.quantity<=original.quantity,'Invalid return quantity');}requireValue(!this.store.list('returns').some(r=>r.orderId===order.id&&!['rejected','closed'].includes(r.status)),'A return request is already open',409);return this.store.transaction(()=>{const record=this.store.put('returns',{id:randomUUID(),orderId:order.id,orderNumber:order.orderNumber,customerId:identity.id,email:identity.email,items:input.items,reason:input.reason,status:'requested',refundStatus:'not_requested',createdAt:now()},identity.id);this.store.enqueue('return.requested',{orderNumber:order.orderNumber,email:identity.email},`${record.id}:requested`);return record;});}
  ticket(input,identity){requireValue(typeof input.subject==='string'&&input.subject.trim()&&typeof input.message==='string'&&input.message.trim(),'Subject and message are required');if(input.orderId)requireValue(this.store.order(input.orderId)?.customerId===identity.id,'Order not found',404);return this.store.transaction(()=>{const ticket=this.store.put('tickets',{id:randomUUID(),customerId:identity.id,email:identity.email,subject:input.subject.slice(0,200),message:input.message.slice(0,5000),orderId:input.orderId||null,status:'open',createdAt:now()},identity.id);this.store.enqueue('support.ticket_created',{email:identity.email,ticketId:ticket.id},`ticket:${ticket.id}:created`);return ticket;});}
  saveRecovery(input,identity){requireValue(input.consent===true,'Explicit recovery consent is required');const items=this.cart(input.items);return this.store.put('checkouts',{id:randomUUID(),kind:'recovery',customerId:identity.id,email:identity.email,items,recoveryConsent:true,status:'open',campaignId:input.campaignId||null,consentedAt:now(),updatedAt:now()},identity.id);}
  abandon({afterMinutes=60}={}){requireValue(Number.isFinite(afterMinutes)&&afterMinutes>=15,'Recovery delay must be at least 15 minutes');let count=0;for(const c of this.store.list('checkouts').filter(c=>c.kind==='recovery'&&c.status==='open'&&c.recoveryConsent&&Date.parse(c.updatedAt)<Date.now()-afterMinutes*60000)){this.store.put('checkouts',{...c,status:'abandoned'},'recovery-worker',c.version);count++;}return count;}
  recoveryLink(checkoutId,baseURL){const c=this.store.get('checkouts',checkoutId);requireValue(c?.kind==='recovery'&&c.status==='abandoned'&&c.recoveryConsent,'Checkout is not eligible for reminders');requireValue(this.adapters.email?.send,'Email is not configured',503);requireValue(new URL(baseURL).protocol==='https:','Recovery base URL must be HTTPS');const token=randomBytes(32).toString('base64url');this.store.transaction(()=>{this.store.db.prepare('INSERT INTO recovery_tokens VALUES(?,?,?,?,NULL)').run(hash(token),c.id,c.customerId,Date.now()+7*86400000);this.store.enqueue('checkout.recovery',{checkoutId:c.id,email:c.email,recoveryUrl:`${baseURL}/recover?token=${token}`,preferencesUrl:`${baseURL}/preferences`},`recovery:${c.id}`);});return {queued:true};}
  restore(token,identity){return this.store.transaction(()=>{const row=this.store.db.prepare('SELECT * FROM recovery_tokens WHERE token_hash=?').get(hash(token));requireValue(row&&row.customer_id===identity.id&&!row.used_at&&row.expires_at>Date.now(),'Recovery link expired or unavailable',404);const c=this.store.get('checkouts',row.checkout_id);requireValue(c?.recoveryConsent,'Recovery consent was withdrawn',409);const items=this.cart(c.items);this.store.db.prepare('UPDATE recovery_tokens SET used_at=? WHERE token_hash=?').run(Date.now(),hash(token));return {items:items.map(({productId,variantId,quantity})=>({productId,variantId,quantity}))};});}
  preferences(identity,consent){requireValue(typeof consent==='boolean','Invalid consent preference');return this.store.transaction(()=>{for(const c of this.store.list('checkouts').filter(c=>c.customerId===identity.id&&c.kind==='recovery'))this.store.put('checkouts',{...c,recoveryConsent:consent},identity.id,c.version);return {recoveryConsent:consent};});}
}
