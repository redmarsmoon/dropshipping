import {now} from './store.mjs';
import {requireValue} from './domain.mjs';
export const templates={
  'account.registered':{subject:'Welcome to Dialashop',body:'Your account is ready.'},
  'order.confirmed':{subject:'Order received: {{orderNumber}}',body:'Your order has been recorded. Check your account for current status.'},
  'order.paid':{subject:'Payment confirmed: {{orderNumber}}',body:'Your payment has been verified.'},
  'payment.failed':{subject:'Payment update: {{orderNumber}}',body:'Your payment was not completed. Check your account for next steps.'},
  'order.processing':{subject:'Order processing: {{orderNumber}}',body:'Your order is being processed.'},
  'order.sent_to_supplier':{subject:'Fulfillment update: {{orderNumber}}',body:'Your order has entered supplier fulfillment.'},
  'order.fulfilled':{subject:'Fulfillment update: {{orderNumber}}',body:'Your order has been fulfilled. Shipment tracking will be shown separately when available.'},
  'order.returned':{subject:'Return status: {{orderNumber}}',body:'The return status has been updated. Refund status is shown separately in your account.'},
  'order.shipped':{subject:'Shipment update: {{orderNumber}}',body:'A shipment update is available in your account.'},
  'tracking.updated':{subject:'Tracking update: {{orderNumber}}',body:'Check your account for the latest carrier tracking information.'},
  'order.delivered':{subject:'Delivery update: {{orderNumber}}',body:'The carrier has reported delivery. Contact support if you need assistance.'},
  'order.cancelled':{subject:'Order cancelled: {{orderNumber}}',body:'Your order status is cancelled. Any refund status is shown separately in your account.'},
  'return.requested':{subject:'Return request received: {{orderNumber}}',body:'Your request is awaiting policy and eligibility review. This message does not approve a return or refund.'},
  'support.ticket_created':{subject:'Support request received',body:'Your support request {{ticketId}} has been recorded. Check your verified account for its current status.'},
  'order.refunded':{subject:'Refund update: {{orderNumber}}',body:'Your payment provider has confirmed a refund. Check your account for details.'},
  'checkout.recovery':{subject:'Your saved Dialashop checkout',body:'You requested checkout reminders. Restore your cart: {{recoveryUrl}}\nCommunication preferences: {{preferencesUrl}}'}
};
export function renderNotification(kind,values){const t=templates[kind];requireValue(t,'No configured template for this event');const fill=s=>s.replace(/\{\{(\w+)\}\}/g,(_,k)=>String(values[k]||''));return {subject:fill(t.subject),text:fill(t.body)};}
export async function drainOutbox(store,adapter,{limit=20}={}){
  if(!adapter?.send)return {configured:false,processed:0};
  let processed=0;
  const jobs=store.transaction(()=>{const rows=store.db.prepare("SELECT * FROM outbox WHERE (status='pending' OR status='retry' OR (status='sending' AND lease_until<?)) AND next_attempt_at<=? ORDER BY next_attempt_at LIMIT ?").all(Date.now(),Date.now(),limit);for(const row of rows)store.db.prepare("UPDATE outbox SET status='sending',lease_until=?,attempts=attempts+1,updated_at=? WHERE id=?").run(Date.now()+120000,now(),row.id);return rows;});
  for(const job of jobs){try{
    const payload=JSON.parse(job.payload);
    if(job.kind==='checkout.recovery'){const checkout=store.get('checkouts',payload.checkoutId);if(!checkout||checkout.recoveryConsent!==true||checkout.status!=='abandoned'){store.db.prepare("UPDATE outbox SET status='suppressed',lease_until=NULL WHERE id=?").run(job.id);continue;}}
    const response=await adapter.send({...renderNotification(job.kind,payload),to:payload.email,idempotencyKey:job.event_key});
    requireValue(response?.id,'Provider did not acknowledge the message',502);
    store.db.prepare("UPDATE outbox SET status='accepted',provider_reference=?,lease_until=NULL,updated_at=? WHERE id=?").run(response.id,now(),job.id);processed++;
  }catch{const attempts=job.attempts+1;store.db.prepare('UPDATE outbox SET status=?,next_attempt_at=?,lease_until=NULL,updated_at=? WHERE id=?').run(attempts>=5?'failed':'retry',Date.now()+Math.min(86400000,60000*2**attempts),now(),job.id);}}
  return {configured:true,processed};
}
// Only call from a signature-verified provider callback adapter.
export function confirmDelivery(store,providerReference,status){requireValue(['delivered','bounced','complained'].includes(status),'Invalid provider delivery status');store.db.prepare('UPDATE outbox SET status=?,updated_at=? WHERE provider_reference=?').run(status,now(),providerReference);}
