import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {Store} from '../operations/store.mjs';
import {Commerce} from '../operations/commerce.mjs';
import {drainOutbox} from '../operations/notifications.mjs';
const store=new Store(process.env.OPERATIONS_DB);
try{
 const adapters=process.env.OPERATIONS_ADAPTER_MODULE?(await import(pathToFileURL(resolve(process.env.OPERATIONS_ADAPTER_MODULE)).href)).default:{};
 const commerce=new Commerce(store,adapters);
 const abandoned=commerce.abandon({afterMinutes:Number(process.env.RECOVERY_DELAY_MINUTES||60)});
 if(process.env.RECOVERY_ENABLED==='true'){
   if(!adapters.email?.send||!process.env.CUSTOMER_PORTAL_ORIGIN)throw Error('Recovery requires an email adapter and HTTPS customer portal origin');
   for(const c of store.list('checkouts').filter(c=>c.kind==='recovery'&&c.status==='abandoned'&&c.recoveryConsent)){
     if(!store.db.prepare('SELECT 1 FROM outbox WHERE event_key=?').get('recovery:'+c.id))commerce.recoveryLink(c.id,process.env.CUSTOMER_PORTAL_ORIGIN);
   }
 }
 const notifications=await drainOutbox(store,adapters.email);
 console.log(JSON.stringify({abandoned,notifications}));
}finally{store.close();}
