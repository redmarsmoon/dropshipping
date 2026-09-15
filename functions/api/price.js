import {calculatePrice,toPublicPricing} from "../_lib/pricing.js";
export async function onRequestPost({request,env}){
  if(!env.PRICING_API_TOKEN)return Response.json({error:"Pricing service is not configured"},{status:503});
  if(request.headers.get("authorization")!==`Bearer ${env.PRICING_API_TOKEN}`)return Response.json({error:"Unauthorized"},{status:401});
  try{return Response.json(toPublicPricing(calculatePrice(await request.json())));}catch{return Response.json({error:"Invalid pricing request"},{status:400});}
}
