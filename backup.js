
const C=ShiftiBackupCore;
const S=Shifti;
const $=id=>document.getElementById(id);
const PRE='shifti_preimport_backup_v17';
const LAST_KEYS='shifti_last_import_keys_v17';

function rawMap(){
  const m={};
  for(let i=0;i<localStorage.length;i++){
    const k=localStorage.key(i);
    m[k]=localStorage.getItem(k);
  }
  return m;
}
function filenameStamp(){
  const d=new Date(),p=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}`;
}
function download(name,text){
  if(S?.download)return S.download(name,text);
  const b=new Blob([text],{type:'application/json'}),a=document.createElement('a');
  a.href=URL.createObjectURL(b);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function currentRawForApp(app){
  let raw=localStorage.getItem(app.key);
  if(C.meaningfulRaw(raw))return {raw,key:app.key};
  const alias=(app.aliases||[]).find(k=>C.meaningfulRaw(localStorage.getItem(k)));
  return alias?{raw:localStorage.getItem(alias),key:alias}:{raw:null,key:null};
}
function renderStatus(){
  $('appsStatus').innerHTML=C.APPS.map(app=>{
    const x=currentRawForApp(app),on=C.meaningfulRaw(x.raw);
    const summary=on?C.appSummary(app.id,x.raw):'لا توجد بيانات محفوظة';
    return `<div class="app-status"><span class="status-dot ${on?'on':''}"></span><div class="app-copy"><strong>${app.label}</strong><span>${summary}${x.key&&x.key!==app.key?' · من نسخة قديمة':''}</span></div><button data-exp="${app.id}" ${on?'':'disabled'}>تصدير هذا القسم</button></div>`;
  }).join('');
  document.querySelectorAll('[data-exp]').forEach(b=>b.onclick=()=>exportApp(b.dataset.exp));
  $('undoImport').disabled=!localStorage.getItem(PRE);
}
function exportApp(id){
  const app=C.APP_BY_ID[id],x=currentRawForApp(app);
  if(!x.raw)return;
  const p=C.safeParse(x.raw);
  const text=p.ok?JSON.stringify(p.value,null,2):x.raw;
  download(`shifti-${id}-${filenameStamp()}.json`,text);
  S.toast(`تم تصدير ${app.label}`);
}
function exportFull(){
  const full=C.buildFullBackup(rawMap(),new Date().toISOString());
  download(`Shifti-full-backup-${filenameStamp()}.json`,JSON.stringify(full,null,2));
  S.toast('تم تصدير نسخة Shifti كاملة');
}
function saveSafety(touchedKeys){
  const before={};
  [...new Set(touchedKeys)].forEach(k=>{
    before[k]={present:localStorage.getItem(k)!==null,raw:localStorage.getItem(k)};
  });
  localStorage.setItem(PRE,JSON.stringify({at:new Date().toISOString(),before}));
  localStorage.setItem(LAST_KEYS,JSON.stringify([...new Set(touchedKeys)]));
}
function applyWrites(writes){
  if(!writes.length)return;
  saveSafety(writes.map(w=>w.key));
  writes.forEach(w=>localStorage.setItem(w.key,w.raw));
}
function reportRows(container,reports,extra=[]){
  const rows=[...(reports||[]),...extra];
  container.classList.add('show');
  container.innerHTML=rows.map(r=>`<div class="report-row ${r.ok===false?'bad':r.status==='none'?'warn':'ok'}"><strong>${r.file||r.label||''}</strong>${r.message?`<br>${r.message}`:''}${r.apps?.length?`<br>${r.apps.join(' · ')}`:''}</div>`).join('');
}
async function importFiles(fileList){
  const files=[...fileList||[]];
  if(!files.length)return;
  const prepared=[];
  for(const f of files){
    try{prepared.push({name:f.name,value:await f.text()})}
    catch{prepared.push({name:f.name,value:'__INVALID__'})}
  }
  const plan=C.planFiles(prepared);
  if(!plan.writes.length){
    reportRows($('importReport'),plan.reports);
    S.toast('لم يتم استيراد أي ملف');
    return;
  }
  const apps=[...new Set(plan.writes.map(w=>w.label))];
  const ok=confirm(`سيتم استيراد البيانات التالية:\n\n${apps.join('\n')}\n\nسيتم حفظ نسخة أمان تلقائية قبل الاستيراد. هل تريد المتابعة؟`);
  if(!ok)return;
  applyWrites(plan.writes);
  reportRows($('importReport'),plan.reports,[{ok:true,file:'النتيجة',message:`تم استيراد ${plan.writes.length} قسم بنجاح`}]);
  renderStatus();
  S.toast('تم استيراد البيانات بنجاح');
}
function scanLegacy(){
  const plan=C.legacyDevicePlan(rawMap());
  if(plan.writes.length){
    const ok=confirm(`وجد Shifti ${plan.writes.length} قسم قديم يمكن نقله. سيتم حفظ نسخة أمان أولاً. هل تريد النقل؟`);
    if(ok){
      applyWrites(plan.writes);
      reportRows($('legacyReport'),plan.reports.map(r=>({label:r.label,status:r.status,message:r.status==='migrate'?'تم النقل بنجاح':r.message})));
      renderStatus();
      S.toast('تم نقل البيانات القديمة');
      return;
    }
  }
  reportRows($('legacyReport'),plan.reports.map(r=>({label:r.label,status:r.status,message:r.message})));
  if(!plan.writes.length)S.toast('تم الفحص');
}
function undoLast(){
  const raw=localStorage.getItem(PRE);
  if(!raw){S.toast('لا توجد عملية استيراد للتراجع عنها');return}
  let snap;
  try{snap=JSON.parse(raw)}catch{S.toast('نسخة التراجع غير صالحة');return}
  if(!confirm('سيتم إرجاع البيانات إلى حالتها قبل آخر استيراد. هل تريد المتابعة؟'))return;
  Object.entries(snap.before||{}).forEach(([k,x])=>{
    if(x.present)localStorage.setItem(k,x.raw);
    else localStorage.removeItem(k);
  });
  localStorage.removeItem(PRE);
  localStorage.removeItem(LAST_KEYS);
  $('undoReport').classList.add('show');
  $('undoReport').innerHTML='<div class="report-row ok"><strong>تم التراجع</strong><br>رجعت البيانات إلى حالتها قبل آخر استيراد.</div>';
  renderStatus();
  S.toast('تم التراجع عن آخر استيراد');
}

$('exportFull').onclick=exportFull;
$('importFiles').onchange=e=>{importFiles(e.target.files);e.target.value=''};
$('importFilesTop').onchange=e=>{importFiles(e.target.files);e.target.value=''};
$('scanLegacy').onclick=scanLegacy;
$('undoImport').onclick=undoLast;
$('refreshStatus').onclick=()=>{renderStatus();S.toast('تم تحديث الحالة')};
renderStatus();
