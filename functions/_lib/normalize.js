import {publicProduct} from '../../lib/catalog.js';
const CONDITIONS=new Map([['new','New'],['refurbished','Refurbished'],['renewed','Renewed'],['open box','Open Box'],['open-box','Open Box']]);
const text=value=>typeof value==='string'?value.trim():'';
const number=value=>value==null||value===''?null:Number.isFinite(Number(value))?Number(value):null;
const slug=value=>text(value).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export function normalizeProduct(raw,mapping,source){
 const read=field=>mapping[field]?raw[mapping[field]]:undefined;
 const name=text(read('name')),sku=text(read('sku')),condition=CONDITIONS.get(text(read('condition')).toLowerCase());
 if(!name||!sku)throw Error('Product name and SKU are required');
 if(!condition)throw Error('A recognized product condition is required');
 return {id:`${source.id}:${sku}`,name,sku,slug:slug(read('slug')||name),status:'draft',condition,currency:'USD',description:text(read('description')),department:text(read('department')),category:slug(read('department')||read('category')),subcategory:slug(read('subcategory')),brand:text(read('brand')),images:read('images')||[],features:read('features')||[],specifications:read('specifications')||{},variants:read('variants')||[],weight:read('weight')||null,dimensions:read('dimensions')||null,shipping:text(read('shipping')),returnPolicy:text(read('returnPolicy')),seoTitle:text(read('seoTitle'))||name,seoDescription:text(read('seoDescription')),relatedIds:[],tags:read('tags')||[],dateAdded:new Date().toISOString(),supplierId:source.id,supplier:source.name,supplierSku:text(read('supplierSku'))||sku,supplierProductId:text(read('supplierProductId')),supplierCost:number(read('supplierCost')),minimumMargin:number(read('minimumMargin')),supplierUrl:text(read('supplierUrl')),sourceReference:text(read('sourceReference')),stockStatus:text(read('stockStatus'))||'unknown',stockQuantity:number(read('stockQuantity')),shippingOrigin:text(read('shippingOrigin')),shippingRegions:read('shippingRegions')||['US'],shippingCost:number(read('shippingCost')),handlingTime:text(read('handlingTime')),estimatedDelivery:text(read('estimatedDelivery')),normalRetailPrice:number(read('normalRetailPrice')),dialashopPrice:null,compareAtPrice:null,discountPercentage:null,competitorPrice:null,wootComparablePrice:null,lastPriceCheck:null};
}
export const toPublicProduct=publicProduct;
