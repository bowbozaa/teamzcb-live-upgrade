// deploy-live.mjs — Patches ZCB Dashboard Worker with live D1 data injection
// Run: node deploy-live.mjs

import { execSync } from 'child_process';
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const DIR = join(process.cwd());
const SRC = join(DIR, 'src');

console.log('=== ZCB Dashboard Live D1 Upgrade ===');
console.log('by Flyday Co-Pilot | 22 Mar 2026\n');

// Step 1: Download current Worker code
console.log('[1/3] Downloading current Worker code...');
try {
  if (!existsSync(SRC)) mkdirSync(SRC, { recursive: true });
  
  // Use Cloudflare API to download Worker script
  const result = execSync('npx wrangler@latest download teamzcb-dashboard --outdir ./download-temp 2>&1', {
    cwd: DIR,
    encoding: 'utf-8',
    timeout: 60000
  });
  console.log(result);
} catch(e) {
  console.log('Direct download failed, trying alternative...');
}

// Try reading the downloaded file
let code = '';
const possiblePaths = [
  join(DIR, 'download-temp', 'index.js'),
  join(DIR, 'download-temp', 'src', 'index.js'),
];

for (const p of possiblePaths) {
  try {
    code = readFileSync(p, 'utf-8');
    console.log(`Found Worker code at: ${p} (${code.length} chars)`);
    break;
  } catch(e) {}
}

if (!code) {
  console.log('[FALLBACK] Fetching via HTTP API...');
  // Fetch the current dashboard HTML to verify it works
  try {
    const resp = execSync('curl -s https://teamzcb-dashboard.banknakorn39.workers.dev/ 2>&1', {
      encoding: 'utf-8',
      timeout: 15000
    });
    console.log(`Dashboard HTML length: ${resp.length}`);
  } catch(e) {}
  
  console.log('\nCannot auto-download Worker code.');
  console.log('Please open Cursor terminal and run:');
  console.log('  npx wrangler download teamzcb-dashboard --outdir ./download-temp');
  console.log('Then run this script again.');
  process.exit(1);
}

// Step 2: Patch the code
console.log('\n[2/3] Patching with live D1 data injection...');

const LIVE_SCRIPT = `async function fetchLiveData(){try{const[a,b]=await Promise.all([fetch("/api/data"),fetch("/api/files")]);const d=await a.json();const f=await b.json();if(d.folders)for(const x of d.folders){const n=parseInt((x.folder_number||"").replace(/\\\\D/g,""));const fo=typeof FOLDERS!=="undefined"&&FOLDERS.find(z=>z.id===n);if(fo){fo.c=x.file_count||0;fo.s=x.file_count>0?(fo.s==="restricted"?"restricted":"active"):"empty";try{const nm=typeof x.file_names==="string"?JSON.parse(x.file_names):(x.file_names||[]);if(nm.length>0)fo.f=nm}catch(e){}if(x.scanned_at)fo.m=x.scanned_at.slice(0,10);if(x.owner)fo.o=x.owner}}if(f.files&&f.files.length>0)FILE_REG=f.files;if(d.health)window._liveHealth=d.health;if(d.updated)window._lastScan=d.updated;render();const h=window._liveHealth;if(h){document.querySelectorAll(".val.g").forEach(el=>{if(el.textContent.includes("/100"))el.innerHTML=(h.overall_score||92)+'<span style="font-size:16px;opacity:.6">/100</span>'});const act=FOLDERS.filter(x=>x.s==="active").length;document.querySelectorAll(".sub").forEach(el=>{if(el.textContent.includes("folders"))el.textContent="Active "+act+"/"+FOLDERS.length+" folders \\u2022 Last scan: "+new Date(window._lastScan||Date.now()).toLocaleString("th-TH",{hour:"2-digit",minute:"2-digit"})});const lv=document.querySelector(".live");if(lv)lv.innerHTML='<div class="dot"></div>LIVE D1 \\u2022 '+new Date().toLocaleString("th-TH")}}catch(e){console.error("[ZCB Live]",e)}}fetchLiveData();setInterval(fetchLiveData,60000);`;

const oldReturn = 'return new Response(HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } });';
const newReturn = `const LIVE_INJECT = '<script>' + ${JSON.stringify(LIVE_SCRIPT)} + '<\\/script>';
    return new Response(HTML.replace('</body>', LIVE_INJECT + '</body>'), { headers: { "Content-Type": "text/html; charset=utf-8" } });`;

if (code.includes(oldReturn)) {
  code = code.replace(oldReturn, newReturn);
  console.log('Patched successfully!');
} else {
  console.log('WARNING: Could not find exact return statement.');
  console.log('Trying regex pattern...');
  code = code.replace(
    /return new Response\(HTML,\s*\{[^}]*"text\/html[^}]*\}\s*\);/,
    newReturn
  );
}

writeFileSync(join(SRC, 'index.js'), code);
console.log(`Written to src/index.js (${code.length} chars)`);

// Step 3: Deploy
console.log('\n[3/3] Deploying to Cloudflare Workers...');
try {
  const deployResult = execSync('npx wrangler deploy 2>&1', {
    cwd: DIR,
    encoding: 'utf-8',
    timeout: 120000
  });
  console.log(deployResult);
  console.log('\n=== DEPLOY COMPLETE! ===');
  console.log('Dashboard: https://teamzcb-dashboard.banknakorn39.workers.dev');
  console.log('Health Score should now show 100 (not 92)');
  console.log('Live D1 data refresh: every 60 seconds');
} catch(e) {
  console.log('Deploy error:', e.message);
  console.log('\nManual deploy: cd to this folder and run "npx wrangler deploy"');
}
