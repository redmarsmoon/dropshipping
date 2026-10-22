import {createHmac,timingSafeEqual} from 'node:crypto';
import {requireValue} from './domain.mjs';
// Stripe's signed timestamp + raw bytes. Provider adapters still validate event
// semantics and reconcile payment/refund details with the provider API.
export function verifyStripeSignature(raw,signature,secret,{now=Date.now(),toleranceSeconds=300}={}){
  requireValue(Buffer.isBuffer(raw)&&typeof signature==='string'&&typeof secret==='string'&&secret.length>0,'Webhook verification is not configured',401);
  const fields=signature.split(',').map(part=>part.split('=')),timestamp=fields.find(([k])=>k==='t')?.[1];
  requireValue(/^\d+$/.test(timestamp||'')&&Math.abs(now/1000-Number(timestamp))<=toleranceSeconds,'Webhook timestamp rejected',401);
  const expected=createHmac('sha256',secret).update(timestamp+'.').update(raw).digest();
  const valid=fields.filter(([k])=>k==='v1').some(([,v])=>{if(!/^[a-f0-9]{64}$/i.test(v||''))return false;const actual=Buffer.from(v,'hex');return timingSafeEqual(actual,expected);});
  requireValue(valid,'Webhook signature rejected',401);return JSON.parse(raw.toString('utf8'));
}
