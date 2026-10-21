import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {validateProduct,publicProduct} from '../lib/catalog.js';
const [command,path] = process.argv.slice(2);
if (!['import','export','validate'].includes(command)) throw new Error('Usage: npm run catalog -- import <private.json> | export | validate');
let records;
if (command === 'import') {
  if (!path || extname(path)!=='.json') throw new Error('Supply an approved JSON array. Convert CSV/XML using a supplier-specific adapter first.');
  records=JSON.parse(await readFile(resolve(path),'utf8'));
  if(!Array.isArray(records))throw new Error('Import must be a JSON array');
  records.forEach(validateProduct);
  for(const key of ['id','sku','slug'])if(new Set(records.map(p=>p[key])).size!==records.length)throw new Error(`Duplicate ${key}`);
  // Store the full private import outside the public catalog. Never publish this file.
  await mkdir('private',{recursive:true});
  await writeFile('private/products.json',JSON.stringify(records,null,2)+'\n');
  console.log(`Validated ${records.length} private records. Review before running catalog export.`);
}else{
  records=JSON.parse(await readFile(command==='export'?'private/products.json':'data/catalog.json','utf8'));
  if(!Array.isArray(records))throw new Error('Catalog must be a JSON array');
  records.forEach(validateProduct);
  if(command==='export'){
    await writeFile('data/catalog.json',JSON.stringify(records.map(publicProduct),null,2)+'\n');
    console.log('Public catalog exported with an explicit allowlist. Run npm test and npm run build.');
  }else console.log(`Validated ${records.length} catalog records.`);
}
