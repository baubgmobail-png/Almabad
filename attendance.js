
const S=Shifti,KEY='jadwal_dawam_v2',WEEK=['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
const DEF={settings:{dailyHours:9.6,weeklyOff1:'الثلاثاء',weeklyOff2:'الأربعاء',shiftSystem:'تناوب أسبوعي',cycleStartShift:'مسائي',cycleStartDate:'2026-07-02'},records:{},shiftChanges:[]};
const RULES={
  صباحي:{normalStart:'07:00',normalEnd:'17:30',otStart:'17:30',otEnd:'19:00',normalIn:'07:00',normalOut:'17:30',extraIn:'07:00',extraOut:'19:00',fullOtMinutes:144},
  مسائي:{normalStart:'21:30',normalEnd:'07:00',otStart:'19:00',otEnd:'21:30',normalIn:'21:30',normalOut:'07:00',extraIn:'19:00',extraOut:'07:00',fullOtMinutes:144}
};
let state=load(),editing='';

function load(){
  try{
    const x=JSON.parse(localStorage.getItem(KEY));
    return x?{...DEF,...x,settings:{...DEF.settings,...(x.settings||{})},records:x.records||{},shiftChanges:x.shiftChanges||[]}:JSON.parse(JSON.stringify(DEF));
  }catch{return JSON.parse(JSON.stringify(DEF))}
}
function save(){localStorage.setItem(KEY,JSON.stringify(state))}
function cfg(date){
  let c={
    weeklyOff1:state.settings.weeklyOff1,
    weeklyOff2:state.settings.weeklyOff2,
    shiftSystem:state.settings.shiftSystem,
    cycleStartShift:state.settings.cycleStartShift,
    cycleStartDate:state.settings.cycleStartDate
  };
  [...(state.shiftChanges||[])]
    .filter(x=>x.effectiveFrom&&x.effectiveFrom<=date)
    .sort((a,b)=>a.effectiveFrom.localeCompare(b.effectiveFrom))
    .forEach(x=>{
      c={
        ...c,
        weeklyOff1:x.weeklyOff1||c.weeklyOff1,
        weeklyOff2:x.weeklyOff2||c.weeklyOff2,
        shiftSystem:x.shiftSystem||c.shiftSystem,
        cycleStartShift:x.cycleStartShift||c.cycleStartShift,
        cycleStartDate:x.effectiveFrom||c.cycleStartDate
      };
    });
  return c;
}
function wd(date){return WEEK[S.parseDate(date).getDay()]}
function dayType(date){const c=cfg(date),w=wd(date);return w===c.weeklyOff1||w===c.weeklyOff2?'عطلة أسبوعية':'دوام'}
function dateAdd(s,n){
  const d=S.parseDate(s);
  d.setDate(d.getDate()+n);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function flipShift(sh){return sh==='صباحي'?'مسائي':'صباحي'}
function rotatingShift(date){
  const c=cfg(date);
  const anchor=c.cycleStartDate||date;
  let current=c.cycleStartShift==='صباحي'?'صباحي':'مسائي';

  // The selected starting shift applies to the first WORK block at/after this change date.
  let firstWork=null;
  for(let d=anchor;d<=date;d=dateAdd(d,1)){
    if(dayType(d)==='دوام'){firstWork=d;break}
  }
  if(!firstWork)return current;
  if(date<=firstWork)return current;

  let prev=firstWork;
  for(let d=dateAdd(firstWork,1);d<=date;d=dateAdd(d,1)){
    const prevType=dayType(prev),curType=dayType(d);
    if(curType==='دوام'&&prevType==='عطلة أسبوعية')current=flipShift(current);
    prev=d;
  }
  return current;
}
function shift(date,type=dayType(date)){
  if(type.includes('عطلة'))return'عطلة';
  const c=cfg(date);
  if(c.shiftSystem==='صباحي فقط')return'صباحي';
  if(c.shiftSystem==='مسائي فقط')return'مسائي';
  return rotatingShift(date);
}
function minute(t){if(!t)return null;const[h,m]=t.split(':').map(Number);return h*60+m}
function mins(a,b){if(!a||!b)return 0;let x=minute(b)-minute(a);if(x<0)x+=1440;return x}
function absWindow(start,end,sh){
  let a=minute(start),b=minute(end);
  if(sh==='مسائي'){if(a<720)a+=1440;if(b<720)b+=1440}
  else if(b<a)b+=1440;
  return[a,b];
}
function punch(a,b,sh){
  if(!a||!b)return null;
  let x=minute(a),y=minute(b);
  if(sh==='مسائي'){if(x<720)x+=1440;if(y<720)y+=1440}
  if(y<x)y+=1440;
  return[x,y];
}
function overlap(a,b,c,d){return Math.max(0,Math.min(b,d)-Math.max(a,c))}
function durationHM(m){
  m=Math.max(0,Math.round(Number(m)||0));
  return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
}
function calc(date,r){
  const type=r.dayTypeOverride||dayType(date),
        sh=r.shiftOverride||shift(date,type),
        actual=mins(r.in,r.out);
  let short=0,rawOt=0,creditedOt=0,otKind='';

  if(type==='دوام'&&RULES[sh]&&r.in&&r.out){
    const q=RULES[sh],pu=punch(r.in,r.out,sh),
          [ni,no]=absWindow(q.normalStart,q.normalEnd,sh),
          [oi,oo]=absWindow(q.otStart,q.otEnd,sh);
    short=Math.max((no-ni)-overlap(pu[0],pu[1],ni,no),0);
    rawOt=overlap(pu[0],pu[1],oi,oo);
    const otWindow=Math.max(oo-oi,1);
    // Same formula as salary.js: full overtime window = 2.4 h = 144 min credited.
    creditedOt=Math.min(q.fullOtMinutes,(rawOt/otWindow)*q.fullOtMinutes);
    otKind='1.25';
  }else if((type==='عطلة أسبوعية'||type==='عطلة رسمية')&&r.in&&r.out){
    // Salary uses actual clock hours for 1.50 holiday overtime.
    rawOt=actual;
    creditedOt=actual;
    otKind='1.50';
  }
  return{type,sh,actual,short,rawOt,creditedOt,otKind};
}
function datesOf(ym){
  const[y,m]=ym.split('-').map(Number),last=new Date(y,m,0).getDate();
  return Array.from({length:last},(_,i)=>`${y}-${String(m).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`);
}
function render(){
  state=load();
  const dates=datesOf(attMonth.value),
        rows=dates.map(d=>({d,r:state.records[d]||{},c:calc(d,state.records[d]||{})})),
        entered=rows.filter(x=>x.r.in||x.r.out||x.r.dayTypeOverride||x.r.notes);

  kRecorded.textContent=entered.length;
  kHours.textContent=durationHM(entered.reduce((a,x)=>a+x.c.actual,0));
  kShort.textContent=durationHM(entered.reduce((a,x)=>a+x.c.short,0));
  kOt.textContent=durationHM(entered.reduce((a,x)=>a+x.c.creditedOt,0));

  attList.innerHTML=rows.map(x=>`<button class="sf-row" data-date="${x.d}" style="text-align:right;width:100%;border-right:4px solid ${x.c.type==='دوام'?'#21b7ae':'#9aaabc'}">
    <div class="sf-row-top">
      <div><h3>${wd(x.d)} · ${S.fmt(x.d,{day:'2-digit',month:'2-digit'})}</h3><p>${x.c.type} · ${x.c.sh}</p></div>
      <div class="sf-amount">${x.r.in||'—'} ${x.r.in||x.r.out?'←':''} ${x.r.out||''}</div>
    </div>
    <div class="sf-meta">
      <span class="sf-badge blue">فعلي ${durationHM(x.c.actual)}</span>
      ${x.c.short?`<span class="sf-badge amber">نقص ${durationHM(x.c.short)}</span>`:''}
      ${x.c.creditedOt?`<span class="sf-badge teal">إضافي محسوب ${durationHM(x.c.creditedOt)}</span>`:''}
      ${x.r.notes?`<span class="sf-badge">ملاحظة</span>`:''}
    </div>
  </button>`).join('');

  document.querySelectorAll('[data-date]').forEach(b=>b.onclick=()=>open(b.dataset.date));
}
function open(d){
  editing=d;
  const r=state.records[d]||{};
  attModalDay.textContent=wd(d);
  attModalDate.textContent=S.fmt(d);
  attType.value=r.dayTypeOverride||'';
  attShift.value=r.shiftOverride||'';
  attIn.value=r.in||'';
  attOut.value=r.out||'';
  attNotes.value=r.notes||'';
  preview();
  attModal.classList.add('open');
}
function close(){attModal.classList.remove('open');editing=''}
function draft(){return{dayTypeOverride:attType.value,shiftOverride:attShift.value,in:attIn.value,out:attOut.value,notes:attNotes.value.trim()}}
function preview(){
  if(!editing)return;
  const c=calc(editing,draft());
  attPreview.textContent=`${c.type} · ${c.sh} · الفعلي ${durationHM(c.actual)}${c.short?` · نقص ${durationHM(c.short)}`:''}${c.creditedOt?` · إضافي محسوب ${durationHM(c.creditedOt)}`:''}`;
}
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=close);
attModal.onclick=e=>{if(e.target===attModal)close()};
[attType,attShift,attIn,attOut,attNotes].forEach(x=>x.oninput=preview);
document.querySelectorAll('[data-quick]').forEach(b=>b.onclick=()=>{
  if(!editing)return;
  const mode=b.dataset.quick;
  if(mode==='clear'){attIn.value=attOut.value='';preview();return}
  const type=attType.value||dayType(editing);
  let sh=attShift.value||shift(editing,type);
  if(!RULES[sh])sh='صباحي';
  attType.value='دوام';
  attShift.value=sh;
  attIn.value=RULES[sh][mode==='extra'?'extraIn':'normalIn'];
  attOut.value=RULES[sh][mode==='extra'?'extraOut':'normalOut'];
  preview();
});
attSave.onclick=()=>{
  const d=draft(),clean={};
  Object.entries(d).forEach(([k,v])=>{if(v!=='')clean[k]=v});
  if(Object.keys(clean).length)state.records[editing]=clean;
  else delete state.records[editing];
  save();close();render();S.toast('تم حفظ اليوم');
};
attDelete.onclick=()=>{
  if(editing&&confirm('حذف إدخال هذا اليوم؟')){
    delete state.records[editing];save();close();render();S.toast('تم الحذف');
  }
};
attMonth.value=S.month();
todayBtn.onclick=()=>{attMonth.value=S.month();render()};
quickToday.onclick=()=>open(S.today());
attMonth.onchange=render;
render();
