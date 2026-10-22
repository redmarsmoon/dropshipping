import {validateProduct,slugify} from '../lib/catalog.js';
import {requireValue} from './domain.mjs';
export const IMPORT_HEADERS=['id','sku','name','slug','category','subcategory','brand','description','images','variants','shipping','returnPolicy','seoTitle','seoDescription','supplierIds','supplierCostCents','supplierShippingCents','fulfillmentCents'];
export const importTemplate=IMPORT_HEADERS.join(',')+'\r\n';
export function parseCSV(text){
  requireValue(typeof text==='string'&&text.length<=5_000_000,'CSV must be under 5 MB');
  const rows=[];let row=[],field='',quoted=false;
  for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else{requireValue(quoted||field==='','Invalid quote in CSV');quoted=!quoted;}}else if(c===','&&!quoted){row.push(field);field='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(v=>v!==''))rows.push(row);row=[];field='';}else field+=c;}
  requireValue(!quoted,'Unclosed quoted CSV field');row.push(field);if(row.some(v=>v!==''))rows.push(row);
  requireValue(rows.length>0,'CSV has no header');const headers=rows.shift().map(h=>h.replace(/^\uFEFF/,'').trim());requireValue(new Set(headers).size===headers.length,'Duplicate CSV headers');
  return {headers,rows:rows.map((cells,i)=>{requireValue(cells.length===headers.length,`Row ${i+2} has ${cells.length} columns; expected ${headers.length}`);return Object.fromEntries(headers.map((h,index)=>[h,cells[index]]));})};
}
export function importProducts(text,mapping={},existing=[]){
  const {rows}=parseCSV(text),products=[],errors=[],skus=new Set(existing.map(p=>p.sku)),ids=new Set(existing.map(p=>p.id)),slugs=new Set(existing.map(p=>p.slug));
  for(const [index,row] of rows.entries())try{
    const p={};for(const key of IMPORT_HEADERS){const value=row[mapping[key]||key];if(value!==undefined&&value!=='')p[key]=value;}
    p.id=p.id||p.sku;p.slug=p.slug||slugify(p.name);p.status='draft';p.currency='USD';
    for(const key of ['images','variants','supplierIds'])p[key]=p[key]?JSON.parse(p[key]):[];
    for(const key of ['supplierCostCents','supplierShippingCents','fulfillmentCents'])if(p[key]!=null){p[key]=Number(p[key]);requireValue(Number.isSafeInteger(p[key])&&p[key]>=0,`${key} must be integer cents`);}
    requireValue(Array.isArray(p.images)&&p.images.every(src=>typeof src==='string'&&(/^https:\/\//.test(src)||src.startsWith('/assets/'))),'Invalid image URL array');
    requireValue(Array.isArray(p.variants),'Variants must be a JSON array');
    const variantIds=new Set(),variantSkus=new Set();for(const v of p.variants){requireValue(v&&typeof v==='object'&&typeof v.id==='string'&&v.id&&typeof v.sku==='string'&&v.sku,'Every variant needs an ID and SKU');requireValue(!variantIds.has(v.id)&&!variantSkus.has(v.sku),'Duplicate variant ID or SKU');variantIds.add(v.id);variantSkus.add(v.sku);requireValue(v.options&&typeof v.options==='object'&&!Array.isArray(v.options)&&Object.values(v.options).every(value=>typeof value==='string'),'Variant options must contain text');requireValue(Number.isSafeInteger(v.priceCents)&&v.priceCents>0,'Variant priceCents must be a positive integer');requireValue(['in_stock','out_of_stock','unknown'].includes(v.availability),'Invalid variant availability');}
    requireValue(!skus.has(p.sku)&&!ids.has(p.id)&&!slugs.has(p.slug),'Duplicate SKU, ID or slug');
    validateProduct(p);skus.add(p.sku);ids.add(p.id);slugs.add(p.slug);products.push(p);
  }catch(error){errors.push({row:index+2,sku:row[mapping.sku||'sku']||null,error:error.message});}
  return {products,errors,totalRows:rows.length,validRows:products.length};
}
