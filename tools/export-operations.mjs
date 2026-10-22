import {writeFile,rename} from 'node:fs/promises';
import {Store} from '../operations/store.mjs';
const store=new Store(process.env.OPERATIONS_DB);
try{
  const products=store.publicCatalog(),categories=store.list('categories').map(({id,name,children})=>({slug:id,name,children}));
  if(!categories.length)throw Error('Seed or configure the existing departments before exporting');
  for(const [path,data] of [['data/catalog.json',products],['data/categories.json',categories]]){
    await writeFile(path+'.tmp',JSON.stringify(data,null,2)+'\n');await rename(path+'.tmp',path);
  }
  store.audit('local-console','public_export','catalog',{products:products.length,categories:categories.length});
  console.log(`Exported ${products.length} active products and ${categories.length} categories. Review the diff, run the build/tests, then deploy.`);
}finally{store.close();}
