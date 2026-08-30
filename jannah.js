
const J=Shifti;
const D=window.JANNAH_DATA;
const API='https://api.alquran.cloud/v1';
const SURAHS=D.surahs, MORNING=D.morning, EVENING=D.evening, DUAS=D.duas;
const KEY='shifti_jannah_v2';
const LEGACY_KEY='shifti_jannah_v1';
const $=id=>document.getElementById(id);

let state={};
try{
  state=JSON.parse(localStorage.getItem(KEY)||'null')
    ||JSON.parse(localStorage.getItem(LEGACY_KEY)||'null')
    ||{};
}catch{state={}}
state.marks=Array.isArray(state.marks)?state.marks:[];
state.pageMarks=Array.isArray(state.pageMarks)?state.pageMarks:[];
state.lastRead=state.lastRead||null;
state.lastTafsir=state.lastTafsir||null;
state.lastAudio=state.lastAudio||null;

function save(){localStorage.setItem(KEY,JSON.stringify(state))}
function surahName(n){return SURAHS[n-1]||('سورة '+n)}
function fillSurahs(){
  ['quranSurah','tafsirSurah','audioSurah'].forEach(id=>{
    $(id).innerHTML=SURAHS.map((n,i)=>`<option value="${i+1}">${i+1} · سورة ${n}</option>`).join('');
  });
}
function setTab(name){
  document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));
  document.querySelectorAll('.jn-page').forEach(p=>p.classList.toggle('active',p.id==='page-'+name));
  if(name==='marks')renderMarks();
}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>setTab(b.dataset.tab));

async function fetchSurah(n,edition){
  const r=await fetch(`${API}/surah/${n}/${edition}`);
  if(!r.ok)throw Error('network');
  const j=await r.json();
  if(!j||j.code!==200||!j.data)throw Error('data');
  return j.data;
}
const errorBox=m=>`<div class="error">${m}</div>`;

function mark(type,surah,ayah,extra=''){
  const id=`${type}:${surah}:${ayah}:${extra}`;
  const old=state.marks.find(x=>x.id===id);
  if(old)state.marks=state.marks.filter(x=>x.id!==id);
  else state.marks.unshift({id,type,surah,ayah,extra,at:new Date().toISOString()});
  save(); renderMarks(); J.toast(old?'تم حذف العلامة':'تم حفظ العلامة');
}
function pageMarked(page){return state.pageMarks.includes(page)}
function togglePageMark(page){
  if(pageMarked(page)){
    state.pageMarks=state.pageMarks.filter(p=>p!==page);
    J.toast('تم حذف علامة الصفحة');
  }else{
    state.pageMarks.unshift(page);
    J.toast('تم حفظ الصفحة');
  }
  save();
  updatePageBookmarkButton();
  renderMarks();
}
function isMarked(type,surah,ayah,extra=''){
  return state.marks.some(x=>x.id===`${type}:${surah}:${ayah}:${extra}`);
}

/* ---------- Mushaf pages ---------- */
const PAGE_TOTAL=604;
const PAGE_IMG_BASE='https://surahquran.com/img/pages-quran/';
const PAGE_FALLBACK_BASE='https://e-quran.com/pic/';
const SURAH_PAGE_FALLBACK=[
1,2,50,77,106,128,151,177,187,208,221,235,249,255,262,267,282,293,305,312,
322,332,342,350,359,367,377,385,396,404,411,415,418,428,434,440,446,453,458,
467,477,483,489,496,499,502,507,511,515,518,520,523,526,528,531,534,537,542,
545,549,551,553,554,556,558,560,562,564,566,568,570,572,574,575,577,578,580,
582,583,585,586,587,587,589,590,591,591,592,593,594,595,595,596,596,597,597,
598,598,599,599,600,600,601,601,601,602,602,602,603,603,603,604,604,604
];
let currentPage=1, zoom=1, imgFallbackUsed=false;
let touchStartX=0,touchStartY=0;

function pageUrl(page){
  return `${PAGE_IMG_BASE}page${String(page).padStart(3,'0')}.png`;
}
function fallbackPageUrl(page){
  return `${PAGE_FALLBACK_BASE}p${page}.jpg`;
}
function pageApproxSurah(page){
  let idx=0;
  for(let i=0;i<SURAH_PAGE_FALLBACK.length;i++){
    if(SURAH_PAGE_FALLBACK[i]<=page) idx=i; else break;
  }
  return idx+1;
}
function updateResume(){
  let read='لا يوجد';
  if(state.lastRead?.page) read=`صفحة ${state.lastRead.page} · سورة ${surahName(state.lastRead.surah||pageApproxSurah(state.lastRead.page))}`;
  else if(state.lastRead?.surah) read=`سورة ${surahName(state.lastRead.surah)}`;
  $('resumeReadText').textContent=read;
  $('resumeTafsirText').textContent=state.lastTafsir?`سورة ${surahName(state.lastTafsir.surah)} · آية ${state.lastTafsir.ayah}`:'لا يوجد';
  $('resumeAudioText').textContent=state.lastAudio?`سورة ${surahName(state.lastAudio.surah)} · آية ${state.lastAudio.ayah||1}`:'لا يوجد';
}
function updatePageBookmarkButton(){
  $('bookmarkPage').classList.toggle('saved',pageMarked(currentPage));
  $('bookmarkPage').textContent=pageMarked(currentPage)?'🔖✓':'🔖';
}
function updatePageUI(){
  const approx=pageApproxSurah(currentPage);
  $('pageNumberInput').value=currentPage;
  $('mushafPageTitle').textContent=`صفحة ${currentPage}`;
  $('mushafPageSurah').textContent=`تقريبًا: سورة ${surahName(approx)}`;
  $('pageCounter').textContent=`${currentPage} / ${PAGE_TOTAL}`;
  $('prevPage').disabled=$('prevPageBottom').disabled=currentPage<=1;
  $('nextPage').disabled=$('nextPageBottom').disabled=currentPage>=PAGE_TOTAL;
  updatePageBookmarkButton();
}
function setZoom(next){
  zoom=Math.max(1,Math.min(2.25,next));
  $('mushafImage').style.width=(zoom*100)+'%';
  if(zoom===1){$('mushafStage').scrollLeft=0}
}
function showPage(page,{savePosition=true}={}){
  page=Math.max(1,Math.min(PAGE_TOTAL,Number(page)||1));
  currentPage=page;
  imgFallbackUsed=false;
  $('mushafLoading').classList.remove('hidden');
  $('mushafImage').style.opacity='.15';
  $('mushafImage').src=pageUrl(page);
  updatePageUI();
  if(savePosition){
    const s=pageApproxSurah(page);
    state.lastRead={page,surah:s,at:new Date().toISOString()};
    save(); updateResume();
  }
  // Preload adjacent pages.
  [page-1,page+1].filter(p=>p>=1&&p<=PAGE_TOTAL).forEach(p=>{
    const i=new Image(); i.src=pageUrl(p);
  });
}
$('mushafImage').onload=()=>{
  $('mushafLoading').classList.add('hidden');
  $('mushafImage').style.opacity='1';
  $('mushafStage').scrollTop=0;
};
$('mushafImage').onerror=()=>{
  if(!imgFallbackUsed){
    imgFallbackUsed=true;
    $('mushafImage').src=fallbackPageUrl(currentPage);
  }else{
    $('mushafLoading').textContent='تعذر تحميل صفحة المصحف. تأكد من الإنترنت.';
  }
};
async function openSurahStart(n){
  let page=SURAH_PAGE_FALLBACK[n-1]||1;
  try{
    const d=await fetchSurah(n,'quran-uthmani-quran-academy');
    const apiPage=d?.ayahs?.[0]?.page;
    if(apiPage>=1&&apiPage<=604) page=apiPage;
  }catch{}
  showPage(page);
}
$('loadQuran').onclick=()=>openSurahStart(+$('quranSurah').value);
$('prevPage').onclick=$('prevPageBottom').onclick=()=>showPage(currentPage-1);
$('nextPage').onclick=$('nextPageBottom').onclick=()=>showPage(currentPage+1);
$('pageNumberInput').onchange=()=>showPage(+$('pageNumberInput').value);
$('pageNumberInput').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();showPage(+$('pageNumberInput').value);$('pageNumberInput').blur()}};
$('zoomIn').onclick=()=>setZoom(zoom+.25);
$('zoomOut').onclick=()=>setZoom(zoom-.25);
$('bookmarkPage').onclick=()=>togglePageMark(currentPage);

$('mushafStage').addEventListener('touchstart',e=>{
  if(e.touches.length!==1)return;
  touchStartX=e.touches[0].clientX; touchStartY=e.touches[0].clientY;
},{passive:true});
$('mushafStage').addEventListener('touchend',e=>{
  if(!e.changedTouches.length||zoom>1.05)return;
  const dx=e.changedTouches[0].clientX-touchStartX;
  const dy=e.changedTouches[0].clientY-touchStartY;
  if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.35){
    if(dx<0) showPage(currentPage+1); else showPage(currentPage-1);
  }
},{passive:true});

/* ---------- Tafsir ---------- */
async function showTafsir(n,edition,scrollAyah=null){
  $('tafsirView').innerHTML='<div class="loading">جاري تحميل التفسير…</div>';
  try{
    const d=await fetchSurah(n,edition);
    const label=$('tafsirEdition').selectedOptions[0]?.textContent||'التفسير';
    $('tafsirView').innerHTML=`<div class="jn-card quran-meta"><h2>سورة ${surahName(n)}</h2><p>${label}</p><div>${d.ayahs.map(a=>`<div class="tafsir-row" id="tafsir-${a.numberInSurah}"><h3>الآية ${a.numberInSurah}</h3><p>${a.text}</p><button class="mark-btn" data-mark-tafsir="${a.numberInSurah}">🔖 حفظ موضع التفسير</button></div>`).join('')}</div></div>`;
    document.querySelectorAll('[data-mark-tafsir]').forEach(b=>b.onclick=()=>{
      const ay=+b.dataset.markTafsir;
      state.lastTafsir={surah:n,ayah:ay,edition};
      mark('tafsir',n,ay,edition); save(); updateResume();
    });
    if(scrollAyah)setTimeout(()=>document.getElementById('tafsir-'+scrollAyah)?.scrollIntoView({behavior:'smooth',block:'center'}),150);
  }catch{$('tafsirView').innerHTML=errorBox('تعذر تحميل التفسير الآن.')}
}
$('loadTafsir').onclick=()=>showTafsir(+$('tafsirSurah').value,$('tafsirEdition').value);

/* ---------- Audio ---------- */
let audioAyahs=[],audioIndex=0,pendingResume=0,lastAudioSave=0;
async function loadReciters(){
  try{
    const r=await fetch(`${API}/edition?format=audio&language=ar`);
    const j=await r.json();
    const list=(j.data||[]).filter(x=>x.format==='audio');
    if(list.length){
      $('audioEdition').innerHTML=list.map(x=>`<option value="${x.identifier}">${x.name||x.englishName||x.identifier}</option>`).join('');
      if([...$('audioEdition').options].some(o=>o.value==='ar.alafasy'))$('audioEdition').value='ar.alafasy';
    }
  }catch{}
}
function setAudioTrack(i,resume=0){
  if(!audioAyahs.length)return;
  audioIndex=Math.max(0,Math.min(i,audioAyahs.length-1));
  const a=audioAyahs[audioIndex];
  $('audioNow').textContent=`الآية ${a.numberInSurah} من ${audioAyahs.length}`;
  $('audioProgress').textContent=`${audioIndex+1} / ${audioAyahs.length}`;
  pendingResume=resume||0;
  $('quranAudio').src=a.audio; $('quranAudio').load();
  state.lastAudio={surah:+$('audioSurah').value,edition:$('audioEdition').value,ayah:a.numberInSurah,time:pendingResume};
  save(); updateResume();
}
async function showAudio(n,edition,resume=null){
  $('audioTitle').textContent='جاري تحميل التلاوة…';
  try{
    const d=await fetchSurah(n,edition);
    audioAyahs=d.ayahs||[];
    $('audioTitle').textContent=`سورة ${surahName(n)} · ${$('audioEdition').selectedOptions[0]?.textContent||''}`;
    let idx=0,time=0;
    if(resume&&resume.surah===n&&resume.edition===edition){
      idx=Math.max(0,audioAyahs.findIndex(a=>a.numberInSurah===resume.ayah)); time=resume.time||0;
    }
    setAudioTrack(idx,time);
  }catch{$('audioTitle').textContent='تعذر تحميل التلاوة الآن.'}
}
$('loadAudio').onclick=()=>showAudio(+$('audioSurah').value,$('audioEdition').value);
$('prevAudio').onclick=()=>setAudioTrack(audioIndex-1);
$('nextAudio').onclick=()=>setAudioTrack(audioIndex+1);
$('quranAudio').onloadedmetadata=()=>{if(pendingResume&&pendingResume<$('quranAudio').duration){$('quranAudio').currentTime=pendingResume;pendingResume=0}};
$('quranAudio').onended=()=>{if(audioIndex<audioAyahs.length-1){setAudioTrack(audioIndex+1);$('quranAudio').play().catch(()=>{})}};
$('quranAudio').ontimeupdate=()=>{
  const now=Date.now();
  if(now-lastAudioSave<4000||!audioAyahs.length)return;
  lastAudioSave=now;
  const a=audioAyahs[audioIndex];
  state.lastAudio={surah:+$('audioSurah').value,edition:$('audioEdition').value,ayah:a.numberInSurah,time:$('quranAudio').currentTime||0};
  save(); updateResume();
};

/* ---------- Adhkar ---------- */
function dhikrState(){
  const d=new Date().toISOString().slice(0,10);
  state.dhikr=state.dhikr||{date:d,counts:{}};
  if(state.dhikr.date!==d)state.dhikr={date:d,counts:{}};
  return state.dhikr;
}
let dhikrMode='morning';
function renderAdhkar(){
  const list=dhikrMode==='morning'?MORNING:EVENING,d=dhikrState();
  $('adhkarList').innerHTML=list.map((x,i)=>{
    const k=dhikrMode+'-'+i,c=Math.min(x.count,d.counts[k]||0);
    return `<div class="dhikr-card"><h3>${x.title}</h3><p>${x.text}</p><div class="dhikr-foot"><small>${x.source} · التكرار: ${x.count}</small><button class="counter ${c>=x.count?'done':''}" data-count="${i}">${c} / ${x.count}</button></div></div>`;
  }).join('');
  document.querySelectorAll('[data-count]').forEach(b=>b.onclick=()=>{
    const i=+b.dataset.count,k=dhikrMode+'-'+i,x=list[i];
    d.counts[k]=Math.min(x.count,(d.counts[k]||0)+1); save(); renderAdhkar();
  });
}
document.querySelectorAll('[data-dhikr]').forEach(b=>b.onclick=()=>{
  dhikrMode=b.dataset.dhikr;
  document.querySelectorAll('[data-dhikr]').forEach(x=>x.classList.toggle('active',x===b));
  renderAdhkar();
});
$('resetAdhkar').onclick=()=>{state.dhikr={date:new Date().toISOString().slice(0,10),counts:{}};save();renderAdhkar()};

/* ---------- Duas ---------- */
function renderDuas(q=''){
  q=q.trim();
  const items=DUAS.filter(x=>!q||x.text.includes(q)||x.source.includes(q)||x.cat.includes(q));
  $('duaList').innerHTML=items.map(x=>`<div class="dhikr-card"><p>${x.text}</p><span class="source-badge">${x.cat} · ${x.source}</span></div>`).join('')||'<div class="empty">لا توجد نتائج.</div>';
}
$('duaSearch').oninput=e=>renderDuas(e.target.value);
$('clearDua').onclick=()=>{$('duaSearch').value='';renderDuas()};

/* ---------- Bookmarks ---------- */
function renderMarks(){
  const rows=[];
  if(state.lastRead?.page)rows.push({icon:'📖',title:'آخر قراءة',text:`صفحة ${state.lastRead.page} · سورة ${surahName(state.lastRead.surah||pageApproxSurah(state.lastRead.page))}`,go:'page',page:state.lastRead.page});
  if(state.lastTafsir)rows.push({icon:'📚',title:'آخر تفسير',text:`سورة ${surahName(state.lastTafsir.surah)} · آية ${state.lastTafsir.ayah}`,go:'tafsir'});
  if(state.lastAudio)rows.push({icon:'🎧',title:'آخر استماع',text:`سورة ${surahName(state.lastAudio.surah)} · آية ${state.lastAudio.ayah}`,go:'audio'});
  state.pageMarks.forEach(page=>rows.push({icon:'🔖',title:'علامة مصحف',text:`صفحة ${page} · سورة ${surahName(pageApproxSurah(page))}`,go:'page',page}));
  state.marks.filter(m=>m.type==='tafsir').forEach(m=>rows.push({icon:'🔖',title:'علامة تفسير',text:`سورة ${surahName(m.surah)} · آية ${m.ayah}`,go:'markTafsir',mark:m}));
  $('marksView').innerHTML=rows.length?rows.map((r,i)=>`<div class="jn-card bookmark-card"><span class="bookmark-icon">${r.icon}</span><div><h3>${r.title}</h3><p>${r.text}</p></div><button class="jn-btn secondary" data-go-mark="${i}">فتح</button></div>`).join(''):'<div class="jn-card empty">لا توجد علامات بعد.</div>';
  document.querySelectorAll('[data-go-mark]').forEach(b=>b.onclick=()=>goBookmark(rows[+b.dataset.goMark]));
}
function goBookmark(r){
  if(r.go==='page'){
    setTab('quran'); showPage(r.page);
  }else if(r.go==='tafsir'||r.go==='markTafsir'){
    const x=r.mark||state.lastTafsir;
    $('tafsirSurah').value=x.surah;
    $('tafsirEdition').value=x.extra||x.edition||'ar.jalalayn';
    setTab('tafsir'); showTafsir(x.surah,$('tafsirEdition').value,x.ayah);
  }else if(r.go==='audio'){
    const x=state.lastAudio;
    $('audioSurah').value=x.surah; $('audioEdition').value=x.edition;
    setTab('audio'); showAudio(x.surah,x.edition,x);
  }
}
$('resumeRead').onclick=()=>{
  setTab('quran');
  const page=state.lastRead?.page || SURAH_PAGE_FALLBACK[(state.lastRead?.surah||1)-1] || 1;
  showPage(page);
};
$('resumeTafsir').onclick=()=>state.lastTafsir?goBookmark({go:'tafsir'}):setTab('tafsir');
$('resumeAudio').onclick=()=>state.lastAudio?goBookmark({go:'audio'}):setTab('audio');

/* ---------- Init ---------- */
fillSurahs();
updateResume();
renderAdhkar();
renderDuas();
renderMarks();
loadReciters();
if(state.lastTafsir)$('tafsirSurah').value=state.lastTafsir.surah;
if(state.lastAudio)$('audioSurah').value=state.lastAudio.surah;
const startPage=state.lastRead?.page || SURAH_PAGE_FALLBACK[(state.lastRead?.surah||1)-1] || 1;
$('quranSurah').value=state.lastRead?.surah||pageApproxSurah(startPage);
showPage(startPage,{savePosition:false});
