// Cloudflare Pages integration boundary. Credentials and order logic stay on the server.
// There is deliberately no simulated payment, account, email, or order implementation.
const routes = new Map([
  ['POST quote','quote'], ['POST checkout','createPaymentSession'],
  ['POST contact','sendContact'], ['POST newsletter','subscribe'],
  ['POST auth/login','login'], ['POST auth/register','register'],
  ['POST auth/logout','logout'], ['GET account','account'],
  ['GET orders','listOrders'], ['POST tracking','trackOrder'],
  ['POST webhooks/stripe','stripeWebhook'], ['POST webhooks/paypal','paypalWebhook'],
  ['POST returns','requestReturn'], ['GET returns','listReturns'],
  ['POST tickets','createTicket'], ['GET tickets','listTickets'],
  ['POST recovery','saveRecovery'], ['POST recover','restoreRecovery'],
  ['POST preferences','updatePreferences']
]);
export async function onRequest({request,env,params}) {
  const path = Array.isArray(params.path)?params.path.join('/'):params.path;
  const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
  const method = routes.get(`${request.method} ${path}`);
  if (!method) return Response.json({error:'Endpoint not found'},{status:404,headers});
  const origin=request.headers.get('origin');
  const webhook=path.startsWith('webhooks/');
  if (!webhook && origin && origin!==new URL(request.url).origin) return Response.json({error:'Origin rejected'},{status:403,headers});
  // A separately deployed, reviewed service binding must supply every enabled method.
  if (!env.COMMERCE || typeof env.COMMERCE.fetch!=='function') return Response.json({error:'Service is not configured',code:'NOT_CONFIGURED'},{status:503,headers});
  try {
    const upstream=await env.COMMERCE.fetch(request);
    const response=new Response(upstream.body,upstream);
    for(const [key,value] of Object.entries(headers))response.headers.set(key,value);
    return response;
  }catch{return Response.json({error:'Service temporarily unavailable'},{status:503,headers});}
}
