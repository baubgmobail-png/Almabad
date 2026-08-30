
const STORAGE_KEY="almaabad_jamiyati_v1";
const money=new Intl.NumberFormat("ar-JO",{maximumFractionDigits:2});
const monthLabel=new Intl.DateTimeFormat("ar-JO",{month:"long",year:"numeric"});
let items=[], expanded=null;

function thisMonth(){const n=new Date();return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}`}
function monthAt(start,offset){const [y,m]=start.split("-").map(Number);const d=new Date(y,m-1+offset,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`}
function prettyMonth(v){const [y,m]=v.split("-").map(Number);return monthLabel.format(new Date(y,m-1,1))}
function statusOf(x){const now=thisMonth(),end=monthAt(x.startMonth,x.duration-1);if(now<x.startMonth)return{label:"قريباً",kind:"upcoming"};if(now>end)return{label:"منتهية",kind:"ended"};return{label:"فعّالة",kind:"active"}}
function esc(v=""){return String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function load(){try{items=JSON.parse(localStorage.getItem(STORAGE_KEY))||[]}catch{items=[]}}
function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(items))}
function stats(){const c=thisMonth(),a=items.filter(x=>statusOf(x).kind==="active");return{active:a.length,due:a.filter(x=>!x.paid.includes(c)).reduce((s,x)=>s+x.monthly,0),paid:a.filter(x=>x.paid.includes(c)).reduce((s,x)=>s+x.monthly,0)}}

function render(){
  const s=stats();
  monthPill.textContent=prettyMonth(thisMonth());
  due.textContent=money.format(s.due);activeCount.textContent=s.active;paidNow.textContent=`${money.format(s.paid)} د.أ`;
  countBadge.hidden=items.length===0;countBadge.textContent=`${items.length} جمعية`;
  if(!items.length){
    content.innerHTML=`<div class="empty-state"><div class="empty-icon">✓</div><h3>لسه ما أضفت أي جمعية</h3><p>أضف أول جمعية، وإحنا بنرتّبلك كل شهر وموعد استلامك.</p><button class="primary-button" id="emptyAdd">أضف أول جمعية</button></div>`;
    emptyAdd.onclick=openForm;return;
  }
  content.innerHTML=`<div class="association-grid">${items.map(card).join("")}</div>`;
  content.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>removeItem(b.dataset.del));
  content.querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>{expanded=expanded===b.dataset.open?null:b.dataset.open;render()});
  content.querySelectorAll("[data-paid]").forEach(c=>c.onchange=()=>togglePaid(c.dataset.id,c.dataset.month));
}
function card(x){
 const months=Array.from({length:x.duration},(_,i)=>monthAt(x.startMonth,i));
 const end=months.at(-1)||x.startMonth,receive=monthAt(x.startMonth,x.turn-1),st=statusOf(x);
 const paidCount=x.paid.filter(m=>months.includes(m)).length,isOpen=expanded===x.id;
 return `<article class="association-card ${isOpen?"open":""}">
 <div class="card-main">
  <div class="card-title-row"><div class="association-symbol">${esc(x.name.charAt(0))}</div><div class="card-title"><div><h3>${esc(x.name)}</h3><span class="status ${st.kind}">${st.label}</span></div><p>${prettyMonth(x.startMonth)} — ${prettyMonth(end)}</p></div><button class="delete-button" data-del="${x.id}">حذف</button></div>
  <div class="money-row"><div><span>الدفعة الشهرية</span><strong>${money.format(x.monthly)} <small>د.أ</small></strong></div><div><span>قيمة الجمعية</span><strong>${money.format(x.total)} <small>د.أ</small></strong></div></div>
  <div class="receive-banner"><span class="receive-dot"></span><div><small>موعد استلامك · الدور ${x.turn}</small><strong>${prettyMonth(receive)}</strong></div></div>
  <div class="progress-block"><div class="progress-label"><span>الدفعات المكتملة</span><b>${paidCount} من ${x.duration}</b></div><div class="progress-track"><span style="width:${(paidCount/x.duration)*100}%"></span></div></div>
  <button class="months-toggle" data-open="${x.id}" aria-expanded="${isOpen}">${isOpen?"إخفاء جدول الشهور":"عرض جدول الشهور"}<span>${isOpen?"⌃":"⌄"}</span></button>
 </div>
 ${isOpen?`<div class="months-list">${months.map((m,i)=>monthRow(x,m,i)).join("")}</div>`:""}
 </article>`
}
function monthRow(x,m,i){const p=x.paid.includes(m),t=i+1===x.turn,c=m===thisMonth();return `<label class="month-row ${p?"paid":""} ${t?"turn":""}"><input type="checkbox" ${p?"checked":""} data-paid data-id="${x.id}" data-month="${m}"><span class="checkmark">✓</span><div class="month-name"><strong>${prettyMonth(m)}</strong><small>${t?"موعد استلامك":c?"هذا الشهر":`الدفعة ${i+1}`}</small></div><b>${money.format(x.monthly)} د.أ</b></label>`}
function togglePaid(id,m){items=items.map(x=>x.id!==id?x:{...x,paid:x.paid.includes(m)?x.paid.filter(v=>v!==m):[...x.paid,m]});save();render()}
function removeItem(id){const x=items.find(v=>v.id===id);if(!x||!confirm(`متأكد إنك بدك تحذف جمعية «${x.name}»؟`))return;items=items.filter(v=>v.id!==id);if(expanded===id)expanded=null;save();render()}

const modal=document.getElementById("modal");
function freshForm(){fName.value="";fStart.value=thisMonth();fDuration.value="12";fTurn.value="1";fTotal.value="";fMonthly.value="";updatePreview()}
function openForm(){freshForm();modal.hidden=false;setTimeout(()=>fName.focus(),20)}
function closeForm(){modal.hidden=true}
function updatePreview(){const d=Math.max(1,Number(fDuration.value)||1),t=Math.min(d,Math.max(1,Number(fTurn.value)||1));preview.textContent=fStart.value?prettyMonth(monthAt(fStart.value,t-1)):"—"}
addBtn.onclick=openForm;closeBtn.onclick=closeForm;modal.onmousedown=e=>{if(e.target===modal)closeForm()};
[fStart,fDuration,fTurn].forEach(e=>e.oninput=updatePreview);
form.onsubmit=e=>{e.preventDefault();const duration=Math.max(1,Number(fDuration.value)),monthly=Math.max(0,Number(fMonthly.value)),turn=Math.min(duration,Math.max(1,Number(fTurn.value))),total=fTotal.value?Math.max(0,Number(fTotal.value)):monthly*duration;if(!fName.value.trim()||!fStart.value||monthly<=0)return;const item={id:crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`,name:fName.value.trim(),startMonth:fStart.value,duration,turn,total,monthly,paid:[]};items=[item,...items];expanded=item.id;save();closeForm();render()};
load();render();
