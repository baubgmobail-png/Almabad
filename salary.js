
const STORAGE_KEY = 'jadwal_dawam_v2';

const DEFAULT_STATE = {
  version: 2,
  settings: {
    baseSalary: 0,
    socialSecurityBase: 0,
    socialSecurityRate: 0.075,
    savingsRate: 0,
    takaful: 0,
    dailyHours: 9.6,
    otWorkMultiplier: 1.25,
    otHolidayMultiplier: 1.5,
    salaryDivisorDays: 30,
    nightAllowance: 0,
    cycleStartShift: 'مسائي',
    cycleStartDate: '2026-07-02',
    weeklyOff1: 'الثلاثاء',
    weeklyOff2: 'الأربعاء',
    deductAbsence: false,
    deductShortage: false,
    sickBalance: 14,
    casualBalance: 0,
    transportAllowance: 0,
    otDivisorHours: 8,
    year: new Date().getFullYear(),
    shiftSystem: 'تناوب أسبوعي'
  },
  period: defaultPeriod(),
  shiftChanges: [],
  salaryIncreases: [],
  records: {}
};

const SHIFT_RULES = {
  'صباحي': {
    normalStart:'07:00', normalEnd:'17:30',
    otStart:'17:30', otEnd:'19:00',
    fullNormalHours:9.6, fullOtHours:2.4,
    normalIn:'07:00', normalOut:'17:30', extraIn:'07:00', extraOut:'19:00'
  },
  'مسائي': {
    normalStart:'21:30', normalEnd:'07:00',
    otStart:'19:00', otEnd:'21:30',
    fullNormalHours:9.6, fullOtHours:2.4,
    normalIn:'21:30', normalOut:'07:00', extraIn:'19:00', extraOut:'07:00'
  }
};
const WEEKDAYS = ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
const DAY_TYPES = ['دوام','عطلة أسبوعية','عطلة رسمية','إجازة مرضية','إجازة عرضية','غياب'];

function defaultPeriod(){
  const now=new Date(), y=now.getFullYear(), m=now.getMonth();
  const from=toISODate(new Date(y,m,1));
  const to=toISODate(new Date(y,m+1,0));
  return {from,to};
}

function deepClone(x){ return JSON.parse(JSON.stringify(x)); }
function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return deepClone(DEFAULT_STATE);
    const s = JSON.parse(raw);
    return {
      ...deepClone(DEFAULT_STATE), ...s,
      settings:{...DEFAULT_STATE.settings,...(s.settings||{})},
      records:s.records||{}, shiftChanges:s.shiftChanges||[], salaryIncreases:s.salaryIncreases||[]
    };
  }catch(e){ return deepClone(DEFAULT_STATE); }
}
let state = loadState();
function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function toISODate(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function parseDate(s){ const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d); }
function addDays(s,n){ const d=parseDate(s); d.setDate(d.getDate()+n); return toISODate(d); }
function diffDays(a,b){ return Math.round((parseDate(a)-parseDate(b))/86400000); }
function dateRange(from,to){
  const arr=[]; if(!from||!to||from>to) return arr;
  for(let d=from; d<=to; d=addDays(d,1)) arr.push(d);
  return arr;
}
function fmtDate(s, opts={day:'2-digit',month:'2-digit',year:'numeric'}){ return parseDate(s).toLocaleDateString('ar-JO',opts); }
function weekday(s){ return WEEKDAYS[parseDate(s).getDay()]; }
function money(n){ return `${(Number(n)||0).toFixed(3)} د.أ`; }
function hours(n){ return (Number(n)||0).toFixed(2); }
function toast(msg){ const t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),1800); }

function effectiveShiftConfig(date){
  const base = {
    weeklyOff1: state.settings.weeklyOff1, weeklyOff2: state.settings.weeklyOff2,
    shiftSystem: state.settings.shiftSystem, cycleStartShift: state.settings.cycleStartShift,
    cycleStartDate: state.settings.cycleStartDate
  };
  const changes = [...state.shiftChanges].filter(x=>x.effectiveFrom && x.effectiveFrom<=date)
    .sort((a,b)=>a.effectiveFrom.localeCompare(b.effectiveFrom));
  return changes.reduce((acc,x)=>({
    weeklyOff1:x.weeklyOff1||acc.weeklyOff1,
    weeklyOff2:x.weeklyOff2||acc.weeklyOff2,
    shiftSystem:x.shiftSystem||acc.shiftSystem,
    cycleStartShift:x.cycleStartShift||acc.cycleStartShift,
    cycleStartDate:x.effectiveFrom||acc.cycleStartDate
  }),base);
}
function autoDayType(date){
  const cfg=effectiveShiftConfig(date), wd=weekday(date);
  return (wd===cfg.weeklyOff1 || wd===cfg.weeklyOff2) ? 'عطلة أسبوعية' : 'دوام';
}
function autoShift(date, dayType){
  if(dayType==='عطلة أسبوعية'||dayType==='عطلة رسمية') return 'عطلة';
  const cfg=effectiveShiftConfig(date);
  if(cfg.shiftSystem==='صباحي فقط') return 'صباحي';
  if(cfg.shiftSystem==='مسائي فقط') return 'مسائي';
  const weeks=Math.floor(diffDays(date,cfg.cycleStartDate)/7);
  const even=((weeks%2)+2)%2===0;
  return even ? cfg.cycleStartShift : (cfg.cycleStartShift==='صباحي'?'مسائي':'صباحي');
}
function effectiveSalary(date){
  let s=Number(state.settings.baseSalary)||0;
  [...state.salaryIncreases].filter(x=>x.effectiveFrom && x.effectiveFrom<=date)
    .sort((a,b)=>a.effectiveFrom.localeCompare(b.effectiveFrom))
    .forEach(x=>s += Number(x.amount)||0);
  return s;
}
function calcWorkedHours(tin,tout){
  if(!tin||!tout) return null;
  const [ih,im]=tin.split(':').map(Number), [oh,om]=tout.split(':').map(Number);
  let a=ih*60+im,b=oh*60+om; let mins=b-a; if(mins<0) mins+=1440;
  return mins/60;
}
function minuteOfDay(t){
  if(!t) return null;
  const [h,m]=t.split(':').map(Number);
  return h*60+m;
}
function absoluteWindow(start,end,anchorShift){
  let a=minuteOfDay(start), b=minuteOfDay(end);
  if(anchorShift==='مسائي'){
    // Night-shift date starts in the evening and may end after midnight.
    if(a < 12*60) a += 1440;
    if(b < 12*60) b += 1440;
  } else if(b<a) b+=1440;
  return [a,b];
}
function punchWindow(tin,tout,shift){
  if(!tin||!tout) return null;
  let a=minuteOfDay(tin), b=minuteOfDay(tout);
  if(shift==='مسائي'){
    if(a < 12*60) a += 1440;
    if(b < 12*60) b += 1440;
  }
  if(b<a) b+=1440;
  return [a,b];
}
function overlapMinutes(a,b,c,d){ return Math.max(0,Math.min(b,d)-Math.max(a,c)); }
function calcScheduledWork(r,shift,daily){
  const rule=SHIFT_RULES[shift];
  const punch=punchWindow(r.in,r.out,shift);
  if(!rule || !punch) return {normal:0,ot125:0,shortage:0,actual:null,clockActual:calcWorkedHours(r.in,r.out)};
  const [pIn,pOut]=punch;
  const [nIn,nOut]=absoluteWindow(rule.normalStart,rule.normalEnd,shift);
  const [oIn,oOut]=absoluteWindow(rule.otStart,rule.otEnd,shift);
  const regularWindowMinutes=nOut-nIn;
  const regularWorkedMinutes=overlapMinutes(pIn,pOut,nIn,nOut);
  // A complete regular shift always credits 9.6 h. Missing clock time is counted 1:1
  // as shortage, so lateness/early leave never consumes overtime worked in the OT window.
  const missingRegularHours=Math.max(regularWindowMinutes-regularWorkedMinutes,0)/60;
  const normal=Math.max(0,Math.min(daily,daily-missingRegularHours));
  const shortage=Math.max(daily-normal,0);
  const otWindowMinutes=Math.max(oOut-oIn,1);
  const otWorkedMinutes=overlapMinutes(pIn,pOut,oIn,oOut);
  // Company full OT block is 2.4 payroll hours; partial OT is proportional to that block.
  const ot125=Math.min(rule.fullOtHours,(otWorkedMinutes/otWindowMinutes)*rule.fullOtHours);
  return {normal,ot125,shortage,actual:normal+ot125,clockActual:calcWorkedHours(r.in,r.out)};
}
function calcDay(date, overrideRecord=null){
  const r=overrideRecord || state.records[date] || {};
  const dayType=r.dayTypeOverride || autoDayType(date);
  const shift=r.shiftOverride || autoShift(date,dayType);
  const clockActual=calcWorkedHours(r.in,r.out);
  const daily=Number(state.settings.dailyHours)||9.6;
  let actual=null, normal=0, ot125=0, ot150=0, shortage=0;
  if(dayType==='دوام'){
    const x=calcScheduledWork(r,shift,daily);
    actual=x.actual; normal=x.normal; ot125=x.ot125; shortage=x.shortage;
  }else if(dayType==='إجازة مرضية'||dayType==='إجازة عرضية'){
    normal=daily; actual=daily;
  }else if(dayType==='عطلة أسبوعية'||dayType==='عطلة رسمية'){
    ot150=clockActual===null?0:clockActual; actual=clockActual;
  }else if(dayType==='غياب'){
    actual=0;
  }
  const salary=effectiveSalary(date);
  const normalRate=salary/(Number(state.settings.salaryDivisorDays)||30)/daily;
  const ot125Rate=salary/(Number(state.settings.salaryDivisorDays)||30)/(Number(state.settings.otDivisorHours)||8)*(Number(state.settings.otWorkMultiplier)||1.25);
  const ot150Rate=salary/(Number(state.settings.salaryDivisorDays)||30)/(Number(state.settings.otDivisorHours)||8)*(Number(state.settings.otHolidayMultiplier)||1.5);
  const ot125Value=ot125*ot125Rate, ot150Value=ot150*ot150Rate;
  let status='مكتمل';
  if((r.in&&!r.out)||(!r.in&&r.out)) status='تحقق من الوقت';
  else if(dayType==='دوام'&&!r.in&&!r.out) status='ناقص وقت';
  else if((dayType==='عطلة أسبوعية'||dayType==='عطلة رسمية')&&!r.in&&!r.out) status='لا يوجد دوام';
  else if(dayType==='دوام'&&shortage>0&&ot125>0) status='إضافي + مغادرة';
  else if(dayType==='دوام'&&shortage>0) status='مغادرة/تأخير';
  else if(ot125+ot150>0) status='إضافي تلقائي';
  return {date,weekday:weekday(date),dayType,shift,actual,clockActual,normal,ot125,ot150,shortage,ot125Value,ot150Value,status,
          absenceValue: dayType==='غياب'? salary/(Number(state.settings.salaryDivisorDays)||30):0,
          shortageValue: shortage*normalRate, notes:r.notes||'', in:r.in||'', out:r.out||''};
}


function calcSummary(from,to){
  const dates=dateRange(from,to), s=state.settings;
  const rows=dates.map(d=>calcDay(d));
  const fraction=Math.min(dates.length/(Number(s.salaryDivisorDays)||30),1);
  const avgSalary=dates.length ? dates.reduce((a,d)=>a+effectiveSalary(d),0)/dates.length : 0;
  const base=avgSalary*fraction;
  const transport=(Number(s.transportAllowance)||0)*fraction;
  const hasNight=rows.some(r=>r.dayType==='دوام'&&r.shift==='مسائي');
  const night=hasNight?(Number(s.nightAllowance)||0)*fraction:0;
  const ot125=rows.reduce((a,r)=>a+r.ot125Value,0), ot150=rows.reduce((a,r)=>a+r.ot150Value,0);
  const gross=base+transport+night+ot125+ot150;
  const social=(Number(s.socialSecurityBase)||0)*(Number(s.socialSecurityRate)||0)*fraction;
  const savings=avgSalary*(Number(s.savingsRate)||0)*fraction;
  const takaful=(Number(s.takaful)||0)*fraction;
  const absence=s.deductAbsence?rows.reduce((a,r)=>a+r.absenceValue,0):0;
  const shortage=s.deductShortage?rows.reduce((a,r)=>a+r.shortageValue,0):0;
  const deductions=social+savings+takaful+absence+shortage, net=gross-deductions;
  const stats={
    actual:rows.reduce((a,r)=>a+(r.actual||0),0), normal:rows.reduce((a,r)=>a+r.normal,0),
    ot125h:rows.reduce((a,r)=>a+r.ot125,0), ot150h:rows.reduce((a,r)=>a+r.ot150,0),
    shortageH:rows.reduce((a,r)=>a+r.shortage,0),
    workDays:rows.filter(r=>r.dayType==='دوام'&&(r.actual||0)>0).length,
    nightDays:rows.filter(r=>r.dayType==='دوام'&&r.shift==='مسائي').length,
    official:rows.filter(r=>r.dayType==='عطلة رسمية').length,
    weekly:rows.filter(r=>r.dayType==='عطلة أسبوعية').length,
    sick:rows.filter(r=>r.dayType==='إجازة مرضية').length,
    casual:rows.filter(r=>r.dayType==='إجازة عرضية').length,
    absent:rows.filter(r=>r.dayType==='غياب').length,
    review:rows.filter(r=>r.status==='ناقص وقت'||r.status==='تحقق من الوقت'||r.shortage>0).length
  };
  return {days:dates.length,fraction,base,transport,night,ot125,ot150,gross,social,savings,takaful,absence,shortage,deductions,net,stats};
}

function renderHome(){
  const from=document.getElementById('homeFrom').value, to=document.getElementById('homeTo').value;
  state.period={from,to}; saveState();
  const x=calcSummary(from,to);
  document.getElementById('kpiNet').textContent=money(x.net);
  document.getElementById('kpiPeriod').textContent=`${fmtDate(from)} — ${fmtDate(to)}`;
  document.getElementById('kpiOtHours').textContent=hours(x.stats.ot125h+x.stats.ot150h);
  document.getElementById('kpiOtValue').textContent=money(x.ot125+x.ot150);
  document.getElementById('kpiReview').textContent=x.stats.review;
  const today=toISODate(new Date()), list=[];
  for(let i=0;i<45&&list.length<6;i++){
    const d=addDays(today,i), r=calcDay(d);
    if(r.dayType==='دوام') list.push(r);
  }
  document.getElementById('upcomingList').innerHTML=list.map(r=>`
    <div class="mini-day">
      <div><div class="date">${r.weekday} — ${fmtDate(r.date,{day:'2-digit',month:'2-digit'})}</div><small>${r.actual!==null?'مسجل: '+hours(r.actual)+' ساعة':'لم يتم إدخال الوقت بعد'}</small></div>
      <span class="badge ${r.shift==='مسائي'?'night':'morning'}">${r.shift}</span>
    </div>`).join('') || '<div class="empty">لا يوجد دوام قريب.</div>';
}
function cardClass(r){
  if(r.status==='ناقص وقت'||r.status==='تحقق من الوقت'||r.shortage>0) return 'warn';
  if(r.dayType==='عطلة أسبوعية'||r.dayType==='عطلة رسمية') return 'off';
  if(r.dayType.includes('إجازة')||r.dayType==='غياب') return 'leave';
  return '';
}
function renderAttendance(){
  const ym=document.getElementById('monthPicker').value;
  if(!ym) return;
  const [y,m]=ym.split('-').map(Number), last=new Date(y,m,0).getDate();
  const rows=[];
  for(let d=1;d<=last;d++){ const iso=`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`; rows.push(calcDay(iso)); }
  document.getElementById('attendanceList').innerHTML=rows.map(r=>`
    <button class="day-card ${cardClass(r)}" data-date="${r.date}" style="text-align:right;border-left:0;border-top:0;border-bottom:0;width:100%">
      <div class="day-top">
        <div class="day-date"><strong>${r.weekday} — ${fmtDate(r.date,{day:'2-digit',month:'2-digit'})}</strong><small>${r.dayType} • ${r.shift} • ${r.status}</small></div>
        <div class="day-meta">${r.in?`<span class="badge">${r.in} ← ${r.out||'—'}</span>`:''}</div>
      </div>
      <div class="day-times">
        <div class="metric"><span>فعلي</span><strong>${r.actual===null?'—':hours(r.actual)}</strong></div>
        <div class="metric"><span>طبيعي</span><strong>${hours(r.normal)}</strong></div>
        <div class="metric"><span>إضافي</span><strong>${hours(r.ot125+r.ot150)}</strong></div>
        <div class="metric"><span>قيمة الإضافي</span><strong>${money(r.ot125Value+r.ot150Value)}</strong></div>
      </div>
    </button>`).join('');
  document.querySelectorAll('.day-card').forEach(b=>b.addEventListener('click',()=>openDayModal(b.dataset.date)));
}
function renderSummary(){
  const from=document.getElementById('sumFrom').value,to=document.getElementById('sumTo').value,x=calcSummary(from,to);
  state.period={from,to}; document.getElementById('homeFrom').value=from; document.getElementById('homeTo').value=to; saveState();
  document.getElementById('sumNet').textContent=money(x.net); document.getElementById('sumDays').textContent=`${x.days} يوم`;
  const rows=[
    ['الراتب الأساسي للفترة',x.base],['بدل المواصلات',x.transport],['بدل المسائي',x.night],
    ['قيمة إضافي 1.25',x.ot125],['قيمة إضافي 1.50',x.ot150],['الإجمالي قبل الخصم',x.gross,'total'],
    ['خصم الضمان',x.social,'deduct'],['خصم صندوق الادخار',x.savings,'deduct'],['تكافل',x.takaful,'deduct'],
    ['خصم الغياب',x.absence,'deduct'],['خصم ساعات المغادرة',x.shortage,'deduct'],['إجمالي الخصومات',x.deductions,'total deduct']
  ];
  document.getElementById('salaryBreakdown').innerHTML=rows.map(r=>`<div class="break-row ${r[2]||''}"><span>${r[0]}</span><strong>${money(r[1])}</strong></div>`).join('');
  const st=[
    ['إجمالي الساعات الفعلية',hours(x.stats.actual)],['الساعات الطبيعية',hours(x.stats.normal)],
    ['ساعات إضافي 1.25',hours(x.stats.ot125h)],['ساعات إضافي 1.50',hours(x.stats.ot150h)],
    ['ساعات النقص',hours(x.stats.shortageH)],['أيام الدوام المسجلة',x.stats.workDays],
    ['أيام المسائي',x.stats.nightDays],['العطل الرسمية',x.stats.official],['العطل الأسبوعية',x.stats.weekly],
    ['الإجازات المرضية',x.stats.sick],['المتبقي مرضي',Math.max((Number(state.settings.sickBalance)||0)-x.stats.sick,0)],
    ['الإجازات العرضية',x.stats.casual],['المتبقي عرضي',Math.max((Number(state.settings.casualBalance)||0)-x.stats.casual,0)],
    ['أيام الغياب',x.stats.absent],['صفوف تحتاج مراجعة',x.stats.review]
  ];
  document.getElementById('statsGrid').innerHTML=st.map(r=>`<div class="stat"><span>${r[0]}</span><strong>${r[1]}</strong></div>`).join('');
  renderHome();
}
function populateWeekdays(){
  document.querySelectorAll('.weekday-select').forEach(s=>{s.innerHTML=WEEKDAYS.map(w=>`<option>${w}</option>`).join('')});
}
function renderSettings(){
  populateWeekdays();
  document.querySelectorAll('[data-setting]').forEach(el=>{ el.value=state.settings[el.dataset.setting] ?? ''; });
  document.querySelectorAll('[data-setting-percent]').forEach(el=>{ el.value=((state.settings[el.dataset.settingPercent]||0)*100); });
  document.querySelectorAll('[data-setting-bool]').forEach(el=>{ el.checked=!!state.settings[el.dataset.settingBool]; });
  renderShiftChanges(); renderSalaryIncreases();
}
function renderShiftChanges(){
  const box=document.getElementById('shiftChanges');
  box.innerHTML=state.shiftChanges.length?state.shiftChanges.map((x,i)=>`
    <div class="change-row" data-i="${i}">
      <label>ساري من<input type="date" data-f="effectiveFrom" value="${x.effectiveFrom||''}"></label>
      <label>عطلة 1<select class="weekday-select" data-f="weeklyOff1">${WEEKDAYS.map(w=>`<option ${w===x.weeklyOff1?'selected':''}>${w}</option>`).join('')}</select></label>
      <label>عطلة 2<select class="weekday-select" data-f="weeklyOff2">${WEEKDAYS.map(w=>`<option ${w===x.weeklyOff2?'selected':''}>${w}</option>`).join('')}</select></label>
      <label>النظام<select data-f="shiftSystem"><option ${x.shiftSystem==='تناوب أسبوعي'?'selected':''}>تناوب أسبوعي</option><option ${x.shiftSystem==='صباحي فقط'?'selected':''}>صباحي فقط</option><option ${x.shiftSystem==='مسائي فقط'?'selected':''}>مسائي فقط</option></select></label>
      <label>البداية<select data-f="cycleStartShift"><option ${x.cycleStartShift==='صباحي'?'selected':''}>صباحي</option><option ${x.cycleStartShift==='مسائي'?'selected':''}>مسائي</option></select></label>
      <button class="delete-btn" data-delshift="${i}">×</button>
    </div>`).join(''):'<p class="hint">لا توجد تغييرات إضافية؛ النظام الأساسي هو المستخدم.</p>';
  box.querySelectorAll('[data-f]').forEach(el=>el.addEventListener('change',e=>{ const row=e.target.closest('.change-row'); state.shiftChanges[+row.dataset.i][e.target.dataset.f]=e.target.value; saveState(); refreshAll(); }));
  box.querySelectorAll('[data-delshift]').forEach(b=>b.addEventListener('click',()=>{state.shiftChanges.splice(+b.dataset.delshift,1);saveState();renderShiftChanges();refreshAll();}));
}
function renderSalaryIncreases(){
  const box=document.getElementById('salaryIncreases');
  box.innerHTML=state.salaryIncreases.length?state.salaryIncreases.map((x,i)=>`
    <div class="increase-row" data-i="${i}">
      <label>ساري من<input type="date" data-incf="effectiveFrom" value="${x.effectiveFrom||''}"></label>
      <label>مبلغ الزيادة<input type="number" step="0.001" data-incf="amount" value="${x.amount||0}"></label>
      <button class="delete-btn" data-delinc="${i}">×</button>
    </div>`).join(''):'<p class="hint">لا توجد زيادات مسجلة.</p>';
  box.querySelectorAll('[data-incf]').forEach(el=>el.addEventListener('change',e=>{ const row=e.target.closest('.increase-row'); state.salaryIncreases[+row.dataset.i][e.target.dataset.incf]=e.target.dataset.incf==='amount'?Number(e.target.value):e.target.value; saveState(); refreshAll(); }));
  box.querySelectorAll('[data-delinc]').forEach(b=>b.addEventListener('click',()=>{state.salaryIncreases.splice(+b.dataset.delinc,1);saveState();renderSalaryIncreases();refreshAll();}));
}

let editingDate=null;
function timeOptions(){
  let x='<option value="">—</option>';
  for(let h=0;h<24;h++) for(let m of [0,30]){ const t=`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`; x+=`<option value="${t}">${t}</option>`; }
  return x;
}
function resolvedModalShift(){
  if(!editingDate) return '';
  const dayType=document.getElementById('editDayType').value || autoDayType(editingDate);
  return document.getElementById('editShift').value || autoShift(editingDate,dayType);
}
function updateQuickButtons(){
  const shift=resolvedModalShift(), rule=SHIFT_RULES[shift];
  const tin=document.getElementById('editIn').value, tout=document.getElementById('editOut').value;
  let active='manual';
  if(rule && tin===rule.normalIn && tout===rule.normalOut) active='normal';
  if(rule && tin===rule.extraIn && tout===rule.extraOut) active='extra';
  document.querySelectorAll('[data-quick-entry]').forEach(b=>b.classList.toggle('active',b.dataset.quickEntry===active));
}
function applyQuickEntry(mode){
  if(!editingDate) return;
  if(mode==='manual'){
    updateQuickButtons();
    document.getElementById('editIn').focus();
    return;
  }
  let dayType=document.getElementById('editDayType').value || autoDayType(editingDate);
  let shift=document.getElementById('editShift').value || autoShift(editingDate,dayType);
  if(!SHIFT_RULES[shift]){
    shift=autoShift(editingDate,'دوام');
    if(!SHIFT_RULES[shift]) shift='صباحي';
    document.getElementById('editShift').value=shift;
  }
  document.getElementById('editDayType').value='دوام';
  const rule=SHIFT_RULES[shift];
  if(mode==='normal'){
    document.getElementById('editIn').value=rule.normalIn;
    document.getElementById('editOut').value=rule.normalOut;
  }else{
    document.getElementById('editIn').value=rule.extraIn;
    document.getElementById('editOut').value=rule.extraOut;
  }
  updateDayPreview();
}
function openDayModal(date){
  editingDate=date; const r=state.records[date]||{};
  document.getElementById('modalDayName').textContent=weekday(date);
  document.getElementById('modalDate').textContent=fmtDate(date);
  document.getElementById('editDayType').value=r.dayTypeOverride||'';
  document.getElementById('editShift').value=r.shiftOverride||'';
  document.getElementById('editIn').value=r.in||''; document.getElementById('editOut').value=r.out||'';
  document.getElementById('editNotes').value=r.notes||'';
  updateQuickButtons(); updateDayPreview(); document.getElementById('dayModal').classList.add('open');
}
function closeDayModal(){ document.getElementById('dayModal').classList.remove('open'); editingDate=null; }
function modalDraft(){
  return {dayTypeOverride:document.getElementById('editDayType').value,shiftOverride:document.getElementById('editShift').value,
          in:document.getElementById('editIn').value,out:document.getElementById('editOut').value,notes:document.getElementById('editNotes').value.trim()};
}
function updateDayPreview(){
  if(!editingDate) return; updateQuickButtons(); const c=calcDay(editingDate,modalDraft());
  document.getElementById('dayCalcPreview').innerHTML=`
    <div><span>الساعات الفعلية</span><strong>${c.actual===null?'—':hours(c.actual)}</strong></div>
    <div><span>الإضافي</span><strong>${hours(c.ot125+c.ot150)}</strong></div>
    <div><span>قيمة الإضافي</span><strong>${money(c.ot125Value+c.ot150Value)}</strong></div>
    <div><span>نوع اليوم</span><strong>${c.dayType}</strong></div>
    <div><span>الشفت</span><strong>${c.shift}</strong></div>
    <div><span>الحالة</span><strong>${c.status}</strong></div>`;
}
function saveDay(){
  const d=modalDraft(), clean={};
  Object.entries(d).forEach(([k,v])=>{if(v!==''&&v!==null)clean[k]=v});
  if(Object.keys(clean).length) state.records[editingDate]=clean; else delete state.records[editingDate];
  saveState(); closeDayModal(); refreshAll(); toast('تم حفظ اليوم');
}
function refreshAll(){ renderAttendance(); renderSummary(); }

function setupNavigation(){
  const titles={home:'الرئيسية',attendance:'الدوام',summary:'الملخص',settings:'الإعدادات'};
  document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>go(b.dataset.page)));
  document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.go)));
  function go(p){
    document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));
    document.getElementById(`page-${p}`).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.page===p));
    document.getElementById('pageTitle').textContent=titles[p];
    if(p==='settings') renderSettings();
    scrollTo({top:0,behavior:'smooth'});
  }
  window.goPage=go;
}
function initInputs(){
  const p=state.period;
  ['homeFrom','sumFrom'].forEach(id=>document.getElementById(id).value=p.from);
  ['homeTo','sumTo'].forEach(id=>document.getElementById(id).value=p.to);
  document.getElementById('monthPicker').value=p.to.slice(0,7);
  document.getElementById('editIn').innerHTML=timeOptions(); document.getElementById('editOut').innerHTML=timeOptions();
  ['homeFrom','homeTo'].forEach(id=>document.getElementById(id).addEventListener('change',()=>{document.getElementById('sumFrom').value=document.getElementById('homeFrom').value;document.getElementById('sumTo').value=document.getElementById('homeTo').value;renderSummary()}));
  ['sumFrom','sumTo'].forEach(id=>document.getElementById(id).addEventListener('change',renderSummary));
  document.getElementById('monthPicker').addEventListener('change',renderAttendance);
  document.getElementById('todayMonthBtn').addEventListener('click',()=>{document.getElementById('monthPicker').value=toISODate(new Date()).slice(0,7);renderAttendance()});
  document.querySelectorAll('#dayModal select,#dayModal textarea').forEach(el=>el.addEventListener('input',updateDayPreview));
  document.getElementById('closeModal').addEventListener('click',closeDayModal);
  document.getElementById('dayModal').addEventListener('click',e=>{if(e.target.id==='dayModal')closeDayModal()});
  document.querySelectorAll('[data-quick-entry]').forEach(b=>b.addEventListener('click',()=>applyQuickEntry(b.dataset.quickEntry)));
  document.getElementById('saveDay').addEventListener('click',saveDay);
  document.getElementById('clearDay').addEventListener('click',()=>{if(editingDate&&confirm('مسح كل إدخال هذا اليوم؟')){delete state.records[editingDate];saveState();closeDayModal();refreshAll();toast('تم مسح إدخال اليوم')}});
}

function setupSettingsEvents(){
  document.addEventListener('change',e=>{
    if(e.target.matches('[data-setting]')){
      const k=e.target.dataset.setting, numeric=e.target.type==='number';
      state.settings[k]=numeric?Number(e.target.value):e.target.value; saveState(); refreshAll();
    }
    if(e.target.matches('[data-setting-percent]')){
      state.settings[e.target.dataset.settingPercent]=Number(e.target.value)/100; saveState(); refreshAll();
    }
    if(e.target.matches('[data-setting-bool]')){
      state.settings[e.target.dataset.settingBool]=e.target.checked; saveState(); refreshAll();
    }
  });
  document.getElementById('addShiftChange').addEventListener('click',()=>{
    state.shiftChanges.push({effectiveFrom:toISODate(new Date()),weeklyOff1:state.settings.weeklyOff1,weeklyOff2:state.settings.weeklyOff2,shiftSystem:state.settings.shiftSystem,cycleStartShift:state.settings.cycleStartShift});
    saveState();renderShiftChanges();
  });
  document.getElementById('addSalaryIncrease').addEventListener('click',()=>{
    state.salaryIncreases.push({effectiveFrom:toISODate(new Date()),amount:0});saveState();renderSalaryIncreases();
  });
  document.getElementById('exportBackup').addEventListener('click',()=>{
    const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`جدول-الدوام-backup-${toISODate(new Date())}.json`;a.click();URL.revokeObjectURL(a.href);toast('تم تصدير النسخة الاحتياطية');
  });
  document.getElementById('importBackup').addEventListener('change',async e=>{
    const f=e.target.files[0]; if(!f)return;
    try{ const obj=JSON.parse(await f.text()); if(!obj.settings||!obj.records)throw new Error(); state={...deepClone(DEFAULT_STATE),...obj,settings:{...DEFAULT_STATE.settings,...obj.settings}};saveState();renderSettings();refreshAll();toast('تم استيراد النسخة');}
    catch{alert('الملف غير صالح أو ليس نسخة احتياطية من التطبيق.')} e.target.value='';
  });
  document.getElementById('resetData').addEventListener('click',()=>{
    if(confirm('سيتم مسح كل البيانات والعودة إلى نسخة فارغة. هل أنت متأكد؟')){state=deepClone(DEFAULT_STATE);saveState();initAfterReset();toast('تمت إعادة التطبيق لنسخة فارغة');}
  });
}
function initAfterReset(){
  const p=state.period; ['homeFrom','sumFrom'].forEach(id=>document.getElementById(id).value=p.from); ['homeTo','sumTo'].forEach(id=>document.getElementById(id).value=p.to);
  document.getElementById('monthPicker').value=p.to.slice(0,7);renderSettings();refreshAll();
}

let deferredPrompt=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;document.getElementById('installBtn').hidden=false;});
document.getElementById('installBtn').addEventListener('click',async()=>{if(deferredPrompt){deferredPrompt.prompt();deferredPrompt=null;document.getElementById('installBtn').hidden=true;}else{alert('على الآيفون: افتح التطبيق من Safari ثم مشاركة ← إضافة إلى الشاشة الرئيسية.')}});

if('serviceWorker' in navigator){ window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js?v=7').catch(()=>{})); }

setupNavigation(); initInputs(); setupSettingsEvents(); renderSettings(); renderAttendance(); renderSummary();
