// quick-patch.mjs — Patches ZCB Dashboard via Cloudflare API
// Run in Cursor terminal: node quick-patch.mjs
//
// PREREQUISITE: Run "npx wrangler whoami" first to ensure you're logged in
// If not logged in: npx wrangler login

import { execSync } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';

console.log('=== ZCB Dashboard Live D1 Patch ===\n');

// Step 1: Download current Worker via wrangler
console.log('[1/3] Downloading current Worker...');
console.log('This may take 30-60 seconds on first run...\n');

try {
  execSync('npx wrangler@3 download teamzcb-dashboard --outdir ./dl-temp', {
    cwd: process.cwd(),
    stdio: 'inherit',
    timeout: 120000
  });
} catch(e) {
  console.log('\nIf this fails, run manually:');
  console.log('  npx wrangler login');
  console.log('  npx wrangler download teamzcb-dashboard --outdir ./dl-temp');
  console.log('Then run this script again.');
  process.exit(1);
}

// Step 2: Find and patch index.js
console.log('\n[2/3] Patching...');
const code = readFileSync('./dl-temp/index.js', 'utf-8');

const LIVE_SCRIPT = `async function fetchLiveData(){try{const[a,b]=await Promise.all([fetch("/api/data"),fetch("/api/files")]);const d=await a.json();const f=await b.json();if(d.folders)for(const x of d.folders){const n=parseInt((x.folder_number||"").replace(/\\\\D/g,""));const fo=typeof FOLDERS!=="undefined"&&FOLDERS.find(z=>z.id===n);if(fo){fo.c=x.file_count||0;fo.s=x.file_count>0?(fo.s==="restricted"?"restricted":"active"):"empty";try{const nm=typeof x.file_names==="string"?JSON.parse(x.file_names):(x.file_names||[]);if(nm.length>0)fo.f=nm}catch(e){}if(x.scanned_at)fo.m=x.scanned_at.slice(0,10);if(x.owner)fo.o=x.owner}}if(f.files&&f.files.length>0)FILE_REG=f.files;if(d.health)window._liveHealth=d.health;if(d.updated)window._lastScan=d.updated;render();const h=window._liveHealth;if(h){document.querySelectorAll(".val.g").forEach(el=>{if(el.textContent.includes("/100"))el.innerHTML=(h.overall_score||92)+'<span style="font-size:16px;opacity:.6">/100</span>'});const act=FOLDERS.filter(x=>x.s==="active").length;document.querySelectorAll(".sub").forEach(el=>{if(el.textContent.includes("folders"))el.textContent="Active "+act+"/"+FOLDERS.length+" folders \\u2022 Scan: "+new Date(window._lastScan||Date.now()).toLocaleString("th-TH",{hour:"2-digit",minute:"2-digit"})});const lv=document.querySelector(".live");if(lv)lv.innerHTML='<div class="dot"></div>LIVE D1 \\u2022 '+new Date().toLocaleString("th-TH")}}catch(e){console.error("[ZCB]",e)}}fetchLiveData();setInterval(fetchLiveData,60000);`;

const oldReturn = `return new Response(HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } });`;
const injection = `const LIVE_INJECT = '<script>' + ${JSON.stringify(LIVE_SCRIPT)} + '<\\/script>';
    return new Response(HTML.replace('</body>', LIVE_INJECT + '</body>'), { headers: { "Content-Type": "text/html; charset=utf-8" } });`;

let patched = code;
if (code.includes(oldReturn)) {
  patched = code.replace(oldReturn, injection);
  console.log('Patched return statement successfully!');
} else {
  patched = code.replace(
    /return new Response\(HTML,\s*\{[^}]*"text\/html[^}]*\}\s*\);/,
    injection
  );
  console.log('Patched with regex fallback.');
}

writeFileSync('./src/index.js', patched, 'utf-8');
console.log(`Written to src/index.js (${patched.length} chars)\n`);

// Step 3: Deploy
console.log('[3/3] Deploying...');
try {
  execSync('npx wrangler@3 deploy', {
    cwd: process.cwd(),
    stdio: 'inherit',
    timeout: 120000
  });
  console.log('\n=== SUCCESS! ===');
  console.log('https://teamzcb-dashboard.banknakorn39.workers.dev');
  console.log('Health Score should show 100 (not 92)');
} catch(e) {
  console.log('\nDeploy failed. Try manually: npx wrangler deploy');
}
