import {scrypt,randomBytes,timingSafeEqual,randomUUID} from 'node:crypto';
import {promisify} from 'node:util';
import {hash,now} from './store.mjs';
import {requireValue} from './domain.mjs';
const derive=promisify(scrypt);
export const roles={
  owner:['*'],
  catalog:['products','categories','suppliers','pricingRules:read','inventoryLogs','priceChanges','inventory','import','pricing','export'],
  fulfillment:['orders','inventory','inventoryLogs','returns','notifications'],
  support:['orders:read','tickets','returns','customers:read'],
  analyst:['analytics:read']
};
export function permits(role,resource,write=false){const p=roles[role]||[];return p.includes('*')||p.includes(resource)||!write&&p.includes(resource+':read');}
export async function passwordHash(password){requireValue(typeof password==='string'&&password.length>=14&&password.length<=256,'Use a password between 14 and 256 characters');const salt=randomBytes(16).toString('hex');const key=await derive(password,salt,64);return `scrypt:${salt}:${key.toString('hex')}`;}
export async function verifyPassword(password,encoded){if(typeof password!=='string'||password.length>256)return false;const [,salt,key]=String(encoded||'scrypt:invalid:'+('0'.repeat(128))).split(':');const derived=await derive(password,salt||'invalid',64);const expected=Buffer.from(key||'','hex');return expected.length===derived.length&&timingSafeEqual(expected,derived);}
export async function provisionUser(store,{email,password,role='owner'}){requireValue(typeof email==='string'&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),'Valid email required');requireValue(role in roles,'Invalid staff role');const id=randomUUID(),encoded=await passwordHash(password);store.db.prepare('INSERT INTO users(id,email,password_hash,role,created_at) VALUES(?,?,?,?,?)').run(id,email.toLowerCase(),encoded,role,now());store.audit('local-console','provision_staff',id,{role});return {id,email,role};}
export async function login(store,email,password){const user=store.db.prepare('SELECT * FROM users WHERE email=?').get(String(email).toLowerCase());const valid=await verifyPassword(password,user?.password_hash);requireValue(valid&&user&&!user.disabled,'Email or password is incorrect',401);const token=randomBytes(32).toString('base64url'),csrf=randomBytes(32).toString('base64url');store.db.prepare('DELETE FROM sessions WHERE expires_at<?').run(Date.now());store.db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(hash(token),user.id,csrf,Date.now()+8*60*60*1000);store.audit(user.id,'login','session');return {token,csrf,user:{id:user.id,email:user.email,role:user.role}};}
export function session(store,token){if(!token)return null;const row=store.db.prepare('SELECT u.id,u.email,u.role,s.csrf FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.disabled=0').get(hash(token),Date.now());return row||null;}
export function logout(store,token){store.db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(token));}
export function safeOrder(order,role){if(role==='owner')return order;const {estimatedCostCents,processingFeeCents,shippingCostCents,supplierAllocations,notes,items,...safe}=order;return {...safe,...(role==='fulfillment'?{notes}:{}),items:items?.map(({supplierCostCents,supplierId,...item})=>({...item,...(role==='fulfillment'?{supplierId}:{})}))};}
