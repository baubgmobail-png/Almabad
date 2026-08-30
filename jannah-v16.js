
const J=Shifti;
const D=window.JANNAH_DATA_V16;
const API='https://api.alquran.cloud/v1';
const SURAHS=D.surahs,MORNING=D.morning,EVENING=D.evening,DUAS=D.duas;
const KEY='shifti_jannah_v2';
const $=id=>document.getElementById(id);

function rs(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch{return {}}}
function ws(s){try{localStorage.setItem(KEY,JSON.stringify(s))}catch{}}
function sn(n){return SURAHS[n-1]||('سورة '+n)}
function tab(n){document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===n));document.querySelectorAll('.jn-page').forEach(p=>p.classList.toggle('active',p.id==='page-'+n));if(n==='marks')marks()}
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>tab(b.dataset.tab)));
function fill(){['tafsirSurah','audioSurah'].forEach(id=>{if($(id))$(id).innerHTML=SURAHS.map((n,i)=>`<option value="${i+1}">${i+1} · سورة ${n}</option>`).join('')})}
async function fetchSurah(n,e){const r=await fetch(`${API}/surah/${n}/${e}`);if(!r.ok)throw Error();const j=await r.json();if(!j?.data)throw Error();return j.data}
function resumeOther(){const s=rs();if($('resumeTafsirText'))$('resumeTafsirText').textContent=s.lastTafsir?`سورة ${sn(s.lastTafsir.surah)} · آية ${s.lastTafsir.ayah}`:'لا يوجد';if($('resumeAudioText'))$('resumeAudioText').textContent=s.lastAudio?`سورة ${sn(s.lastAudio.surah)} · آية ${s.lastAudio.ayah||1}`:'لا يوجد'}

/* Tafsir */
async function tafsir(n,e,ay=null){
  $('tafsirView').innerHTML='<div class="loading">جاري تحميل التفسير…</div>';
  try{
    const d=await fetchSurah(n,e),label=$('tafsirEdition').selectedOptions[0]?.textContent||'التفسير';
    $('tafsirView').innerHTML=`<div class="jn-card quran-meta"><h2>سورة ${sn(n)}</h2><p>${label}</p>${d.ayahs.map(a=>`<div class="tafsir-row" id="tf-${a.numberInSurah}"><h3>الآية ${a.numberInSurah}</h3><p>${a.text}</p><button class="mark-btn" data-tf="${a.numberInSurah}">🔖 حفظ موضع التفسير</button></div>`).join('')}</div>`;
    document.querySelectorAll('[data-tf]').forEach(b=>b.onclick=()=>{const s=rs(),a=+b.dataset.tf;s.marks=Array.isArray(s.marks)?s.marks:[];const id=`tafsir:${n}:${a}:${e}`;s.marks=s.marks.filter(x=>x.id!==id);s.marks.unshift({id,type:'tafsir',surah:n,ayah:a,extra:e});s.lastTafsir={surah:n,ayah:a,edition:e};ws(s);resumeOther();marks();J.toast('تم حفظ موضع التفسير')});
    if(ay)setTimeout(()=>document.getElementById('tf-'+ay)?.scrollIntoView({behavior:'smooth',block:'center'}),120);
  }catch{$('tafsirView').innerHTML='<div class="error">تعذر تحميل التفسير. تأكد من الإنترنت.</div>'}
}
$('loadTafsir')?.addEventListener('click',()=>tafsir(+$('tafsirSurah').value,$('tafsirEdition').value));

/* Audio */
let aa=[],ai=0,pending=0,tick=0;
async function reciters(){try{const r=await fetch(`${API}/edition?format=audio&language=ar`),j=await r.json(),l=(j.data||[]).filter(x=>x.format==='audio');if(l.length){$('audioEdition').innerHTML=l.map(x=>`<option value="${x.identifier}">${x.name||x.englishName||x.identifier}</option>`).join('');if([...$('audioEdition').options].some(o=>o.value==='ar.alafasy'))$('audioEdition').value='ar.alafasy'}}catch{}}
function track(i,t=0){if(!aa.length)return;ai=Math.max(0,Math.min(i,aa.length-1));const a=aa[ai];$('audioNow').textContent=`الآية ${a.numberInSurah} من ${aa.length}`;$('audioProgress').textContent=`${ai+1} / ${aa.length}`;pending=t;$('quranAudio').src=a.audio;$('quranAudio').load();const s=rs();s.lastAudio={surah:+$('audioSurah').value,edition:$('audioEdition').value,ayah:a.numberInSurah,time:t};ws(s);resumeOther()}
async function audio(n,e,res=null){$('audioTitle').textContent='جاري تحميل التلاوة…';try{const d=await fetchSurah(n,e);aa=d.ayahs||[];$('audioTitle').textContent=`سورة ${sn(n)} · ${$('audioEdition').selectedOptions[0]?.textContent||''}`;let i=0,t=0;if(res&&res.surah===n&&res.edition===e){i=Math.max(0,aa.findIndex(a=>a.numberInSurah===res.ayah));t=res.time||0}track(i,t)}catch{$('audioTitle').textContent='تعذر تحميل التلاوة الآن.'}}
$('loadAudio')?.addEventListener('click',()=>audio(+$('audioSurah').value,$('audioEdition').value));$('prevAudio')?.addEventListener('click',()=>track(ai-1));$('nextAudio')?.addEventListener('click',()=>track(ai+1));
if($('quranAudio')){$('quranAudio').onloadedmetadata=()=>{if(pending&&pending<$('quranAudio').duration){$('quranAudio').currentTime=pending;pending=0}};$('quranAudio').onended=()=>{if(ai<aa.length-1){track(ai+1);$('quranAudio').play().catch(()=>{})}};$('quranAudio').ontimeupdate=()=>{if(Date.now()-tick<4000||!aa.length)return;tick=Date.now();const a=aa[ai],s=rs();s.lastAudio={surah:+$('audioSurah').value,edition:$('audioEdition').value,ayah:a.numberInSurah,time:$('quranAudio').currentTime||0};ws(s);resumeOther()}}

/* Adhkar — safe even with old/corrupt saved data */
let dm='morning';
function dstate(){const today=new Date().toISOString().slice(0,10),s=rs();if(!s.dhikr||s.dhikr.date!==today||!s.dhikr.counts||typeof s.dhikr.counts!=='object')s.dhikr={date:today,counts:{}};ws(s);return s.dhikr}
function adhkar(){const l=dm==='morning'?MORNING:EVENING,d=dstate();$('adhkarList').innerHTML=l.map((x,i)=>{const k=dm+'-'+i,c=Math.min(x.count,Number(d.counts[k])||0);return `<div class="dhikr-card"><h3>${x.title}</h3><p>${x.text}</p><div class="dhikr-foot"><small>${x.source} · التكرار: ${x.count}</small><button class="counter ${c>=x.count?'done':''}" data-c="${i}">${c} / ${x.count}</button></div></div>`}).join('');document.querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>{const s=rs(),d=dstate(),i=+b.dataset.c,k=dm+'-'+i,x=l[i];d.counts[k]=Math.min(x.count,(Number(d.counts[k])||0)+1);s.dhikr=d;ws(s);adhkar()})}
document.querySelectorAll('[data-dhikr]').forEach(b=>b.onclick=()=>{dm=b.dataset.dhikr;document.querySelectorAll('[data-dhikr]').forEach(x=>x.classList.toggle('active',x===b));adhkar()});
$('resetAdhkar')?.addEventListener('click',()=>{const s=rs();s.dhikr={date:new Date().toISOString().slice(0,10),counts:{}};ws(s);adhkar()});

/* Duas */
function duas(q=''){q=q.trim();const l=DUAS.filter(x=>!q||x.text.includes(q)||x.source.includes(q)||x.cat.includes(q));$('duaList').innerHTML=l.map(x=>`<div class="dhikr-card"><p>${x.text}</p><span class="source-badge">${x.cat} · ${x.source}</span></div>`).join('')||'<div class="empty">لا توجد نتائج.</div>'}
$('duaSearch')?.addEventListener('input',e=>duas(e.target.value));$('clearDua')?.addEventListener('click',()=>{$('duaSearch').value='';duas()});

/* Marks */
function marks(){if(!$('marksView'))return;const s=rs(),r=[];const lr=window.QuranReader?.getLastRead();if(lr?.page)r.push({i:'📖',t:'آخر قراءة',x:`صفحة ${lr.page} · سورة ${window.QuranReader.surahName(lr.surah||window.QuranReader.pageSurah(lr.page))}`,g:'p',p:lr.page});if(s.lastTafsir)r.push({i:'📚',t:'آخر تفسير',x:`سورة ${sn(s.lastTafsir.surah)} · آية ${s.lastTafsir.ayah}`,g:'t'});if(s.lastAudio)r.push({i:'🎧',t:'آخر استماع',x:`سورة ${sn(s.lastAudio.surah)} · آية ${s.lastAudio.ayah}`,g:'a'});(window.QuranReader?.getPageMarks()||[]).forEach(p=>r.push({i:'🔖',t:'علامة مصحف',x:`صفحة ${p}`,g:'p',p}));(Array.isArray(s.marks)?s.marks:[]).filter(m=>m.type==='tafsir').forEach(m=>r.push({i:'🔖',t:'علامة تفسير',x:`سورة ${sn(m.surah)} · آية ${m.ayah}`,g:'m',m}));$('marksView').innerHTML=r.length?r.map((o,i)=>`<div class="jn-card bookmark-card"><span class="bookmark-icon">${o.i}</span><div><h3>${o.t}</h3><p>${o.x}</p></div><button class="jn-btn secondary" data-g="${i}">فتح</button></div>`).join(''):'<div class="jn-card empty">لا توجد علامات بعد.</div>';document.querySelectorAll('[data-g]').forEach(b=>b.onclick=()=>go(r[+b.dataset.g]))}
function go(o){if(o.g==='p'){tab('quran');window.QuranReader.showPage(o.p)}else if(o.g==='t'||o.g==='m'){const x=o.m||rs().lastTafsir;$('tafsirSurah').value=x.surah;$('tafsirEdition').value=x.extra||x.edition||'ar.jalalayn';tab('tafsir');tafsir(x.surah,$('tafsirEdition').value,x.ayah)}else if(o.g==='a'){const x=rs().lastAudio;$('audioSurah').value=x.surah;$('audioEdition').value=x.edition;tab('audio');audio(x.surah,x.edition,x)}}
window.addEventListener('quranmarkschange',marks);
$('resumeRead')?.addEventListener('click',()=>{tab('quran');window.QuranReader?.resume()});$('resumeTafsir')?.addEventListener('click',()=>{if(rs().lastTafsir)go({g:'t'});else tab('tafsir')});$('resumeAudio')?.addEventListener('click',()=>{if(rs().lastAudio)go({g:'a'});else tab('audio')});

/* Independent init */
fill();resumeOther();
try{adhkar()}catch(e){console.error(e)}
try{duas()}catch(e){console.error(e)}
try{marks()}catch(e){console.error(e)}
try{reciters()}catch(e){console.error(e)}
const s=rs();if(s.lastTafsir&&$('tafsirSurah'))$('tafsirSurah').value=s.lastTafsir.surah;if(s.lastAudio&&$('audioSurah'))$('audioSurah').value=s.lastAudio.surah;
