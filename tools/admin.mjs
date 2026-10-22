import {Store} from '../operations/store.mjs';
import {provisionUser} from '../operations/auth.mjs';
import {readFile} from 'node:fs/promises';
const store=new Store(process.env.OPERATIONS_DB||'private/operations.sqlite');
try{
  if(process.argv[2]==='user'){
    const result=await provisionUser(store,{email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD,role:process.env.ADMIN_ROLE||'owner'});
    console.log(`Staff account created: ${result.email} (${result.role}). Password was not logged.`);
  }else if(process.argv[2]==='seed-categories'){
    for(const category of JSON.parse(await readFile('data/categories.json','utf8'))){if(!store.get('categories',category.slug))store.put('categories',{...category,id:category.slug},'local-console');}
    console.log('Existing store departments copied to the private database. No products were added.');
  }else throw Error('Usage: node tools/admin.mjs user | seed-categories');
}finally{store.close();}
