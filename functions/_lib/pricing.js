const CATEGORY_PROFILES = Object.freeze({
  Electronics:{minimumMarginRate:0.12,technologyCost:1.25},Computers:{minimumMarginRate:0.10,technologyCost:1.75},"Home & Kitchen":{minimumMarginRate:0.18,technologyCost:0.9},"Tools & Garden":{minimumMarginRate:0.16,technologyCost:1.1},"Sports & Outdoors":{minimumMarginRate:0.18,technologyCost:0.9},Fashion:{minimumMarginRate:0.24,technologyCost:0.8},"Grocery & Household":{minimumMarginRate:0.15,technologyCost:0.65},default:{minimumMarginRate:0.18,technologyCost:1}
});
const roundMoney=value=>Math.ceil((value+Number.EPSILON)*100)/100;
const validPrice=value=>Number.isFinite(Number(value))&&Number(value)>0?Number(value):null;
export function calculatePrice(input){
  const profile=CATEGORY_PROFILES[input.department]||CATEGORY_PROFILES.default,supplierCost=validPrice(input.supplierCost);
  if(!supplierCost)return{status:"review",reason:"missing_supplier_cost"};
  const shipping=Math.max(0,Number(input.shippingCost)||0),processingRate=Math.max(0,Number(input.processingRate)||0.029),processingFixed=Math.max(0,Number(input.processingFixed)||0.3),requestedMargin=Number(input.minimumMargin),marginRate=Number.isFinite(requestedMargin)?Math.max(profile.minimumMarginRate,requestedMargin):profile.minimumMarginRate;
  if(processingRate+marginRate>=0.9)return{status:"review",reason:"invalid_cost_profile"};
  const minimumProfitablePrice=roundMoney((supplierCost+shipping+profile.technologyCost+processingFixed)/(1-processingRate-marginRate)),normalRetailPrice=validPrice(input.normalRetailPrice),marketCandidates=[input.competitorPrice,input.wootComparablePrice].map(validPrice).filter(Boolean),competitiveTarget=marketCandidates.length?Math.min(...marketCandidates):normalRetailPrice,desiredPrice=competitiveTarget?Math.min(competitiveTarget,normalRetailPrice||competitiveTarget):minimumProfitablePrice,dialashopPrice=roundMoney(Math.max(minimumProfitablePrice,desiredPrice));
  if(normalRetailPrice&&dialashopPrice>normalRetailPrice)return{status:"review",reason:"not_market_viable"};
  const hasSavings=Boolean(normalRetailPrice&&normalRetailPrice>dialashopPrice);
  return{status:"publishable",dialashopPrice,compareAtPrice:hasSavings?normalRetailPrice:null,discountPercentage:hasSavings?Math.round((1-dialashopPrice/normalRetailPrice)*100):null,lastPriceCheck:new Date().toISOString()};
}
export function toPublicPricing(decision){return{status:decision.status,dialashopPrice:decision.dialashopPrice??null,compareAtPrice:decision.compareAtPrice??null,discountPercentage:decision.discountPercentage??null,lastPriceCheck:decision.lastPriceCheck??null};}
