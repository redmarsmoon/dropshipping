export const slugify = value => String(value).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const money = cents => new Intl.NumberFormat('en-US', {style:'currency',currency:'USD'}).format(cents / 100);
const safeImage = value => typeof value === 'string' && (/^https:\/\//.test(value) || /^\/assets\/[a-zA-Z0-9/_ .%-]+$/.test(value));
export function validateProduct(p) {
  const errors = [];
  for (const key of ['id','sku','name','slug']) if (typeof p[key] !== 'string' || !p[key].trim()) errors.push(`${key} is required`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.slug)) errors.push('slug must be URL safe');
  if (!['draft','active','archived'].includes(p.status)) errors.push('invalid status');
  if (p.status === 'active') {
    for (const key of ['features','tags','relatedIds']) if (p[key] != null && (!Array.isArray(p[key]) || p[key].some(v=>typeof v !== 'string'))) errors.push(`${key} must be a text array`);
    if (p.specifications != null && (typeof p.specifications !== 'object' || Array.isArray(p.specifications) || Object.values(p.specifications).some(v=>!['string','number'].includes(typeof v)))) errors.push('specifications must contain plain values');
    for (const key of ['featured','bestSeller','clearance']) if (p[key] != null && typeof p[key] !== 'boolean') errors.push(`${key} must be boolean`);
    if (p.dateAdded != null && !Number.isFinite(Date.parse(p.dateAdded))) errors.push('dateAdded must be a valid timestamp');
    for (const key of ['description','category','subcategory','shipping','returnPolicy','seoTitle','seoDescription']) if (typeof p[key] !== 'string' || !p[key].trim()) errors.push(`${key} is required for active products`);
    if (p.currency !== 'USD') errors.push('currency must be USD');
    if (!Array.isArray(p.images) || !p.images.length || !p.images.every(safeImage)) errors.push('safe product images are required');
    if (!Array.isArray(p.variants) || !p.variants.length) errors.push('at least one variant is required');
    const ids = new Set();
    for (const v of p.variants || []) {
      if (!v.id || ids.has(v.id) || typeof v.id !== 'string') errors.push('variant IDs must be unique');
      ids.add(v.id);
      if (!v.sku || typeof v.sku !== 'string') errors.push('variant SKU is required');
      if (!Number.isSafeInteger(v.priceCents) || v.priceCents <= 0) errors.push('positive integer variant priceCents is required');
      if (v.compareAtCents != null && (!Number.isSafeInteger(v.compareAtCents) || v.compareAtCents <= v.priceCents)) errors.push('compare-at price must exceed selling price');
      if (!['in_stock','out_of_stock','unknown'].includes(v.availability)) errors.push('invalid availability');
      if (!v.options || typeof v.options !== 'object' || Array.isArray(v.options) || Object.values(v.options).some(x=>typeof x !== 'string')) errors.push('variant options must be text');
      if (v.image && !safeImage(v.image)) errors.push('unsafe variant image');
    }
  }
  if (errors.length) throw new Error(`${p.sku || 'Product'}: ${errors.join('; ')}`);
  return p;
}
// Explicit allowlist: new private fields can never leak by default, including nested variants.
export function publicProduct(p) {
  const pick = (source, keys) => Object.fromEntries(keys.filter(k=>source[k] !== undefined).map(k=>[k,source[k]]));
  return {...pick(p, ['id','sku','name','slug','status','description','category','subcategory','brand','condition','currency','images','features','specifications','weight','dimensions','shipping','returnPolicy','seoTitle','seoDescription','relatedIds','tags','dateAdded','featured','bestSeller','clearance']),
    variants:(p.variants || []).map(v=>pick(v,['id','sku','options','priceCents','compareAtCents','image','availability']))};
}
export function searchProducts(products, filters = {}) {
  let result = products.filter(p => p.status === 'active');
  const query = String(filters.q || '').trim().toLowerCase();
  if (query) result = result.filter(p=>[p.name,p.description,p.sku,p.brand,p.category,p.subcategory,...(p.tags||[]),...(p.features||[])].join(' ').toLowerCase().includes(query));
  if (filters.category) result = result.filter(p=>p.category === filters.category);
  if (filters.subcategory) result = result.filter(p=>p.subcategory === filters.subcategory);
  if (filters.brand) result = result.filter(p=>p.brand === filters.brand);
  if (filters.clearance) result = result.filter(p=>p.clearance);
  // Match all variant-dependent filters against the same variant.
  result = result.filter(p=>p.variants.some(v=>(filters.min === '' || filters.min == null || v.priceCents >= Number(filters.min)*100) && (filters.max === '' || filters.max == null || v.priceCents <= Number(filters.max)*100) && (!filters.available || v.availability === 'in_stock') && (!filters.option || Object.entries(v.options||{}).some(([k,value])=>`${k}: ${value}` === filters.option))));
  if (filters.sort === 'price-asc') result.sort((a,b)=>minPrice(a)-minPrice(b));
  if (filters.sort === 'price-desc') result.sort((a,b)=>minPrice(b)-minPrice(a));
  if (filters.sort === 'newest') result.sort((a,b)=>String(b.dateAdded||'').localeCompare(String(a.dateAdded||'')));
  return result;
}
export const minPrice = p => Math.min(...p.variants.map(v=>v.priceCents));
export function reconcileCart(raw, products) {
  if (!Array.isArray(raw)) return [];
  const lines = new Map();
  for (const line of raw) {
    const product = products.find(p=>p.id === line?.productId && p.status === 'active');
    const variant = product?.variants.find(v=>v.id === line.variantId);
    if (!variant || !Number.isSafeInteger(line.quantity) || line.quantity < 1) continue;
    const key = JSON.stringify([product.id,variant.id]);
    const quantity = Math.min(99,(lines.get(key)?.quantity || 0)+line.quantity);
    lines.set(key,{productId:product.id,variantId:variant.id,quantity});
  }
  return [...lines.values()];
}
export const US_STATES = 'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' ');
export function validateAddress(a) {
  return a.country === 'US' && US_STATES.includes(a.state) && /^\d{5}(-\d{4})?$/.test(a.zip || '') && ['firstName','lastName','address','city'].every(k=>typeof a[k] === 'string' && a[k].trim().length > 0) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email || '');
}
