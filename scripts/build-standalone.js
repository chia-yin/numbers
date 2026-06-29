#!/usr/bin/env node
// 產生單檔、可離線直接開的網頁版(無 server / 無 AI),把 81 數理資料內嵌進去。
// 用法:
//   node scripts/build-standalone.js            → 純分析版(對方自己貼號碼)
//   node scripts/build-standalone.js cht         → 先爬中華電信,把號碼烤進 html(對方開檔即見好號)
//   node scripts/build-standalone.js fet         → 先爬遠傳(需 Playwright)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fetchCandidates } from '../src/crawler/index.js';
import { loadSnapshot } from '../src/crawler/cache.js';

const numerology = readFileSync(new URL('../config/81數理.json', import.meta.url), 'utf8');

// 可選:build 時把號碼烤進 html
//   <id>            → 即時爬該來源
//   cache:<id>      → 用上次抓取的快取(免重爬,推薦)
const ALIAS = { cht: 'cht-find-available', fet: 'fet-ecare-booking', 'fet-theme': 'fetnet-theme' };
let preload = [];
const want = process.argv[2];
if (want && want.startsWith('cache:')) {
  const id = ALIAS[want.slice(6)] || want.slice(6);
  const snap = await loadSnapshot(id);
  if (!snap) { console.error(`找不到「${id}」的快取,請先在批次選號頁抓取一次`); process.exit(1); }
  preload = snap.candidates || [];
  console.error(`用快取「${id}」(${snap.savedAt}):${preload.length} 筆,嵌入 html`);
} else if (want) {
  const sources = JSON.parse(readFileSync(new URL('../config/sources.json', import.meta.url), 'utf8'));
  const src = sources.find((s) => s.id === (ALIAS[want] || want));
  if (!src) { console.error(`找不到來源「${want}」`); process.exit(1); }
  console.error(`爬取「${src.name}」中…(把號碼烤進 html)`);
  preload = await fetchCandidates(src);
  console.error(`抓到 ${preload.length} 筆,嵌入 html`);
}

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
.sc{margin-top:1.5rem;background:var(--s);border:1px solid var(--b);border-radius:var(--r);padding:1rem 1.25rem;box-shadow:var(--sh)}
.sc-h{font-size:1.05rem;color:var(--pd)}
.sc-b{background:var(--p);color:#fff;border-radius:999px;padding:.1rem .7rem;font-size:.85rem;margin-left:.3rem}
.sc-f{margin:.6rem 0 .3rem;font-size:1rem}.sc-f i{color:var(--mut);font-size:.85rem;font-style:normal;margin:0 .2rem}
.sc-d{font-size:.92rem;color:var(--mut)}
.sc-e{margin:.8rem 0 .3rem;padding-top:.7rem;border-top:1px dashed var(--b);font-size:1rem}
.st{font-size:.78rem;padding:.05rem .5rem;border-radius:999px;border:1px solid var(--b);color:var(--mut)}
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
    <div id="sancai" class="sc"></div>
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
const PRELOAD=${JSON.stringify(preload)};
const G=['總格','天格','人格','地格','外格'];
const CLS={'○':'good','▲':'mid','X':'bad'};
function wux(d){d=+d;if(d===1||d===2)return'木';if(d===3||d===4)return'火';if(d===5||d===6)return'土';if(d===7||d===8)return'金';return'水'}
function n81(v){let k=v;if(k<1||k>81)k=((k-1)%80+80)%80+1;return N[k]||{symbol:'?',luck:'?',text:''}}
// 五行生克(老師三才五格心法)
const GEN={木:'火',火:'土',土:'金',金:'水',水:'木'},RES={木:'土',土:'水',水:'火',火:'金',金:'木'};
function rel(a,b){if(a===b)return'比和';if(GEN[a]===b)return'生';if(GEN[b]===a)return'被生';if(RES[a]===b)return'剋';return'被剋'}
// 三才:天才→人才→地才;金剋木為「友情之剋」判吉
function sancai(g){
  const t=g.天格.wuxing,r=g.人格.wuxing,d=g.地格.wuxing,tr=rel(t,r),rd=rel(r,d);
  const trF=tr==='剋'&&t==='金'&&r==='木',rdF=rd==='剋'&&r==='金'&&d==='木';
  const seg=(x,f)=>x==='生'||x==='比和'?1:x==='剋'?(f?1:-1):0,sc=seg(tr,trF)+seg(rd,rdF);
  let luck,desc;
  if(sc>=2){luck='大吉';desc='三才相生,氣勢順暢,根基穩、運途旺。'}
  else if(sc===1){luck='吉';desc='三才大致相生,整體平順向上。'}
  else if(sc===0){luck='平';desc='三才平和,無生無剋,平穩持中。'}
  else if(sc===-1){luck='帶凶';desc='三才有相剋,過程易有阻礙,須留意。'}
  else{luck='凶';desc='三才相剋重,根基不穩,宜謹慎。'}
  if(trF||rdF)desc+='當中金剋木為「友情之剋」,主棟梁之才、有經商歷練成器之象。';
  return{配置:t+'-'+r+'-'+d,天才:t,人才:r,地才:d,天人:tr,人地:rd,luck,desc};
}
// 五格五行能量分布:同一五行≥3 判能量過集中
function energy(g){
  const c={};for(const k of G){const w=g[k].wuxing;c[w]=(c[w]||0)+1}
  const e=Object.entries(c).sort((a,b)=>b[1]-a[1]),dom=e[0][0],n=e[0][1];let luck,desc;
  if(n>=3){luck='偏弱';desc='五格中「'+dom+'」出現 '+n+' 次,能量過於集中、缺乏其他五行助力。'}
  else if(e.length>=4){luck='佳';desc='五行分布均衡多元,彼此能相生相助。'}
  else{luck='平';desc='五行分布尚可,能量未過度集中。'}
  return{counts:c,luck,desc};
}
// 四季論強弱:數值十位定四季,木依老師特例春夏旺
const SB=['春','春','夏','夏','秋','秋','冬','冬','春'],PEAK={木:['春','夏'],火:['夏'],土:['夏'],金:['秋'],水:['冬']},THR={火:'春',土:'夏',水:'秋'};
function season(v,w){const s=SB[Math.floor((v%100)/10)]||'春';let l;if((PEAK[w]||[]).includes(s))l='旺';else if(THR[w]===s)l='相';else l='弱';return s+'令·'+l}
function analyze(raw){
  let p=String(raw).replace(/[^0-9]/g,'');if(!p)return null;
  let g;if(p.length===10&&p[0]==='0'){p=p.slice(1);g=[3,3,3]}else if(p.length===9)g=[3,3,3];else{const r=p.length-6;g=r>0?[3,3,r]:[p.length]}
  let off=0,parts=[];for(const len of g){parts.push(p.slice(off,off+len));off+=len}
  const sum=s=>[...s].reduce((a,c)=>a+ +c,0);
  const n1=sum(parts[0]||''),n2=sum(parts[1]||''),n3=sum(parts[2]||'');
  const vals={總格:n1+n2+n3,天格:n1+1,人格:n1+n2,地格:n2+n3,外格:n3+1};
  const out={};let good=0;
  for(const k of G){const v=vals[k];const m=n81(v);if(m.symbol==='○')good++;out[k]={value:v,wuxing:wux(v%10),symbol:m.symbol,luck:m.luck,text:m.text,season:season(v,wux(v%10))}}
  return{phone:String(raw).replace(/[^0-9]/g,''),grids:out,good,sancai:sancai(out),energy:energy(out)}
}
function tab(n){t1.className=n===1?'on':'';t2.className=n===2?'on':'';s1.className=n===1?'':'hide';s2.className=n===2?'':'hide'}
function lvl(g){return g>=4?'大吉':g>=3?'吉':g>=2?'半吉':g>=1?'帶凶':'凶'}
function one(){
  const a=analyze(phone.value);if(!a){return}
  r1.className='';
  const tot=a.grids.總格;verdict.className=CLS[tot.symbol];
  verdict.innerHTML='<div class="lv">'+lvl(a.good)+'</div><div>五格中 '+a.good+' 個吉（○）</div>';
  const s=a.sancai,e=a.energy;
  const dist=Object.entries(e.counts).map(c=>c[0]+'×'+c[1]).join('　');
  sancai.innerHTML='<div class="sc-h">三才配置　<b>'+s.配置+'</b>　<span class="sc-b">'+s.luck+'</span></div>'
    +'<div class="sc-f">天才 '+s.天才+' <i>—'+s.天人+'→</i> 人才 '+s.人才+' <i>—'+s.人地+'→</i> 地才 '+s.地才+'</div>'
    +'<div class="sc-d">'+s.desc+'</div>'
    +'<div class="sc-e"><b>五行能量</b>　'+dist+'　<span class="sc-b">'+e.luck+'</span></div>'
    +'<div class="sc-d">'+e.desc+'</div>';
  grid.innerHTML=G.map(k=>{const x=a.grids[k];return '<tr class="'+CLS[x.symbol]+'"><td>'+k+'</td><td>'+x.value+'</td><td>'+x.wuxing+'</td><td>'+x.symbol+' '+x.luck+'</td></tr>'}).join('');
  detail.innerHTML=G.map(k=>{const x=a.grids[k];return '<div class="di '+CLS[x.symbol]+'"><div class="dh">'+k+'　'+x.value+'　'+x.wuxing+'　'+x.symbol+' '+x.luck+'　<span class="st">'+x.season+'</span></div><div class="dt">'+(x.text||'')+'</div></div>'}).join('');
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
// 若 build 時已烤入號碼,開檔自動載入並分析
if(PRELOAD.length){tab(2);document.getElementById('batch').value=PRELOAD.join('\\n');many()}
</script>
</body>
</html>
`;

mkdirSync(new URL('../dist/', import.meta.url), { recursive: true });
const out = new URL('../dist/公號數字學.html', import.meta.url);
writeFileSync(out, html, 'utf8');
console.error('已產生:dist/公號數字學.html');
