
const KEY='almaabad_jamiyati_v1';
const money=new Intl.NumberFormat('ar-JO',{maximumFractionDigits:2});
const monthFmt=new Intl.DateTimeFormat('ar-JO',{month:'long',year:'numeric'});
let items=load(),expanded=null;
function load(){try{return JSON.parse(localStorage.getItem(KEY))||[]}catch{return[]}}
function save(){localStorage.setItem(KEY,JSON.stringify(items))}
function thisMonth(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
function monthAt(start,n){const [y,m]=start.split('-').map(Number),d=new Date(y,m-1+n,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
function pretty(v){const [y,m]=v.split('-').map(Number);return monthFmt.format(new Date(y,m-1,1))}
function statusOf(x){const now=thisMonth(),end=monthAt(x.startMonth,x.duration-1);return now<x.startMonth?['قريباً','upcoming']:now>end?['منتهية','ended']:['فعّالة','active']}
function esc(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function render(){
 document.getElementById('monthPill').textContent=pretty(thisMonth());
 const active=items.filter(x=>statusOf(x)[1]==='active'), now=thisMonth();
 const due=active.filter(x=>!x.paid.includes(now)).reduce((a,x)=>a+x.monthly,0);
 const paid=active.filter(x=>x.paid.includes(now)).reduce((a,x)=>a+x.monthly,0);
 dueEl.textContent=`${money.format(due)} د.أ`; activeCount.textContent=active.length; paidNow.textContent=`${money.format(paid)} د.أ`; countBadge.textContent=`${items.length} جمعية`;
 const c=document.getElementById('content');
 if(!items.length){c.innerHTML=`<div class="empty-state"><div class="empty-icon">✓</div><h3>لسه ما أضفت أي جمعية</h3><p>أضف أول جمعية، وإحنا بنرتّبلك كل شهر وموعد استلامك.</p><button class="primary-button" id="emptyAdd">أضف أول جمعية</button></div>`;document.getElementById('emptyAdd').onclick=openModal;return}
 c.innerHTML=`<div class="association-grid">${items.map(x=>card(x)).join('')}</div>`;
 c.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>remove(b.dataset.del));
 c.querySelectorAll('[data-toggle]').forEach(b=>b.onclick=()=>{expanded=expanded===b.dataset.toggle?null:b.dataset.toggle;render()});
 c.querySelectorAll('[data-paid]').forEach(cb=>cb.onchange=()=>togglePaid(cb.dataset.id,cb.dataset.month));
}
function card(x){
 const months=Array.from({length:x.duration},(_,i)=>monthAt(x.startMonth,i)),end=months.at(-1),receive=monthAt(x.startMonth,x.turn-1),st=statusOf(x),paidCount=x.paid.filter(m=>months.includes(m)).length,open=expanded===x.id;
 return `<article class="association-card"><div class="card-main"><div class="card-title-row"><div class="association-symbol">${esc(x.name.charAt(0))}</div><div class="card-title"><div><h3>${esc(x.name)}</h3><span class="status ${st[1]}">${st[0]}</span></div><p>${pretty(x.startMonth)} — ${pretty(end)}</p></div><button class="delete-button" data-del="${x.id}">حذف</button></div>
 <div class="money-row"><div><span>الدفعة الشهرية</span><strong>${money.format(x.monthly)} <small>د.أ</small></strong></div><div><span>قيمة الجمعية</span><strong>${money.format(x.total)} <small>د.أ</small></strong></div></div>
 <div class="receive-banner"><span class="receive-dot"></span><div><small>موعد استلامك · الدور ${x.turn}</small><strong>${pretty(receive)}</strong></div></div>
 <div class="progress-block"><div class="progress-label"><span>الدفعات المكتملة</span><b>${paidCount} من ${x.duration}</b></div><div class="progress-track"><span style="width:${(paidCount/x.duration)*100}%"></span></div></div>
 <button class="months-toggle" data-toggle="${x.id}">${open?'إخفاء جدول الشهور':'عرض جدول الشهور'}<span>${open?'⌃':'⌄'}</span></button></div>
 ${open?`<div class="months-list">${months.map((m,i)=>monthRow(x,m,i)).join('')}</div>`:''}</article>`
}
function monthRow(x,m,i){const paid=x.paid.includes(m),turn=i+1===x.turn,current=m===thisMonth();return `<label class="month-row ${paid?'paid':''} ${turn?'turn':''}"><input type="checkbox" ${paid?'checked':''} data-paid data-id="${x.id}" data-month="${m}"><span class="checkmark">✓</span><div class="month-name"><strong>${pretty(m)}</strong><small>${turn?'موعد استلامك':current?'هذا الشهر':`الدفعة ${i+1}`}</small></div><b>${money.format(x.monthly)} د.أ</b></label>`}
function togglePaid(id,m){items=items.map(x=>x.id!==id?x:{...x,paid:x.paid.includes(m)?x.paid.filter(v=>v!==m):[...x.paid,m]});save();render()}
function remove(id){const x=items.find(v=>v.id===id);if(!x||!confirm(`متأكد إنك بدك تحذف جمعية «${x.name}»؟`))return;items=items.filter(v=>v.id!==id);save();render()}
const modal=document.getElementById('modal'),dueEl=document.getElementById('due'),activeCount=document.getElementById('activeCount'),paidNow=document.getElementById('paidNow'),countBadge=document.getElementById('countBadge');
function openModal(){modal.hidden=false;fStart.value=thisMonth();updatePreview();setTimeout(()=>fName.focus(),50)}
function closeModal(){modal.hidden=true;document.getElementById('form').reset();fDuration.value=12;fTurn.value=1;fStart.value=thisMonth();updatePreview()}
function updatePreview(){const d=Number(fDuration.value)||1,t=Math.min(d,Math.max(1,Number(fTurn.value)||1));preview.textContent=fStart.value?pretty(monthAt(fStart.value,t-1)):'—'}
document.getElementById('addBtn').onclick=openModal;document.getElementById('closeBtn').onclick=closeModal;modal.onclick=e=>{if(e.target===modal)closeModal()};
['fStart','fDuration','fTurn'].forEach(id=>document.getElementById(id).oninput=updatePreview);
document.getElementById('form').onsubmit=e=>{e.preventDefault();const duration=Math.max(1,Number(fDuration.value)),monthly=Math.max(0,Number(fMonthly.value)),turn=Math.min(duration,Math.max(1,Number(fTurn.value))),total=fTotal.value?Math.max(0,Number(fTotal.value)):monthly*duration;if(!fName.value.trim()||!fStart.value||monthly<=0)return;const x={id:crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`,name:fName.value.trim(),startMonth:fStart.value,duration,turn,total,monthly,paid:[]};items=[x,...items];expanded=x.id;save();closeModal();render()};
render();
