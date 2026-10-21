import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
const run=(command,args,options={})=>execFileSync(command,args,{stdio:'inherit',...options});
const repo='redmarsmoon/dropshipping';
const gh=process.platform==='win32'?'gh.exe':'gh';
const pages=JSON.parse(execFileSync(gh,['api',`repos/${repo}/pages`],{encoding:'utf8'}));
const siteURL=pages.html_url.replace(/\/$/,'');
run(process.execPath,['tools/build.mjs'],{env:{...process.env,SITE_URL:'https://dialashop.com'}});
run(process.execPath,['--test']);
run(process.execPath,['tools/build.mjs'],{env:{...process.env,SITE_URL:siteURL}});
const cwd=resolve('dist');
const git=args=>run('git',args,{cwd});
git(['init','--initial-branch=gh-pages']);
git(['remote','add','origin',`https://github.com/${repo}.git`]);
const branch=execFileSync('git',['ls-remote','origin','refs/heads/gh-pages'],{cwd,encoding:'utf8'}).trim();
if(branch){git(['fetch','origin','gh-pages']);git(['reset','--mixed','FETCH_HEAD']);}
git(['add','--all']);
const changes=execFileSync('git',['status','--porcelain'],{cwd,encoding:'utf8'}).trim();
if(changes)git(['commit','-m','Deploy generated Dialashop storefront']);
git(['push','origin','gh-pages']);
if(pages.source?.branch!=='gh-pages' || pages.source?.path!=='/' || pages.build_type!=='legacy') {
  run(gh,['api','--method','PUT',`repos/${repo}/pages`,'-f','build_type=legacy','-f','source[branch]=gh-pages','-f','source[path]=/']);
}
console.log(`Deployment submitted: ${siteURL}/. Confirm the Pages deployment succeeds before reporting it live.`);
