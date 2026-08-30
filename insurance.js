
const KEY='insurance_balance_app_v1';
const TYPES=['صيدلية','مختبر','أشعة'];
const TYPE_CLASS={'صيدلية':'pharmacy','مختبر':'lab','أشعة':'xray'};
const TYPE_ICON={'صيدلية':'💊','مختبر':'🧪','أشعة':'🩻'};

function isoToday(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function money(n){return `${(Number(n)||0).toFixed(3)} د.أ`}
function uid(){return Math.random().toString(36).slice(2)+Date.now().toString(36)}
function clone(x){return JSON.parse(JSON.stringify(x))}
function defaultState(){
  const y=new Date().getFullYear();
  return {activeYear:String(y),years:{[y]:{annualVisits:10,visits:[],transactions:[],providers:[]}}};
}
function load(){try{const x=JSON.parse(localStorage.getItem(KEY));return x&&x.years?x:defaultState()}catch{return defaultState()}}
let state=load();
function save(){localStorage.setItem(KEY,JSON.stringify(state))}
function ydata(){return state.years[state.activeYear]}
function fmtDate(s){if(!s)return'';const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d).toLocaleDateString('ar-JO',{year:'numeric',month:'2-digit',day:'2-digit'})}
function toast(t){const el=document.getElementById('toast');el.textContent=t;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),1600)}
function esc(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}

function allTransactions(){
  const d=ydata();
  const auto=[];
  d.visits.forEach(v=>(v.allocations||[]).forEach(a=>auto.push({
    id:`visit:${v.id}:${a.id}`,kind:'credit',date:v.date,type:a.type,providerId:a.providerId,amount:Number(a.amount)||0,
    description:`رصد من زيارة${v.doctorName?' - '+v.doctorName:''}`,notes:v.notes||'',fromVisit:true,visitId:v.id
  })));
  return [...auto,...d.transactions].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
}
function providerById(id){return ydata().providers.find(p=>p.id===id)}
function providerName(id){return providerById(id)?.name||'مكان غير محدد'}
function totals(filter={}){
  let tx=allTransactions();
  if(filter.type)tx=tx.filter(x=>x.type===filter.type);
  if(filter.providerId)tx=tx.filter(x=>x.providerId===filter.providerId);
  const credited=tx.filter(x=>x.kind==='credit').reduce((a,x)=>a+(Number(x.amount)||0),0);
  const used=tx.filter(x=>x.kind==='use').reduce((a,x)=>a+(Number(x.amount)||0),0);
  return {credited,used,remaining:credited-used};
}
function usedVisits(){return ydata().visits.length}
function remainingVisits(){return Math.max((Number(ydata().annualVisits)||0)-usedVisits(),0)}

function refreshYearSelect(){
  const sel=document.getElementById('yearSelect');
  const years=Object.keys(state.years).sort((a,b)=>b-a);
  sel.innerHTML=years.map(y=>`<option value="${y}" ${y===state.activeYear?'selected':''}>${y}</option>`).join('');
}
function renderHome(){
  const d=ydata(), allowed=Number(d.annualVisits)||0, used=usedVisits(), rem=Math.max(allowed-used,0), pct=allowed?Math.min(used/allowed*100,100):0;
  document.getElementById('visitsRemaining').textContent=rem;
  document.getElementById('visitsText').textContent=`استخدمت ${used} من أصل ${allowed} زيارة`;
  document.getElementById('visitRingText').textContent=`${Math.round(pct)}%`;
  document.getElementById('visitRing').style.background=`conic-gradient(#fff ${pct}%,rgba(255,255,255,.22) ${pct}% 100%)`;
  const t=totals();
  document.getElementById('totalCredited').textContent=money(t.credited);
  document.getElementById('totalUsed').textContent=money(t.used);
  document.getElementById('totalRemaining').textContent=money(t.remaining);
  document.getElementById('categoryCards').innerHTML=TYPES.map(type=>{
    const x=totals({type});
    return `<div class="category-card">
      <div class="icon">${TYPE_ICON[type]}</div><h3>${type}</h3>
      <div class="line"><span>مرصود</span><strong>${money(x.credited)}</strong></div>
      <div class="line"><span>مسحوب</span><strong>${money(x.used)}</strong></div>
      <div class="line"><span>متبقي</span><strong>${money(x.remaining)}</strong></div>
    </div>`;
  }).join('');
  renderRecent();
}
function txCard(x){
  const p=providerName(x.providerId), sign=x.kind==='credit'?'+':'−';
  return `<button class="tx-card ${x.kind}" data-txid="${x.fromVisit?'':x.id}" data-visitid="${x.fromVisit?x.visitId:''}">
    <div class="tx-top">
      <div>
        <div class="tx-title">${x.kind==='credit'?'رصد':'سحب'} — ${esc(x.type)}</div>
        <div class="tx-sub">${fmtDate(x.date)} • ${esc(p)}${x.description?' • '+esc(x.description):''}</div>
      </div>
      <div class="amount ${x.kind==='credit'?'plus':'minus'}">${sign}${money(x.amount)}</div>
    </div>
    <div class="pills"><span class="pill ${TYPE_CLASS[x.type]}">${esc(x.type)}</span>${x.fromVisit?'<span class="pill">من زيارة</span>':''}</div>
  </button>`;
}
function renderRecent(){
  const tx=allTransactions().slice(0,6);
  document.getElementById('recentTransactions').innerHTML=tx.length?tx.map(txCard).join(''):'<div class="empty">لا توجد عمليات بعد.</div>';
  bindTxCards(document.getElementById('recentTransactions'));
}
function renderVisits(){
  const d=ydata(), allowed=Number(d.annualVisits)||0, used=usedVisits();
  document.getElementById('visitBanner').textContent=`استخدمت ${used} من أصل ${allowed} زيارة — المتبقي ${Math.max(allowed-used,0)} زيارة.`;
  const visits=[...d.visits].sort((a,b)=>b.date.localeCompare(a.date));
  document.getElementById('visitsList').innerHTML=visits.length?visits.map(v=>{
    const sum=(v.allocations||[]).reduce((a,x)=>a+(Number(x.amount)||0),0);
    return `<button class="visit-card" data-visit="${v.id}">
      <div class="visit-top">
        <div><div class="visit-title">${fmtDate(v.date)}${v.doctorName?' — '+esc(v.doctorName):''}</div>
        <div class="visit-sub">${(v.allocations||[]).length} رصيد/أرصدة${v.notes?' • '+esc(v.notes):''}</div></div>
        <div class="amount plus">${money(sum)}</div>
      </div>
      <div class="pills">${(v.allocations||[]).map(a=>`<span class="pill ${TYPE_CLASS[a.type]}">${esc(a.type)} • ${esc(providerName(a.providerId))} • ${money(a.amount)}</span>`).join('')}</div>
    </button>`;
  }).join(''):'<div class="empty">لا توجد زيارات مسجلة لهذه السنة.</div>';
  document.querySelectorAll('[data-visit]').forEach(b=>b.addEventListener('click',()=>openVisit(b.dataset.visit)));
}
let txFilter='all';
function renderTransactions(){
  const type=document.getElementById('typeFilter').value, provider=document.getElementById('providerFilter').value;
  let tx=allTransactions();
  if(txFilter!=='all')tx=tx.filter(x=>x.kind===txFilter);
  if(type)tx=tx.filter(x=>x.type===type);
  if(provider)tx=tx.filter(x=>x.providerId===provider);
  document.getElementById('transactionsList').innerHTML=tx.length?tx.map(txCard).join(''):'<div class="empty">لا توجد حركات مطابقة.</div>';
  bindTxCards(document.getElementById('transactionsList'));
}
function bindTxCards(root){
  root.querySelectorAll('.tx-card').forEach(b=>b.addEventListener('click',()=>{
    if(b.dataset.visitid)openVisit(b.dataset.visitid);
    else if(b.dataset.txid)openTx(b.dataset.txid);
  }));
}
function renderProviders(){
  const ps=[...ydata().providers].sort((a,b)=>a.type.localeCompare(b.type,'ar')||a.name.localeCompare(b.name,'ar'));
  document.getElementById('providersList').innerHTML=ps.length?ps.map(p=>{
    const t=totals({providerId:p.id});
    return `<button class="provider-card" data-provider="${p.id}">
      <div class="provider-top">
        <div><div class="provider-title">${esc(p.name)}</div><div class="provider-sub">${esc(p.type)}${p.notes?' • '+esc(p.notes):''}</div></div>
        <span class="pill ${TYPE_CLASS[p.type]}">${esc(p.type)}</span>
      </div>
      <div class="provider-balances">
        <div class="mini-metric"><span>مرصود</span><strong>${money(t.credited)}</strong></div>
        <div class="mini-metric"><span>مسحوب</span><strong>${money(t.used)}</strong></div>
        <div class="mini-metric"><span>متبقي</span><strong>${money(t.remaining)}</strong></div>
      </div>
    </button>`;
  }).join(''):'<div class="empty">أضف صيدلية أو مختبر أو مركز أشعة.</div>';
  document.querySelectorAll('[data-provider]').forEach(b=>b.addEventListener('click',()=>openProvider(b.dataset.provider)));
  fillProviderFilters();
}
function renderSettings(){
  document.getElementById('settingsYear').value=state.activeYear;
  document.getElementById('annualVisits').value=ydata().annualVisits;
  document.getElementById('newYear').value=String(Number(state.activeYear)+1);
}
function refreshAll(){refreshYearSelect();renderHome();renderVisits();renderProviders();renderTransactions();renderSettings()}

function fillProviderFilters(){
  const ps=ydata().providers;
  document.getElementById('providerFilter').innerHTML='<option value="">كل الأماكن</option>'+ps.map(p=>`<option value="${p.id}">${esc(p.name)} — ${p.type}</option>`).join('');
}
function providersOfType(type){return ydata().providers.filter(p=>p.type===type)}
function providerOptions(type,selected=''){
  const ps=providersOfType(type);
  return ps.map(p=>`<option value="${p.id}" ${p.id===selected?'selected':''}>${esc(p.name)}</option>`).join('');
}

let editingVisitId=null, allocationDraft=[];
function openVisit(id=null){
  const d=ydata(); editingVisitId=id;
  const v=id?clone(d.visits.find(x=>x.id===id)):{id:uid(),date:isoToday(),doctorName:'',notes:'',allocations:[]};
  document.getElementById('visitModalTitle').textContent=id?'تعديل الزيارة':'إضافة زيارة';
  document.getElementById('visitDate').value=v.date;
  document.getElementById('doctorName').value=v.doctorName||'';
  document.getElementById('visitNotes').value=v.notes||'';
  allocationDraft=clone(v.allocations||[]);
  document.getElementById('deleteVisitBtn').hidden=!id;
  renderAllocationDraft();
  openModal('visitModal');
}
function renderAllocationDraft(){
  const box=document.getElementById('allocationsBox');
  box.innerHTML=allocationDraft.length?allocationDraft.map((a,i)=>`
    <div class="allocation-row" data-ai="${i}">
      <div class="allocation-grid">
        <label>النوع<select data-af="type">${TYPES.map(t=>`<option ${t===a.type?'selected':''}>${t}</option>`).join('')}</select></label>
        <label>المكان<select data-af="providerId">${providerOptions(a.type,a.providerId)}<option value="__new__">+ مكان جديد</option></select></label>
        <label class="amount-field">القيمة<input type="number" min="0" step="0.001" data-af="amount" value="${a.amount||''}"></label>
        <button class="remove-row" data-removealloc="${i}">×</button>
      </div>
    </div>`).join(''):'<div class="empty">اختياري: أضف رصيد صيدلية أو مختبر أو أشعة من هذه الزيارة.</div>';
  box.querySelectorAll('[data-af]').forEach(el=>el.addEventListener('change',e=>{
    const i=+e.target.closest('.allocation-row').dataset.ai, f=e.target.dataset.af;
    if(f==='type'){
      allocationDraft[i].type=e.target.value;
      const ps=providersOfType(e.target.value);
      allocationDraft[i].providerId=ps[0]?.id||'';
      renderAllocationDraft();
    }else if(f==='providerId' && e.target.value==='__new__'){
      openProvider(null, allocationDraft[i].type, (newId)=>{allocationDraft[i].providerId=newId;renderAllocationDraft()});
    }else{
      allocationDraft[i][f]=f==='amount'?Number(e.target.value):e.target.value;
    }
  }));
  box.querySelectorAll('[data-removealloc]').forEach(b=>b.addEventListener('click',()=>{allocationDraft.splice(+b.dataset.removealloc,1);renderAllocationDraft()}));
}
document.getElementById('addAllocationBtn').addEventListener('click',()=>{
  const type='صيدلية', ps=providersOfType(type);
  if(!ps.length){openProvider(null,type,(newId)=>{allocationDraft.push({id:uid(),type,providerId:newId,amount:0});renderAllocationDraft()});return}
  allocationDraft.push({id:uid(),type,providerId:ps[0].id,amount:0});renderAllocationDraft();
});
document.getElementById('saveVisitBtn').addEventListener('click',()=>{
  const d=ydata();
  if(!editingVisitId && usedVisits()>=Number(d.annualVisits||0)){alert('وصلت للحد السنوي من الزيارات. إذا عندك زيارات أكثر عدّل العدد من الإعدادات.');return}
  const v={id:editingVisitId||uid(),date:document.getElementById('visitDate').value,doctorName:document.getElementById('doctorName').value.trim(),notes:document.getElementById('visitNotes').value.trim(),
    allocations:allocationDraft.filter(a=>a.type&&a.providerId&&Number(a.amount)>0).map(a=>({...a,amount:Number(a.amount)}))};
  if(!v.date){alert('أدخل تاريخ الزيارة.');return}
  if(editingVisitId){const i=d.visits.findIndex(x=>x.id===editingVisitId);d.visits[i]=v}else d.visits.push(v);
  save();closeModal('visitModal');refreshAll();toast('تم حفظ الزيارة');
});
document.getElementById('deleteVisitBtn').addEventListener('click',()=>{
  if(editingVisitId&&confirm('حذف الزيارة وكل الأرصدة المرتبطة بها؟')){ydata().visits=ydata().visits.filter(x=>x.id!==editingVisitId);save();closeModal('visitModal');refreshAll();toast('تم حذف الزيارة')}
});

let editingTxId=null;
function openTx(id=null,kind='use'){
  editingTxId=id; const d=ydata();
  const tx=id?clone(d.transactions.find(x=>x.id===id)):{id:uid(),kind,date:isoToday(),type:'صيدلية',providerId:'',amount:0,description:'',notes:''};
  document.getElementById('transactionModalTitle').textContent=id?'تعديل الحركة':(kind==='credit'?'إضافة رصد':'إضافة سحب');
  document.getElementById('txKind').value=tx.kind;document.getElementById('txDate').value=tx.date;document.getElementById('txType').value=tx.type;
  fillTxProviders(tx.type,tx.providerId);document.getElementById('txAmount').value=tx.amount||'';document.getElementById('txDescription').value=tx.description||'';document.getElementById('txNotes').value=tx.notes||'';
  document.getElementById('deleteTxBtn').hidden=!id;updateTxHint();openModal('transactionModal');
}
function fillTxProviders(type,selected=''){
  const sel=document.getElementById('txProvider'), ps=providersOfType(type);
  sel.innerHTML=ps.map(p=>`<option value="${p.id}" ${p.id===selected?'selected':''}>${esc(p.name)}</option>`).join('')+'<option value="__new__">+ مكان جديد</option>';
  if(!selected&&ps[0])sel.value=ps[0].id;
}
function updateTxHint(){
  const pid=document.getElementById('txProvider').value,type=document.getElementById('txType').value;
  if(!pid||pid==='__new__'){document.getElementById('txBalanceHint').textContent='اختر المكان لعرض الرصيد.';return}
  const t=totals({type,providerId:pid});
  document.getElementById('txBalanceHint').textContent=`رصيد ${providerName(pid)} الحالي: ${money(t.remaining)} — مرصود ${money(t.credited)} / مسحوب ${money(t.used)}`;
}
document.getElementById('txType').addEventListener('change',e=>{fillTxProviders(e.target.value);updateTxHint()});
document.getElementById('txProvider').addEventListener('change',e=>{
  if(e.target.value==='__new__'){openProvider(null,document.getElementById('txType').value,(newId)=>{fillTxProviders(document.getElementById('txType').value,newId);updateTxHint()})}
  else updateTxHint();
});
document.getElementById('txKind').addEventListener('change',updateTxHint);
document.getElementById('saveTxBtn').addEventListener('click',()=>{
  const d=ydata(), pid=document.getElementById('txProvider').value,kind=document.getElementById('txKind').value,type=document.getElementById('txType').value,amount=Number(document.getElementById('txAmount').value)||0;
  if(!pid||pid==='__new__'){alert('اختر المكان.');return} if(amount<=0){alert('أدخل قيمة أكبر من صفر.');return}
  if(kind==='use'){
    const current=totals({type,providerId:pid}).remaining;
    const old=editingTxId?Number(d.transactions.find(x=>x.id===editingTxId)?.amount||0):0;
    const adjusted=current+(editingTxId&&d.transactions.find(x=>x.id===editingTxId)?.kind==='use'?old:0);
    if(amount>adjusted&&!confirm(`المبلغ أكبر من الرصيد المتوفر (${money(adjusted)}). هل تريد الحفظ رغم ذلك؟`))return;
  }
  const tx={id:editingTxId||uid(),kind,date:document.getElementById('txDate').value,type,providerId:pid,amount,description:document.getElementById('txDescription').value.trim(),notes:document.getElementById('txNotes').value.trim()};
  if(editingTxId){const i=d.transactions.findIndex(x=>x.id===editingTxId);d.transactions[i]=tx}else d.transactions.push(tx);
  save();closeModal('transactionModal');refreshAll();toast('تم حفظ الحركة');
});
document.getElementById('deleteTxBtn').addEventListener('click',()=>{
  if(editingTxId&&confirm('حذف هذه الحركة؟')){ydata().transactions=ydata().transactions.filter(x=>x.id!==editingTxId);save();closeModal('transactionModal');refreshAll();toast('تم الحذف')}
});

let editingProviderId=null, providerCallback=null;
function openProvider(id=null,presetType='صيدلية',cb=null){
  editingProviderId=id;providerCallback=cb;const d=ydata();
  const p=id?clone(d.providers.find(x=>x.id===id)):{id:uid(),type:presetType,name:'',notes:''};
  document.getElementById('providerModalTitle').textContent=id?'تعديل المكان':'إضافة مكان';
  document.getElementById('providerType').value=p.type;document.getElementById('providerName').value=p.name;document.getElementById('providerNotes').value=p.notes||'';
  document.getElementById('deleteProviderBtn').hidden=!id;openModal('providerModal');
}
document.getElementById('saveProviderBtn').addEventListener('click',()=>{
  const d=ydata(),name=document.getElementById('providerName').value.trim();
  if(!name){alert('أدخل اسم المكان.');return}
  const p={id:editingProviderId||uid(),type:document.getElementById('providerType').value,name,notes:document.getElementById('providerNotes').value.trim()};
  if(editingProviderId){const i=d.providers.findIndex(x=>x.id===editingProviderId);d.providers[i]=p}else d.providers.push(p);
  save();closeModal('providerModal');const cb=providerCallback;providerCallback=null;refreshAll();toast('تم حفظ المكان');if(cb)cb(p.id);
});
document.getElementById('deleteProviderBtn').addEventListener('click',()=>{
  if(!editingProviderId)return;const linked=allTransactions().some(x=>x.providerId===editingProviderId);
  if(linked){alert('لا يمكن حذف هذا المكان لأن عليه حركات رصيد. تقدر تعدل اسمه بدل الحذف.');return}
  if(confirm('حذف المكان؟')){ydata().providers=ydata().providers.filter(x=>x.id!==editingProviderId);save();closeModal('providerModal');refreshAll();toast('تم حذف المكان')}
});

function openModal(id){document.getElementById(id).classList.add('open')}
function closeModal(id){document.getElementById(id).classList.remove('open')}
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>closeModal(b.dataset.close)));
document.querySelectorAll('.modal').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)closeModal(m.id)}));

document.getElementById('addVisitBtn').addEventListener('click',()=>openVisit());
document.getElementById('quickCreditBtn').addEventListener('click',()=>openTx(null,'credit'));
document.getElementById('quickUseBtn').addEventListener('click',()=>openTx(null,'use'));
document.getElementById('addProviderBtn').addEventListener('click',()=>openProvider());

document.querySelectorAll('.seg').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('.seg').forEach(x=>x.classList.remove('active'));b.classList.add('active');txFilter=b.dataset.filter;renderTransactions();
}));
document.getElementById('typeFilter').addEventListener('change',renderTransactions);
document.getElementById('providerFilter').addEventListener('change',renderTransactions);

document.getElementById('yearSelect').addEventListener('change',e=>{state.activeYear=e.target.value;save();refreshAll()});
document.getElementById('saveYearSettings').addEventListener('click',()=>{
  const old=state.activeYear, ny=String(document.getElementById('settingsYear').value), av=Number(document.getElementById('annualVisits').value)||0;
  if(ny!==old){
    if(state.years[ny]){alert('هذه السنة موجودة مسبقًا. اخترها من أعلى التطبيق.');return}
    state.years[ny]=state.years[old];delete state.years[old];state.activeYear=ny;
  }
  ydata().annualVisits=av;save();refreshAll();toast('تم حفظ إعدادات السنة');
});
document.getElementById('createYearBtn').addEventListener('click',()=>{
  const y=String(document.getElementById('newYear').value),v=Number(document.getElementById('newYearVisits').value)||0;
  if(!y){return}if(state.years[y]){alert('السنة موجودة مسبقًا.');return}
  state.years[y]={annualVisits:v,visits:[],transactions:[],providers:clone(ydata().providers).map(p=>({...p,id:uid()}))};
  state.activeYear=y;save();refreshAll();toast('تم إنشاء السنة الجديدة');
});

document.getElementById('exportBackup').addEventListener('click',()=>{
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download=`insurance-backup-${isoToday()}.json`;a.click();URL.revokeObjectURL(a.href);toast('تم تصدير النسخة الاحتياطية');
});
document.getElementById('importBackup').addEventListener('change',async e=>{
  const f=e.target.files[0];if(!f)return;
  try{const x=JSON.parse(await f.text());if(!x.years||!x.activeYear)throw 0;state=x;save();refreshAll();toast('تم استيراد النسخة')}
  catch{alert('الملف غير صالح.')}e.target.value='';
});
document.getElementById('resetAll').addEventListener('click',()=>{
  if(confirm('سيتم حذف كل بيانات التأمين من كل السنوات. هل أنت متأكد؟')){state=defaultState();save();refreshAll();toast('تم مسح البيانات')}
});

const titles={home:'الرئيسية',visits:'الزيارات',transactions:'الحركات',providers:'الأماكن',settings:'الإعدادات'};
function go(page){
  document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));document.getElementById('page-'+page).classList.add('active');
  document.querySelectorAll('.nav').forEach(x=>x.classList.toggle('active',x.dataset.page===page));document.getElementById('pageTitle').textContent=titles[page];
  if(page==='transactions')renderTransactions();if(page==='providers')renderProviders();if(page==='settings')renderSettings();scrollTo({top:0,behavior:'smooth'});
}
document.querySelectorAll('.nav').forEach(b=>b.addEventListener('click',()=>go(b.dataset.page)));
document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.go)));

if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js?v=9').catch(()=>{}));
refreshAll();
