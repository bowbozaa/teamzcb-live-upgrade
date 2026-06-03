// auto-patch-deploy.mjs - Downloads, patches, and deploys in one step
import { execSync } from 'child_process';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';

const DIR = 'C:\\Users\\Admin\\Dropbox\\API Weaver\\teamzcb-live-upgrade';
const SRC = DIR + '\\src';

console.log('=== ZCB Dashboard Live D1 Upgrade ===\n');

// Step 1: Get current worker code via Cloudflare API (wrangler authenticated)
console.log('[1/3] Downloading Worker code via wrangler...');
if (!existsSync(SRC)) mkdirSync(SRC, { recursive: true });

try {
  execSync('npx wrangler@latest download teamzcb-dashboard --outdir download-temp', {
    cwd: DIR, encoding: 'utf-8', stdio: 'inherit', timeout: 60000
  });
} catch(e) {
  console.log('wrangler download had issues, checking files...');
}

// Find the downloaded JS file
let code = '';
const tryPaths = [
  DIR + '\\download-temp\\index.js',
  DIR + '\\download-temp\\src\\index.js',
  DIR + '\\download-temp\\worker.js',
];
for (const p of tryPaths) {
  try { code = readFileSync(p, 'utf-8'); console.log('Found: ' + p); break; } catch(e) {}
}

if (!code) {
  console.error('ERROR: Could not find downloaded Worker code.');
  console.log('Try manually: npx wrangler download teamzcb-dashboard --outdir download-temp');
  process.exit(1);
}

// Step 2: Patch
console.log('\n[2/3] Injecting live D1 data script...');

const LIVE_JS = `async function fetchLiveData(){try{const[a,b]=await Promise.all([fetch("/api/data"),fetch("/api/files")]);const d=await a.json();const f=await b.json();if(d.folders)for(const x of d.folders){const n=parseInt((x.folder_number||"").replace(/\\\\D/g,""));const fo=typeof FOLDERS!=="undefined"&&FOLDERS.find(z=>z.id===n);if(fo){fo.c=x.file_count||0;fo.s=x.file_count>0?(fo.s==="restricted"?"restricted":"active"):"empty";try{const nm=typeof x.file_names==="string"?JSON.parse(x.file_names):(x.file_names||[]);if(nm.length>0)fo.f=nm}catch(e){}if(x.scanned_at)fo.m=x.scanned_at.slice(0,10);if(x.owner)fo.o=x.owner}}if(f.files&&f.files.length>0)FILE_REG=f.files;if(d.health)window._liveHealth=d.health;if(d.updated)window._lastScan=d.updated;render();const h=window._liveHealth;if(h){document.querySelectorAll(".val.g").forEach(el=>{if(el.textContent.includes("/100"))el.innerHTML=(h.overall_score||92)+'<span style="font-size:16px;opacity:.6">/100</span>'});const act=FOLDERS.filter(x=>x.s==="active").length;document.querySelectorAll(".sub").forEach(el=>{if(el.textContent.includes("folders"))el.textContent="Active "+act+"/"+FOLDERS.length+" folders \\u2022 Scan: "+new Date(window._lastScan||Date.now()).toLocaleString("th-TH",{hour:"2-digit",minute:"2-digit"})});const lv=document.querySelector(".live");if(lv)lv.innerHTML='<div class="dot"></div>LIVE D1 \\u2022 '+new Date().toLocaleString("th-TH")}}catch(e){console.error("[ZCB]",e)}}fetchLiveData();setInterval(fetchLiveData,60000);`;

const oldRet = 'return new Response(HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } });';
const newRet = `const _LI='<script>'+${JSON.stringify(LIVE_JS)}+'<\\/script>';
    return new Response(HTML.replace('</body>',_LI+'</body>'), { headers: { "Content-Type": "text/html; charset=utf-8" } });`;

if (code.includes(oldRet)) {
  code = code.replace(oldRet, newRet);
  console.log('Patched OK!');
} else {
  code = code.replace(
    /return new Response\(HTML,\s*\{[^}]*"text\/html[^}]*\}\s*\);/,
    newRet
  );
  console.log('Patched via regex');
}

writeFileSync(SRC + '\\index.js', code, 'utf-8');
console.log('Written src/index.js (' + code.length + ' chars)');

// Step 3: Deploy
console.log('\n[3/3] Deploying...');
try {
  execSync('npx wrangler deploy', { cwd: DIR, encoding: 'utf-8', stdio: 'inherit', timeout: 120000 });
  console.log('\n=== DEPLOY SUCCESS! ===');
  console.log('URL: https://teamzcb-dashboard.banknakorn39.workers.dev');
} catch(e) {
  console.log('Deploy error. Try manually: cd "' + DIR + '" && npx wrangler deploy');
}
