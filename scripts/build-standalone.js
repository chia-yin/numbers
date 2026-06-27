#!/usr/bin/env node
// 產生單檔、可離線直接開的網頁版(無 server / 無 AI),把 81 數理資料內嵌進去。
// 用法:node scripts/build-standalone.js  → 產生 dist/公號數字學.html
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const numerology = readFileSync(new URL('../config/81數理.json', import.meta.url), 'utf8');

const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>公號數字學 — 手機號碼五格分析</title>
<style>
:root{--p:#2d6a4f;--pd:#1b4332;--bg:#f4f7f4;--s:#fff;--b:#e3e8e3;--mut:#6b7280;--r:12px;--sh:0 1px 3px rgba(0,0,0,.06),0 4px 16px rgba(0,0,0,.04)}
*{box-sizing:border-box}
body{font-family:-apple-system,"Noto Sans TC",sans-serif;max-width:860px;margin:0 auto;padding:2rem 1.25rem 4rem;background:var(--bg);color:#2b2b2b;line-height:1.6}
h1{font-size:1.6rem;color:var(--pd);margin:0 0 .25rem}
h3{color:var(--pd);font-size:1.15rem;margin:0 0 .5rem}
.tabs{display:flex;gap:.5rem;margin:1rem 0 1.5rem}
.tabs button{padding:.4rem .9rem;border:1px solid var(--b);border-radius:999px;background:var(--s);color:var(--pd);cursor:pointer;font-size:.9rem}
.tabs button.on{background:var(--p);color:#fff;border-color:var(--p)}
.card{background:var(--s);border:1px solid var(--b);border-radius:var(--r);box-shadow:var(--sh);padding:1.25rem 1.5rem;margin-bottom:1.25rem}
input,textarea,select{width:100%;padding:.6rem .75rem;border:1px solid var(--b);border-radius:8px;font-size:1rem;font-family:inherit;margin-top:.3rem}
textarea{font-family:monospace;font-size:.9rem;resize:vertical}
button.btn{background:var(--p);color:#fff;border:none;border-radius:8px;padding:.7rem 1rem;font-size:1rem;cursor:pointer;margin-top:.6rem}
button.btn:hover{background:var(--pd)}
.hint{font-size:.82rem;color:var(--mut)}
table{border-collapse:separate;border-spacing:0;width:100%;margin-top:1.25rem;background:var(--s);border-radius:var(--r);overflow:hidden;box-shadow:var(--sh);font-size:.95rem}
th,td{padding:.7rem .85rem;text-align:center;border-bottom:1px solid var(--b)}
th{background:#eef3ef;color:var(--pd)}
tr:last-child td{border-bottom:none}
#verdict{padding:1.5rem 1.75rem;border-radius:var(--r);margin-top:1.5rem;box-shadow:var(--sh)}
#verdict .lv{font-size:2rem;font-weight:700}
.detail{margin-top:1.5rem}
.di{border-radius:var(--r);padding:.85rem 1.1rem;box-shadow:var(--sh);margin-bottom:.6rem}
.dh{font-weight:600;margin-bottom:.35rem}
.dt{font-size:.92rem;line-height:1.75}
.good{background:#d8f0de;color:#1b5e2b}.mid{background:#fdf0cf;color:#8a6100}.bad{background:#fad9dd;color:#8a1c28}
.hide{display:none}
.badge{font-weight:700;color:var(--pd)}
</style>
</head>
<body>
<h1>公號數字學 — 手機號碼五格分析</h1>
<div class="tabs"><button id="t1" class="on" onclick="tab(1)">單號分析</button><button id="t2" onclick="tab(2)">批次篩選</button></div>

<section id="s1">
  <div class="card">
    <label>手機號碼<input id="phone" inputmode="numeric" placeholder="例如 0936102682"></label>
    <p class="hint">輸入台灣手機 10 碼,系統自動去掉開頭 0,依老師算法切 3-3-3。</p>
    <button class="btn" onclick="one()">分析</button>
  </div>
  <div id="r1" class="hide">
    <div id="verdict"></div>
    <table><thead><tr><th>格名</th><th>數值</th><th>五行</th><th>吉凶</th></tr></thead><tbody id="grid"></tbody></table>
    <div class="detail"><h3>各格詳解（81 數理斷語）</h3><div id="detail"></div></div>
  </div>
</section>

<section id="s2" class="hide">
  <div class="card">
    <label>貼入號碼（一行一個）<textarea id="batch" rows="8" placeholder="0905239673&#10;0936102682"></textarea></label>
    <label style="margin-top:.6rem">只看「至少幾個吉（○）」
      <select id="mg"><option value="0">全部</option><option value="1">≥1</option><option value="2">≥2</option><option value="3">≥3</option><option value="4">≥4</option><option value="5">5全吉</option></select>
    </label>
    <button class="btn" onclick="many()">分析並排名</button>
    <button class="btn" onclick="csv()" id="csvb" style="display:none">匯出 CSV</button>
  </div>
  <div id="stat" class="hint"></div>
  <table id="bt" class="hide"><thead><tr><th>#</th><th>號碼</th><th>總</th><th>天</th><th>人</th><th>地</th><th>外</th><th>吉</th></tr></thead><tbody id="brows"></tbody></table>
  <p class="hint">○ 吉　▲ 半吉　X 凶</p>
</section>

<script>
const N=${numerology};
const G=['總格','天格','人格','地格','外格'];
const CLS={'○':'good','▲':'mid','X':'bad'};
function wux(d){d=+d;if(d===1||d===2)return'木';if(d===3||d===4)return'火';if(d===5||d===6)return'土';if(d===7||d===8)return'金';return'水'}
function n81(v){let k=v;if(k<1||k>81)k=((k-1)%80+80)%80+1;return N[k]||{symbol:'?',luck:'?',text:''}}
function analyze(raw){
  let p=String(raw).replace(/[^0-9]/g,'');if(!p)return null;
  let g;if(p.length===10&&p[0]==='0'){p=p.slice(1);g=[3,3,3]}else if(p.length===9)g=[3,3,3];else{const r=p.length-6;g=r>0?[3,3,r]:[p.length]}
  let off=0,parts=[];for(const len of g){parts.push(p.slice(off,off+len));off+=len}
  const sum=s=>[...s].reduce((a,c)=>a+ +c,0);
  const n1=sum(parts[0]||''),n2=sum(parts[1]||''),n3=sum(parts[2]||'');
  const vals={總格:n1+n2+n3,天格:n1+1,人格:n1+n2,地格:n2+n3,外格:n3+1};
  const out={};let good=0;
  for(const k of G){const v=vals[k];const m=n81(v);if(m.symbol==='○')good++;out[k]={value:v,wuxing:wux(v%10),symbol:m.symbol,luck:m.luck,text:m.text}}
  return{phone:String(raw).replace(/[^0-9]/g,''),grids:out,good}
}
function tab(n){t1.className=n===1?'on':'';t2.className=n===2?'on':'';s1.className=n===1?'':'hide';s2.className=n===2?'':'hide'}
function lvl(g){return g>=4?'大吉':g>=3?'吉':g>=2?'半吉':g>=1?'帶凶':'凶'}
function one(){
  const a=analyze(phone.value);if(!a){return}
  r1.className='';
  const tot=a.grids.總格;verdict.className=CLS[tot.symbol];
  verdict.innerHTML='<div class="lv">'+lvl(a.good)+'</div><div>五格中 '+a.good+' 個吉（○）</div>';
  grid.innerHTML=G.map(k=>{const x=a.grids[k];return '<tr class="'+CLS[x.symbol]+'"><td>'+k+'</td><td>'+x.value+'</td><td>'+x.wuxing+'</td><td>'+x.symbol+' '+x.luck+'</td></tr>'}).join('');
  detail.innerHTML=G.map(k=>{const x=a.grids[k];return '<div class="di '+CLS[x.symbol]+'"><div class="dh">'+k+'　'+x.value+'　'+x.wuxing+'　'+x.symbol+' '+x.luck+'</div><div class="dt">'+(x.text||'')+'</div></div>'}).join('');
}
let last=[];
function many(){
  const list=batch.value.split('\\n').map(s=>s.trim()).filter(Boolean);
  const min=+document.getElementById('mg').value;
  const res=list.map(analyze).filter(Boolean).filter(a=>a.good>=min).sort((x,y)=>y.good-x.good);
  last=res;
  brows.innerHTML=res.map((a,i)=>'<tr><td>'+(i+1)+'</td><td>'+a.phone+'</td>'+G.map(k=>'<td class="'+CLS[a.grids[k].symbol]+'">'+a.grids[k].symbol+'</td>').join('')+'<td class="badge">'+a.good+'/5</td></tr>').join('');
  stat.textContent='共 '+list.length+' 筆,符合 '+res.length+' 筆';
  bt.className=res.length?'':'hide';csvb.style.display=res.length?'':'none';
}
function csv(){
  if(!last.length)return;
  const h=['排名','號碼','吉數',...G.flatMap(k=>[k+'數值',k+'五行',k+'吉凶',k+'斷語'])];
  const esc=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
  const rows=last.map((a,i)=>[i+1,'="'+a.phone+'"',a.good+'/5',...G.flatMap(k=>{const x=a.grids[k];return[x.value,x.wuxing,x.luck,x.text]})].map((c,j)=>j===1?c:esc(c)).join(','));
  const blob=new Blob(['\\ufeff'+[h.map(esc).join(','),...rows].join('\\r\\n')],{type:'text/csv;charset=utf-8'});
  const u=URL.createObjectURL(blob);const link=document.createElement('a');link.href=u;link.download='五格分析.csv';link.click();URL.revokeObjectURL(u);
}
</script>
</body>
</html>
`;

mkdirSync(new URL('../dist/', import.meta.url), { recursive: true });
const out = new URL('../dist/公號數字學.html', import.meta.url);
writeFileSync(out, html, 'utf8');
console.error('已產生:dist/公號數字學.html');
