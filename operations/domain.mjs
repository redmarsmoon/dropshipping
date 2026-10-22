// Server-only business rules. All money values are integer USD cents.
export class DomainError extends Error { constructor(message,status=400){super(message);this.status=status;} }
export const requireValue=(condition,message,status=400)=>{if(!condition)throw new DomainError(message,status);};
export function cents(value,name='amount'){requireValue(Number.isSafeInteger(value)&&value>=0,`${name} must be non-negative integer cents`);return value;}
const rate=(value,name)=>{requireValue(typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<1,`${name} must be between 0 and 1`);return value;};
export function pricing(input,rules={}) {
  const cost=cents(input.supplierCostCents,'supplier cost')+cents(input.supplierShippingCents??0)+cents(input.fulfillmentCents??0);
  const feeRate=rate(rules.transactionRate??0,'transaction rate'),feeFixed=cents(rules.transactionFixedCents??0);
  const margin=rate(rules.targetMargin??0,'target margin');
  requireValue(feeRate+margin<1,'Transaction fee and margin leave no revenue');
  const markup=rules.markupRate??0;requireValue(Number.isFinite(markup)&&markup>=0,'Invalid markup rate');
  const minimum=cents(rules.minimumPriceCents??0),fixed=cents(rules.fixedMarkupCents??0);
  const floor=Math.ceil((cost+feeFixed)/(1-feeRate-margin));
  const suggestedPriceCents=Math.max(minimum,floor,Math.ceil(cost*(1+markup)+fixed));
  const current=cents(input.sellingPriceCents??suggestedPriceCents);
  const profitCents=current-cost-Math.ceil(current*feeRate)-feeFixed;
  const marginRate=current?profitCents/current:0;
  const limit=rules.maxAdjustmentRate??0;requireValue(Number.isFinite(limit)&&limit>=0,'Invalid adjustment limit');
  const adjustmentRate=current?Math.abs(suggestedPriceCents-current)/current:1;
  return {costCents:cost,suggestedPriceCents,profitCents,marginRate,belowMinimum:current<minimum||marginRate+1e-9<margin,costIncreased:input.previousCostCents!=null&&cost>cents(input.previousCostCents),requiresApproval:adjustmentRate>limit,adjustmentRate};
}
export function resolvePricingRules(settings={},supplier={},category={},product={}){return {...settings,...supplier,...category,...product};}
export const transitions={pending_payment:['paid','cancelled'],paid:['processing','cancelled'],processing:['sent_to_supplier','cancelled'],sent_to_supplier:['fulfilled','cancelled'],fulfilled:['shipped'],shipped:['delivered','returned'],delivered:['returned'],cancelled:['refunded'],returned:['refunded'],refunded:[]};
export function orderTransition(order,next,{verifiedPayment=false,verifiedRefund=false,supplierApproved=false}={}) {
  requireValue(transitions[order.status]?.includes(next),'Invalid order status transition',409);
  if(next==='paid')requireValue(verifiedPayment,'Payment must be verified by the provider',409);
  if(next==='refunded')requireValue(verifiedRefund,'Refund must be confirmed by the provider',409);
  if(next==='sent_to_supplier')requireValue(supplierApproved,'Supplier forwarding is not configured and approved',409);
  if(['processing','sent_to_supplier','fulfilled','shipped','delivered'].includes(next))requireValue(order.paymentStatus==='paid','Order is not paid',409);
  if(['processing','sent_to_supplier'].includes(next))requireValue(!(order.riskFlags||[]).some(f=>!f.resolved),'Risk flags require review',409);
  return {...order,status:next,paymentStatus:next==='paid'?'paid':next==='refunded'?'refunded':order.paymentStatus};
}
export function inventoryUpdate(variant,update,now=Date.now()) {
  requireValue(update.quantity===null||Number.isSafeInteger(update.quantity)&&update.quantity>=0,'Quantity must be known non-negative integer or null');
  requireValue(['manual','supplier'].includes(update.source),'Inventory source is required');
  requireValue(update.lowStockThreshold==null||Number.isSafeInteger(update.lowStockThreshold)&&update.lowStockThreshold>=0,'Low-stock threshold must be non-negative');
  requireValue(Number.isFinite(Date.parse(update.checkedAt))&&Date.parse(update.checkedAt)<=now+60000,'Invalid inventory timestamp');
  requireValue(!variant.inventoryCheckedAt||Date.parse(update.checkedAt)>=Date.parse(variant.inventoryCheckedAt),'Stale inventory update',409);
  return {...variant,stockQuantity:update.quantity,availability:update.quantity===null?'unknown':update.quantity===0?'out_of_stock':'in_stock',inventoryCheckedAt:update.checkedAt,inventorySource:update.source,lowStock:update.quantity!=null&&update.quantity<=(update.lowStockThreshold??0)};
}
export function validatePromotion(p){
  requireValue(typeof p.code==='string'&&/^[A-Z0-9_-]{3,40}$/.test(p.code),'Use an uppercase promotion code');
  requireValue(['percent','fixed','free_shipping','bundle'].includes(p.type),'Invalid promotion type');
  if(p.type==='percent'||p.type==='bundle')requireValue(Number.isInteger(p.percent)&&p.percent>0&&p.percent<=100,'Percentage must be 1–100');
  if(p.type==='fixed')cents(p.amountCents);
  cents(p.minimumOrderCents??0);
  if(p.usageLimit!=null)requireValue(Number.isInteger(p.usageLimit)&&p.usageLimit>0,'Usage limit must be positive');
  if(p.startsAt)requireValue(Number.isFinite(Date.parse(p.startsAt)),'Invalid start date');
  if(p.endsAt)requireValue(Number.isFinite(Date.parse(p.endsAt))&&(!p.startsAt||Date.parse(p.endsAt)>Date.parse(p.startsAt)),'Invalid expiration');
  if(p.type==='bundle')requireValue(Array.isArray(p.bundleProductIds)&&p.bundleProductIds.length>=2,'Bundle requires at least two product IDs');
  return p;
}
export function discount(lines,p,{used=0,now=Date.now()}={}) {
  validatePromotion(p);
  const subtotal=lines.reduce((sum,l)=>sum+cents(l.priceCents)*l.quantity,0);
  requireValue(p.active===true&&(!p.startsAt||Date.parse(p.startsAt)<=now)&&(!p.endsAt||Date.parse(p.endsAt)>now),'Promotion is not active');
  requireValue(!p.usageLimit||used<p.usageLimit,'Promotion usage limit reached');
  requireValue(subtotal>=(p.minimumOrderCents??0),'Promotion minimum has not been met');
  if(p.type==='bundle')requireValue(p.bundleProductIds.every(id=>lines.some(l=>l.productId===id)),'Bundle requirements not met');
  const eligible=lines.filter(l=>(!p.productIds?.length||p.productIds.includes(l.productId))&&(!p.categoryIds?.length||p.categoryIds.includes(l.category))&&(p.type!=='bundle'||p.bundleProductIds.includes(l.productId))).reduce((s,l)=>s+l.priceCents*l.quantity,0);
  requireValue(eligible>0,'No eligible products');
  const discountCents=p.type==='fixed'?Math.min(eligible,p.amountCents):p.type==='free_shipping'?0:Math.floor(eligible*p.percent/100);
  return {discountCents,freeShipping:p.type==='free_shipping',subtotalCents:subtotal};
}
export function shippingQuote(address,lines,rules){
  requireValue(address.country==='US','US shipping only');
  requireValue(Array.isArray(rules)&&rules.length,'Shipping rules are not configured',503);
  const subtotal=lines.reduce((s,l)=>s+l.priceCents*l.quantity,0);
  const eligible=rules.filter(r=>r.active===true&&r.states?.includes(address.state)&&(!r.zipPrefixes?.length||r.zipPrefixes.some(p=>address.zip.startsWith(p)))&&!lines.some(l=>(r.excludedProductIds||[]).includes(l.productId)));
  requireValue(eligible.length,'No configured shipping method serves this destination',422);
  return eligible.map(r=>{requireValue(['standard','expedited'].includes(r.type),'Invalid shipping type');cents(r.amountCents);if(r.freeThresholdCents!=null)cents(r.freeThresholdCents);return {id:r.id,label:r.label,type:r.type,amountCents:r.freeThresholdCents!=null&&subtotal>=r.freeThresholdCents?0:r.amountCents,estimate:r.estimate||null};});
}
export function recommendations(products,seedIds,type='related',limit=4){
  const seeds=products.filter(p=>seedIds.includes(p.id));
  const field={related:'relatedIds',accessories:'accessoryIds',complementary:'complementaryIds',together:'frequentlyBoughtTogetherIds',postPurchase:'postPurchaseIds'}[type]||'relatedIds';
  const ids=new Set(seeds.flatMap(p=>p[field]||[]));
  return products.filter(p=>p.status==='active'&&!seedIds.includes(p.id)&&ids.has(p.id)&&p.variants.some(v=>v.availability==='in_stock')).slice(0,limit);
}
export function analytics(orders,sessions=[],{includeProfit=false}={}){
  const paid=orders.filter(o=>['paid','refunded'].includes(o.paymentStatus));
  const revenueCents=paid.reduce((s,o)=>s+o.totalCents-(o.refundedCents||0),0);
  const report={orderCount:paid.length,revenueCents,averageOrderCents:paid.length?Math.round(revenueCents/paid.length):null,conversionRate:sessions.length?paid.length/sessions.length:null,refundCents:paid.reduce((s,o)=>s+(o.refundedCents||0),0),abandonedCheckouts:sessions.filter(s=>s.status==='abandoned').length};
  for(const field of ['productId','category','supplierId']){const groups={};for(const order of paid)for(const l of order.items||[]){const key=l[field]||'unassigned';groups[key]=(groups[key]||0)+l.priceCents*l.quantity;}report[field+'RevenueCents']=groups;}
  if(!includeProfit)delete report.supplierIdRevenueCents;
  if(includeProfit){report.estimatedProfitCents=paid.length&&paid.every(o=>['estimatedCostCents','processingFeeCents','shippingCostCents','taxCents'].every(k=>Number.isSafeInteger(o[k])))?paid.reduce((s,o)=>s+o.totalCents-(o.refundedCents||0)-o.estimatedCostCents-o.processingFeeCents-o.taxCents-o.shippingCostCents,0):null;report.profitLabel='Estimated; supplier invoices, refunds, tax, shipping and settlement reconciliation may change this figure';}
  return report;
}
