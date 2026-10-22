import {escapeHTML as e,money,minPrice,searchProducts,reconcileCart,validateAddress} from '/dropshipping/lib/catalog.js';
const $ = s=>document.querySelector(s);
const read = key=>{try{return JSON.parse(localStorage.getItem(key));}catch{return null;}};
const write = (key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{message('Browser storage is unavailable. Changes will last only for this page.');return false;}};
function message(text){const toast=$('#store-message');toast.textContent=text;toast.classList.add('show');clearTimeout(message.timer);message.timer=setTimeout(()=>toast.classList.remove('show'),5000);}
let products=[];
try{const response=await fetch('/dropshipping/data/catalog.json');if(!response.ok)throw Error();products=await response.json();}catch{message('The catalog could not be loaded. Please reload to try again.');}
let cart=reconcileCart(read('dialashop-cart-v1'),products);
let wishlist=read('dialashop-wishlist-v1');
wishlist=Array.isArray(wishlist)?[...new Set(wishlist.filter(id=>products.some(p=>p.id===id)))]:[];
function persistCart(){cart=reconcileCart(cart,products);write('dialashop-cart-v1',cart);renderCart();window.dispatchEvent(new Event('dialashop:cart'));window.dialashopMarketing?.emit('cart_updated',{quantity:cart.reduce((s,l)=>s+l.quantity,0)});}
function productCard(p){return `<article class="product-card"><a href="/dropshipping/product/${e(p.slug)}/"><img class="catalog-image" src="${e(p.images[0])}" alt="${e(p.name)}" loading="lazy" width="400" height="400"><div class="product-info"><span class="eyebrow">${e(p.brand||p.category)}</span><h3>${e(p.name)}</h3><p>From ${money(minPrice(p))}</p></div></a><button class="button secondary" data-wish="${e(p.id)}">${wishlist.includes(p.id)?'Remove from wishlist':'Save to wishlist'}</button></article>`;}
const empty=(text)=>`<div class="empty-state"><h2>${text}</h2><p>Explore our departments to find your next good find.</p><a class="button secondary" href="/dropshipping/shop/">Explore the shop</a></div>`;
function total(){return cart.reduce((sum,line)=>{const p=products.find(p=>p.id===line.productId);return sum+p.variants.find(v=>v.id===line.variantId).priceCents*line.quantity;},0);}
function renderCart(){
  $('.cart-count').textContent=cart.reduce((sum,l)=>sum+l.quantity,0);
  if($('#cart-subtotal'))$('#cart-subtotal').textContent=money(total());
  if($('#checkout-subtotal'))$('#checkout-subtotal').textContent=money(total());
  const lines=cart.map((line,index)=>{
    const p=products.find(p=>p.id===line.productId),v=p.variants.find(v=>v.id===line.variantId);
    return `<article class="cart-row" data-line="${index}"><img src="${e(v.image||p.images[0])}" alt="${e(p.name)}" width="90" height="90"><div><h2><a href="/dropshipping/product/${e(p.slug)}/">${e(p.name)}</a></h2><p>${e(Object.entries(v.options).map(([k,val])=>`${k}: ${val}`).join(' / '))}</p><p>${money(v.priceCents)} each · ${v.availability==='in_stock'?'In stock':'Currently unavailable'}</p></div><label>Quantity<input data-quantity="${index}" type="number" min="1" max="99" value="${line.quantity}"></label><strong>${money(v.priceCents*line.quantity)}</strong><button class="button secondary" data-remove="${index}">Remove</button></article>`;
  }).join('');
  if($('#cart-items'))$('#cart-items').innerHTML=lines||empty('Your cart is empty.');
  if($('#checkout-items'))$('#checkout-items').innerHTML=cart.map(l=>{const p=products.find(p=>p.id===l.productId),v=p.variants.find(v=>v.id===l.variantId);return `<p>${e(p.name)} · ${e(Object.values(v.options).join(' / '))} × ${l.quantity} <strong>${money(v.priceCents*l.quantity)}</strong></p>`;}).join('')||'<p>Your cart is empty. Add an available product before checkout.</p>';
}
renderCart();
$('#cart-items')?.addEventListener('click',event=>{const b=event.target.closest('[data-remove]');if(b){cart.splice(Number(b.dataset.remove),1);persistCart();}});
$('#cart-items')?.addEventListener('change',event=>{if(!event.target.matches('[data-quantity]'))return;const input=event.target;if(!input.checkValidity()){input.reportValidity();renderCart();return;}cart[Number(input.dataset.quantity)].quantity=Number(input.value);persistCart();});
$('#clear-cart')?.addEventListener('click',()=>{cart=[];persistCart();});
function renderWishlist(){if($('#wishlist-items'))$('#wishlist-items').innerHTML=wishlist.length?`<div class="product-grid">${products.filter(p=>wishlist.includes(p.id)).map(productCard).join('')}</div>`:empty('Your wishlist is waiting.');document.querySelectorAll('[data-wish]').forEach(b=>{b.textContent=wishlist.includes(b.dataset.wish)?'Remove from wishlist':'Save to wishlist';b.setAttribute('aria-pressed',String(wishlist.includes(b.dataset.wish)));});}
renderWishlist();
document.addEventListener('click',event=>{const b=event.target.closest('[data-wish]');if(!b)return;const id=b.dataset.wish;wishlist=wishlist.includes(id)?wishlist.filter(x=>x!==id):[...wishlist,id];write('dialashop-wishlist-v1',wishlist);renderWishlist();});
$('#clear-wishlist')?.addEventListener('click',()=>{wishlist=[];write('dialashop-wishlist-v1',wishlist);renderWishlist();});
const catalog=$('[data-catalog]');
if(catalog){
  const form=$('#filters'),params=new URLSearchParams(location.search);
  for(const [key,value] of params){const field=form.elements.namedItem(key);if(field){if(field.type==='checkbox')field.checked=value==='on';else field.value=value;}}
  if(catalog.dataset.category)form.elements.category.value=catalog.dataset.category;
  if(catalog.dataset.subcategory)form.elements.subcategory.value=catalog.dataset.subcategory;
  let limit=12;
  function render(){const values=Object.fromEntries(new FormData(form));values.available=form.elements.available.checked;values.clearance=catalog.dataset.clearance==='true';if(catalog.dataset.category)values.category=catalog.dataset.category;if(catalog.dataset.subcategory)values.subcategory=catalog.dataset.subcategory;const results=searchProducts(products,values);$('#result-count').textContent=`${results.length} products`;$('#results').innerHTML=results.length?`<div class="product-grid">${results.slice(0,limit).map(productCard).join('')}</div>`:empty(products.length?'No products match these filters.':'Good finds are on the way.');$('#load-more').hidden=results.length<=limit;renderWishlist();}
  function updateURL(){const params=new URLSearchParams(new FormData(form));for(const [key,val] of [...params])if(!val)params.delete(key);history.replaceState(null,'',location.pathname+(params.size?'?'+params.toString():''));}
  form.addEventListener('submit',event=>{event.preventDefault();if(Number(form.elements.min.value)>Number(form.elements.max.value)&&form.elements.max.value&&form.elements.min.value){message('Maximum price must be at least the minimum price.');return;}limit=12;updateURL();render();});
  form.addEventListener('reset',()=>{setTimeout(()=>{limit=12;updateURL();render();},0);});
  $('#load-more').addEventListener('click',()=>{limit+=12;render();});render();
  if(location.search){$('meta[name="robots"]').content='noindex,follow';}
  if(params.has('q'))$('#site-search').value=params.get('q');
}
const detail=$('[data-product-id]');
if(detail){
 const p=products.find(p=>p.id===detail.dataset.productId),form=$('#purchase');
 if(p){
  const selected=()=>p.variants.find(v=>v.id===form.elements.variant.value);
  const param=new URLSearchParams(location.search).get('variant');if(p.variants.some(v=>v.id===param))form.elements.variant.value=param;
  function update(){const v=selected();$('#variant-sku').textContent=v.sku;$('#variant-price').innerHTML=`${money(v.priceCents)} ${v.compareAtCents?`<del>${money(v.compareAtCents)}</del>`:''}`;$('#variant-stock').textContent=v.availability==='in_stock'?'In stock':v.availability==='out_of_stock'?'Out of stock':'Availability not confirmed';$('#main-image').src=v.image||p.images[0];$('#add-cart').disabled=$('#buy-now').disabled=v.availability!=='in_stock';}
  function add(){if(!form.reportValidity())return false;const v=selected();if(v.availability!=='in_stock')return false;const quantity=Number(form.elements.quantity.value);if(!Number.isInteger(quantity)||quantity<1||quantity>99)return false;cart.push({productId:p.id,variantId:v.id,quantity});persistCart();message('Added to your cart.');return true;}
  form.addEventListener('submit',event=>{event.preventDefault();add();});
  $('#buy-now').addEventListener('click',()=>{if(add())location.href='/dropshipping/checkout/';});
  form.elements.variant.addEventListener('change',()=>{update();history.replaceState(null,'',`?variant=${encodeURIComponent(selected().id)}`);});
  detail.addEventListener('click',event=>{const b=event.target.closest('[data-image]');if(b)$('#main-image').src=b.dataset.image;});update();
 }else{form.querySelectorAll('button').forEach(b=>b.disabled=true);message('Product data is unavailable. Reload to try again.');}
}
// Services fail closed until server-side adapters are deployed. No personal fields or passwords are sent while unavailable.
for(const form of document.querySelectorAll('[data-service]'))form.addEventListener('submit',event=>{event.preventDefault();const names={contact:'Messages',newsletter:'Subscriptions',tracking:'Order lookup',login:'Sign-in',register:'Registration',returns:'Return requests',support:'Support requests'};form.querySelector('.form-message').textContent=`${names[form.dataset.service]} cannot be completed yet. The service is not connected. No information was submitted.`;});
$('#checkout')?.addEventListener('submit',event=>{event.preventDefault();const status=event.target.querySelector('.form-message');if(!cart.length){status.textContent='Your cart is empty. Add a product before checking delivery options.';return;}if(!validateAddress(Object.fromEntries(new FormData(event.target)))){status.textContent='Enter a complete US address, valid state, ZIP code, and email.';return;}if(cart.some(l=>products.find(p=>p.id===l.productId).variants.find(v=>v.id===l.variantId).availability!=='in_stock')){status.textContent='Your cart includes unavailable items. Remove them before continuing.';return;}status.textContent='Delivery rates, tax, and payments are not connected. No address was submitted and no order was placed.';});
window.addEventListener('storage',event=>{if(event.key==='dialashop-cart-v1'){cart=reconcileCart(read(event.key),products);renderCart();}if(event.key==='dialashop-wishlist-v1'){const value=read(event.key);wishlist=Array.isArray(value)?value.filter(id=>products.some(p=>p.id===id)):[];renderWishlist();}});
