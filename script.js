const $ = (selector, context = document) => context.querySelector(selector);
const $$ = (selector, context = document) => [...context.querySelectorAll(selector)];

// Public, development-only records. Private supplier cost and margin data are deliberately absent.
const previewProducts = [
  {id:"demo-elec-001",sku:"DEMO-ELEC-001",name:"Noise-canceling over-ear headphones",slug:"noise-canceling-headphones",brand:"Brand pending",department:"Electronics",category:"Audio",subcategory:"Headphones",condition:"New",tags:["audio","travel","wireless"],features:["Wireless audio","Travel-friendly form"],icon:"🎧",color:"#3158c9",bg:"#dce5ff",dateAdded:"2026-09-12",isDemo:true,dialashopPrice:null,normalRetailPrice:null,discountPercentage:null,stockStatus:"catalog-preview"},
  {id:"demo-comp-001",sku:"DEMO-COMP-001",name:"14-inch everyday laptop",slug:"14-inch-everyday-laptop",brand:"Brand pending",department:"Computers",category:"Laptops",subcategory:"Everyday laptops",condition:"Refurbished",tags:["laptop","portable","work"],features:["Configuration pending","Warranty pending"],icon:"💻",color:"#243447",bg:"#e2e9ee",dateAdded:"2026-09-11",isDemo:true,dialashopPrice:null,normalRetailPrice:null,discountPercentage:null,stockStatus:"catalog-preview"},
  {id:"demo-home-001",sku:"DEMO-HOME-001",name:"Compact countertop air fryer",slug:"compact-countertop-air-fryer",brand:"Brand pending",department:"Home & Kitchen",category:"Kitchen Appliances",subcategory:"Air fryers",condition:"New",tags:["kitchen","countertop","appliance"],features:["Capacity pending","Finish pending"],icon:"🍳",color:"#d45113",bg:"#ffe4d7",dateAdded:"2026-09-10",isDemo:true,dialashopPrice:null,normalRetailPrice:null,discountPercentage:null,stockStatus:"catalog-preview"},
  {id:"demo-tool-001",sku:"DEMO-TOOL-001",name:"Cordless drill and driver kit",slug:"cordless-drill-driver-kit",brand:"Brand pending",department:"Tools & Garden",category:"Power Tools",subcategory:"Drills",condition:"Open Box",tags:["drill","workshop","cordless"],features:["Battery specification pending","Included items pending"],icon:"🔧",color:"#e39a08",bg:"#fff0ca",dateAdded:"2026-09-09",isDemo:true,dialashopPrice:null,normalRetailPrice:null,discountPercentage:null,stockStatus:"catalog-preview"},
  {id:"demo-sport-001",sku:"DEMO-SPORT-001",name:"All-weather hiking daypack",slug:"all-weather-hiking-daypack",brand:"Brand pending",department:"Sports & Outdoors",category:"Hiking",subcategory:"Backpacks",condition:"New",tags:["hiking","travel","backpack"],features:["Capacity pending","Material pending"],icon:"🎒",color:"#116854",bg:"#d9efe9",dateAdded:"2026-09-08",isDemo:true,dialashopPrice:null,normalRetailPrice:null,discountPercentage:null,stockStatus:"catalog-preview"},
  {id:"demo-fash-001",sku:"DEMO-FASH-001",name:"Everyday running shoes",slug:"everyday-running-shoes",brand:"Brand pending",department:"Fashion",category:"Shoes",subcategory:"Active shoes",condition:"Clearance",tags:["shoes","running","activewear"],features:["Sizes pending","Color options pending"],icon:"👟",color:"#96365e",bg:"#f4dce6",dateAdded:"2026-09-07",isDemo:true,dialashopPrice:null,normalRetailPrice:null,discountPercentage:null,stockStatus:"catalog-preview"},
  {id:"demo-groc-001",sku:"DEMO-GROC-001",name:"Whole-bean coffee multipack",slug:"whole-bean-coffee-multipack",brand:"Brand pending",department:"Grocery & Household",category:"Coffee",subcategory:"Whole bean",condition:"New",tags:["coffee","pantry","beverage"],features:["Roast pending","Pack size pending"],icon:"☕",color:"#72452b",bg:"#eee2d7",dateAdded:"2026-09-06",isDemo:true,dialashopPrice:null,normalRetailPrice:null,discountPercentage:null,stockStatus:"catalog-preview"},
  {id:"demo-elec-002",sku:"DEMO-ELEC-002",name:"Portable smart projector",slug:"portable-smart-projector",brand:"Brand pending",department:"Electronics",category:"TV & Video",subcategory:"Projectors",condition:"Refurbished",tags:["projector","portable","video"],features:["Resolution pending","Connectivity pending"],icon:"📽️",color:"#5434b5",bg:"#e9e0ff",dateAdded:"2026-09-05",isDemo:true,dialashopPrice:null,normalRetailPrice:null,discountPercentage:null,stockStatus:"catalog-preview"}
];

const departments = [
  {id:"home-kitchen",name:"Home & Kitchen",items:"Kitchen appliances, cookware, coffee, vacuum cleaners, furniture, bedding, bath, decor, lighting, storage, cleaning, laundry, and home improvement."},
  {id:"electronics",name:"Electronics",items:"TV & video, audio, headphones, speakers, smart home, cameras, security, wearables, phones, charging, gaming, car electronics, and projectors."},
  {id:"computers",name:"Computers",items:"Laptops, desktops, monitors, tablets, SSDs, hard drives, components, memory, keyboards, mice, webcams, printers, networking, and accessories."},
  {id:"tools-garden",name:"Tools & Garden",items:"Power and hand tools, tool sets, drills, saws, sanders, grinders, workshop, automotive, hardware, electrical, plumbing, paint, lawn, patio, and garden."},
  {id:"sports-outdoors",name:"Sports & Outdoors",items:"Fitness, exercise equipment, camping, hiking, cycling, running, golf, fishing, recreation, water sports, sports clothing, travel gear, and backpacks."},
  {id:"fashion",name:"Fashion",items:"Men, women, kids, shoes, clothing, T-shirts, shirts, jackets, jeans, activewear, accessories, bags, watches, and sunglasses."},
  {id:"grocery-household",name:"Grocery & Household",items:"Food, snacks, beverages, coffee, tea, pantry, breakfast, personal care, cleaning, laundry, household, paper, and pet supplies."},
  {id:"clearance",name:"Clearance",items:"Overstock, end-of-line, open-box, refurbished, previous-generation, discount, and seasonal clearance products."}
];

const routeDepartments={"/home-kitchen/":"Home & Kitchen","/electronics/":"Electronics","/computers/":"Computers","/tools-garden/":"Tools & Garden","/sports-outdoors/":"Sports & Outdoors","/fashion/":"Fashion","/grocery-household/":"Grocery & Household"};
const routeMeta={"/":{title:"Dialashop | Fresh deals, clearly priced",description:"Dialashop is building a faster way to browse verified deals across home, tech, tools, outdoors, fashion, and everyday essentials."},"/deals/":{title:"All Deals | Dialashop",description:"Browse Dialashop deal categories, clearance, open-box, refurbished, and price-led collections."},"/clearance/":{title:"Clearance Deals | Dialashop",description:"Explore Dialashop clearance, overstock, end-of-line, open-box, refurbished, and seasonal deal categories."}};
Object.entries(routeDepartments).forEach(([path,department])=>{routeMeta[path]={title:`${department} Deals | Dialashop`,description:`Browse the future Dialashop ${department} deal catalog. Live products appear only after price and availability verification.`};});

const state = {query:routeDepartments[location.pathname]?.toLowerCase()||"", filter:location.pathname==="/clearance/"?"Clearance":"all", sort:"featured", cart:loadCart()};
const productGrid = $("#product-grid");
const departmentGrid = $("#department-grid");
const cartDrawer = $(".cart-drawer");
const mobileNav = $(".mobile-nav");
const overlay = $(".overlay");

function syncRouteMetadata(){const meta=routeMeta[location.pathname]||routeMeta["/"];document.title=meta.title;$("meta[name=description]").content=meta.description;$("link[rel=canonical]").href=`https://dialashop.com${location.pathname}`;}

function safeText(value){return String(value).replace(/[&<>'"]/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[character]);}
function productSearchText(product){return [product.name,product.brand,product.department,product.category,product.subcategory,product.sku,...product.tags,...product.features].join(" ").toLowerCase();}

function filteredProducts(){
  let products = previewProducts.filter(product => state.filter === "all" || product.condition === state.filter);
  if(state.query) products = products.filter(product => productSearchText(product).includes(state.query));
  if(state.sort === "newest") products.sort((a,b) => b.dateAdded.localeCompare(a.dateAdded));
  return products;
}

function renderProducts(){
  const products = filteredProducts();
  productGrid.innerHTML = products.map(product => `
    <article class="product-card" data-id="${product.id}">
      <div class="product-visual" style="--product-bg:${product.bg};--product-color:${product.color}"><span class="card-tag">Development preview</span><span class="product-icon" aria-hidden="true">${product.icon}</span></div>
      <div class="product-info"><span class="product-category">${safeText(product.department)} · ${safeText(product.category)}</span><h3>${safeText(product.name)}</h3><p class="product-condition">${safeText(product.condition)} · Availability not verified</p><div class="price-pending"><strong>Price pending verification</strong><span>No reference price or discount is published.</span></div><div class="card-actions"><button class="view-details" type="button">View details</button><button class="draft-add" type="button">Add to preview cart</button></div></div>
    </article>`).join("");
  $(".no-results").hidden = products.length > 0;
}

function renderDepartments(){
  departmentGrid.innerHTML = departments.map((department,index) => `<article class="department-card" id="${department.id === "clearance" ? "department-clearance" : department.id}"><span class="eyebrow">0${index+1} / Department</span><h3>${department.name}</h3><p>${department.items}</p><a href="#today" data-department="${department.name}">Preview ${department.name} &rarr;</a></article>`).join("");
}

function loadCart(){
  try{return JSON.parse(localStorage.getItem("dialashop-preview-cart")) || [];}catch{return [];}
}
function saveCart(){localStorage.setItem("dialashop-preview-cart",JSON.stringify(state.cart));}
function showToast(message){const toast=$(".toast");toast.textContent=message;toast.classList.add("show");clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>toast.classList.remove("show"),2200);}
function togglePanel(panel,open){panel.classList.toggle("open",open);panel.setAttribute("aria-hidden",String(!open));overlay.classList.toggle("open",open);document.body.style.overflow=open?"hidden":"";if(panel===mobileNav) $(".menu-btn").setAttribute("aria-expanded",String(open));}

function addToCart(productId){
  const line=state.cart.find(item=>item.id===productId);
  if(line) line.quantity+=1; else state.cart.push({id:productId,quantity:1});
  saveCart();renderCart();showToast("Added to your local preview cart");
}
function updateQuantity(productId,delta){const line=state.cart.find(item=>item.id===productId);if(!line)return;line.quantity+=delta;if(line.quantity<=0)state.cart=state.cart.filter(item=>item.id!==productId);saveCart();renderCart();}
function renderCart(){
  const quantity=state.cart.reduce((sum,item)=>sum+item.quantity,0);$(".cart-count").textContent=quantity;$(".cart-btn").setAttribute("aria-label",`Open cart, ${quantity} items`);
  const wrap=$(".cart-items");
  if(!state.cart.length){wrap.innerHTML='<p class="empty-cart">Your preview cart is empty.</p>';return;}
  wrap.innerHTML=state.cart.map(line=>{const product=previewProducts.find(item=>item.id===line.id);if(!product)return"";return `<div class="cart-line" data-id="${product.id}"><div class="cart-thumb" style="--product-color:${product.color}">${product.icon}</div><div><h3>${safeText(product.name)}</h3><p>Price and availability pending</p><button class="remove-item" type="button">Remove</button></div><div class="qty"><button class="qty-minus" type="button" aria-label="Decrease ${safeText(product.name)} quantity">−</button><span>${line.quantity}</span><button class="qty-plus" type="button" aria-label="Increase ${safeText(product.name)} quantity">+</button></div></div>`;}).join("");
}

function showProductDetails(product){
  const dialog=$(".product-dialog");
  $(".product-detail-content").innerHTML=`<nav class="breadcrumbs" aria-label="Breadcrumb"><span>Home</span><b>/</b><span>${safeText(product.department)}</span><b>/</b><span>${safeText(product.name)}</span></nav><div class="product-detail-grid"><div class="detail-visual" style="--product-color:${product.color};--product-bg:${product.bg}"><span aria-hidden="true">${product.icon}</span></div><div class="detail-buy"><span class="eyebrow">Development preview · ${safeText(product.sku)}</span><h2>${safeText(product.name)}</h2><p><strong>${safeText(product.brand)}</strong> · ${safeText(product.condition)}</p><div class="detail-price"><strong>Price pending verification</strong><span>No reference price, savings, availability, or scarcity is published.</span></div><label>Variation<select disabled><option>Supplier options pending</option></select></label><label>Quantity<input type="number" value="1" min="1" disabled></label><button class="button primary" disabled>Add to cart unavailable</button><button class="button secondary" disabled>Buy now unavailable</button><p class="detail-shipping">Shipping origin, cost, handling time, and estimated delivery will appear after supplier validation.</p></div></div><div class="detail-sections"><section><h3>Description</h3><p>A product description will be published only after an approved supplier record has been reviewed.</p></section><section><h3>Features</h3><ul>${product.features.map(feature=>`<li>${safeText(feature)}</li>`).join("")}</ul></section><section><h3>Specifications &amp; what’s included</h3><p>Specifications and package contents are pending supplier verification.</p></section><section><h3>Condition &amp; returns</h3><p>Condition: ${safeText(product.condition)} preview. The exact condition explanation, warranty, and return terms must be supplied before publication.</p></section><section><h3>Related deals</h3><p>Related, similar, and same-brand products will be generated only from verified catalog relationships.</p></section></div>`;
  dialog.showModal();
}

$(".mobile-nav nav").innerHTML=$(".category-scroll").innerHTML;
syncRouteMetadata();renderProducts();renderDepartments();renderCart();

$(".menu-btn").addEventListener("click",()=>togglePanel(mobileNav,true));
$(".mobile-close").addEventListener("click",()=>togglePanel(mobileNav,false));
$(".cart-btn").addEventListener("click",()=>togglePanel(cartDrawer,true));
$(".cart-close").addEventListener("click",()=>togglePanel(cartDrawer,false));
$(".continue-shopping").addEventListener("click",()=>togglePanel(cartDrawer,false));
overlay.addEventListener("click",()=>{togglePanel(cartDrawer,false);togglePanel(mobileNav,false);});
$$('.mobile-nav a').forEach(link=>link.addEventListener("click",()=>togglePanel(mobileNav,false)));
$$('.category-scroll a, .mobile-nav a').forEach(link=>link.addEventListener("click",event=>{event.preventDefault();const path=new URL(link.href,location.origin).pathname;history.pushState({},"",path);state.query=routeDepartments[path]?.toLowerCase()||"";state.filter=path==="/clearance/"?"Clearance":"all";$("#site-search").value=routeDepartments[path]||"";$$('.filter-chip').forEach(chip=>chip.classList.toggle("active",chip.dataset.filter===state.filter));syncRouteMetadata();renderProducts();togglePanel(mobileNav,false);$(path==="/clearance/"?"#clearance":"#today").scrollIntoView();}));
window.addEventListener("popstate",()=>{state.query=routeDepartments[location.pathname]?.toLowerCase()||"";state.filter=location.pathname==="/clearance/"?"Clearance":"all";syncRouteMetadata();renderProducts();});

$(".site-search").addEventListener("submit",event=>{event.preventDefault();state.query=$("#site-search").value.trim().toLowerCase();renderProducts();$("#today").scrollIntoView();showToast(state.query?`Showing preview matches for “${state.query}”`:"Showing all preview items");});
$("#sort-products").addEventListener("change",event=>{state.sort=event.target.value;if(["discount","price-asc","price-desc"].includes(state.sort)){showToast("This sort activates when verified prices are available");state.sort="featured";event.target.value="featured";}renderProducts();});
$(".filter-row").addEventListener("click",event=>{const button=event.target.closest("[data-filter]");if(!button)return;state.filter=button.dataset.filter;$$('.filter-chip').forEach(chip=>chip.classList.toggle("active",chip===button));renderProducts();});
productGrid.addEventListener("click",event=>{const card=event.target.closest(".product-card");if(!card)return;const product=previewProducts.find(item=>item.id===card.dataset.id);if(event.target.closest(".draft-add"))addToCart(product.id);if(event.target.closest(".view-details"))showProductDetails(product);});
departmentGrid.addEventListener("click",event=>{const link=event.target.closest("[data-department]");if(!link)return;event.preventDefault();state.query=link.dataset.department.toLowerCase();$("#site-search").value=link.dataset.department;renderProducts();$("#today").scrollIntoView();});
cartDrawer.addEventListener("click",event=>{const line=event.target.closest(".cart-line");if(!line)return;if(event.target.closest(".qty-minus"))updateQuantity(line.dataset.id,-1);if(event.target.closest(".qty-plus"))updateQuantity(line.dataset.id,1);if(event.target.closest(".remove-item")){state.cart=state.cart.filter(item=>item.id!==line.dataset.id);saveCart();renderCart();}});
$$('[data-budget]').forEach(button=>button.addEventListener("click",()=>{showToast(`Under $${button.dataset.budget} activates after verified pricing is connected`);$("#today").scrollIntoView();}));
$$('[data-condition]').forEach(button=>button.addEventListener("click",()=>{state.filter=button.dataset.condition;$$('.filter-chip').forEach(chip=>chip.classList.toggle("active",chip.dataset.filter===state.filter));renderProducts();$("#today").scrollIntoView();}));
$(".account-btn").addEventListener("click",()=>showToast("Account access activates with the commerce backend"));
$(".product-close").addEventListener("click",()=>$(".product-dialog").close());
$(".product-dialog").addEventListener("click",event=>{if(event.target===$(".product-dialog"))$(".product-dialog").close();});
$(".newsletter").addEventListener("submit",event=>{event.preventDefault();$(".form-message").textContent="Thanks — this preview has no email service connected yet.";event.target.reset();});
document.addEventListener("keydown",event=>{if(event.key!=="Escape")return;togglePanel(cartDrawer,false);togglePanel(mobileNav,false);});
