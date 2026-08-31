
const S=Shifti;
const STORAGE_KEY='jadwal_dawam_v2';
const WEEKDAYS=['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
const DEFAULT_SETTINGS={baseSalary:0,socialSecurityBase:0,socialSecurityRate:.075,savingsRate:0,takaful:0,dailyHours:9.6,otWorkMultiplier:1.25,otHolidayMultiplier:1.5,salaryDivisorDays:30,nightAllowance:0,cycleStartShift:'مسائي',cycleStartDate:'2026-07-02',weeklyOff1:'الثلاثاء',weeklyOff2:'الأربعاء',deductAbsence:false,deductShortage:false,sickBalance:14,casualBalance:0,transportAllowance:0,otDivisorHours:8,shiftSystem:'تناوب أسبوعي'};
const $=id=>document.getElementById(id);

function emptyState(){return{version:2,settings:{...DEFAULT_SETTINGS},period:null,shiftChanges:[],salaryIncreases:[],records:{}}}
function load(){try{const raw=JSON.parse(localStorage.getItem(STORAGE_KEY));if(!raw)return emptyState();const settings={...DEFAULT_SETTINGS,...(raw.settings||{})};return{...emptyState(),...raw,settings,records:raw.records||{},shiftChanges:(Array.isArray(raw.shiftChanges)?raw.shiftChanges:[]).map(x=>({...x,cycleStartShift:x.cycleStartShift||settings.cycleStartShift||'صباحي'})),salaryIncreases:Array.isArray(raw.salaryIncreases)?raw.salaryIncreases:[]}}catch{return emptyState()}}
let state=load();
function saveState(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}
function fillWeekdays(){document.querySelectorAll('.weekday-select').forEach(el=>{el.innerHTML=WEEKDAYS.map(w=>`<option value="${w}">${w}</option>`).join('')})}
function loadForm(){
  state=load(); fillWeekdays();
  document.querySelectorAll('[data-setting]').forEach(el=>el.value=state.settings[el.dataset.setting]??'');
  document.querySelectorAll('[data-percent]').forEach(el=>el.value=((Number(state.settings[el.dataset.percent])||0)*100).toFixed(2).replace(/\.00$/,''));
  document.querySelectorAll('[data-bool]').forEach(el=>el.checked=!!state.settings[el.dataset.bool]);
  renderChanges(); renderIncreases();
}
function collectForm(){
  const numeric=new Set(['baseSalary','socialSecurityBase','takaful','dailyHours','otWorkMultiplier','otHolidayMultiplier','salaryDivisorDays','nightAllowance','sickBalance','casualBalance','transportAllowance','otDivisorHours']);
  document.querySelectorAll('[data-setting]').forEach(el=>{const k=el.dataset.setting;state.settings[k]=numeric.has(k)?Number(el.value||0):el.value});
  document.querySelectorAll('[data-percent]').forEach(el=>state.settings[el.dataset.percent]=Number(el.value||0)/100);
  document.querySelectorAll('[data-bool]').forEach(el=>state.settings[el.dataset.bool]=el.checked);
}
function flash(){const f=$('savedFlash');f.classList.add('show');clearTimeout(f._t);f._t=setTimeout(()=>f.classList.remove('show'),1500)}
function saveAll(){collectForm();saveState();flash();S.toast('تم حفظ إعدادات الراتب')}

function renderChanges(){
  const box=$('shiftChanges');
  if(!state.shiftChanges.length){
    box.innerHTML='<div class="sf-note">ما في تغييرات إضافية. النظام الأساسي بالأعلى هو المستخدم.</div>';
    return;
  }

  box.innerHTML=state.shiftChanges.map((x,i)=>`
    <div class="change-row" data-index="${i}" style="grid-template-columns:repeat(5,minmax(0,1fr)) auto">
      <label>ساري من
        <input type="date" data-change="effectiveFrom" value="${x.effectiveFrom||''}">
      </label>
      <label>عطلة 1
        <select data-change="weeklyOff1">
          ${WEEKDAYS.map(w=>`<option value="${w}" ${w===x.weeklyOff1?'selected':''}>${w}</option>`).join('')}
        </select>
      </label>
      <label>عطلة 2
        <select data-change="weeklyOff2">
          ${WEEKDAYS.map(w=>`<option value="${w}" ${w===x.weeklyOff2?'selected':''}>${w}</option>`).join('')}
        </select>
      </label>
      <label>نظام الشفت
        <select data-change="shiftSystem">
          <option ${x.shiftSystem==='تناوب أسبوعي'?'selected':''}>تناوب أسبوعي</option>
          <option ${x.shiftSystem==='صباحي فقط'?'selected':''}>صباحي فقط</option>
          <option ${x.shiftSystem==='مسائي فقط'?'selected':''}>مسائي فقط</option>
        </select>
      </label>
      <label style="${x.shiftSystem==='تناوب أسبوعي'?'':'opacity:.45'}">
        أبدأ التناوب من
        <select data-change="cycleStartShift" ${x.shiftSystem==='تناوب أسبوعي'?'':'disabled'}>
          <option ${x.cycleStartShift==='صباحي'?'selected':''}>صباحي</option>
          <option ${x.cycleStartShift==='مسائي'?'selected':''}>مسائي</option>
        </select>
      </label>
      <button type="button" class="delete-mini" data-delete-change="${i}">حذف</button>
    </div>
    <div class="setting-note" style="margin-top:-2px;margin-bottom:8px">
      ${x.shiftSystem==='تناوب أسبوعي'
        ? `من ${x.effectiveFrom||'تاريخ التغيير'} يبدأ أول بلوك دوام بـ ${x.cycleStartShift||'صباحي'}، وبعد كل OFF ينقلب للشفت الثاني.`
        : x.shiftSystem==='صباحي فقط'
          ? 'من تاريخ التغيير يبقى صباحي فقط ولا ينقلب بعد العطلة.'
          : 'من تاريخ التغيير يبقى مسائي فقط ولا ينقلب بعد العطلة.'}
    </div>
  `).join('');

  box.querySelectorAll('[data-change]').forEach(el=>{
    el.addEventListener('change',()=>{
      const i=Number(el.closest('.change-row').dataset.index);
      state.shiftChanges[i][el.dataset.change]=el.value;
      saveState();
      renderChanges();
    });
  });

  box.querySelectorAll('[data-delete-change]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      state.shiftChanges.splice(Number(btn.dataset.deleteChange),1);
      saveState();
      renderChanges();
    });
  });
}
function renderIncreases(){
  const box=$('salaryIncreases');
  if(!state.salaryIncreases.length){box.innerHTML='<div class="sf-note">ما في زيادات راتب مسجلة.</div>';return}
  box.innerHTML=state.salaryIncreases.map((x,i)=>`<div class="change-row" data-index="${i}" style="grid-template-columns:1fr 1fr auto">
  <label>ساري من<input type="date" data-increase="effectiveFrom" value="${x.effectiveFrom||''}"></label>
  <label>مبلغ الزيادة<input type="number" inputmode="decimal" step="0.001" data-increase="amount" value="${Number(x.amount)||0}"></label>
  <button type="button" class="delete-mini" data-delete-increase="${i}">حذف</button></div>`).join('');
  box.querySelectorAll('[data-increase]').forEach(el=>el.addEventListener('change',()=>{const i=Number(el.closest('.change-row').dataset.index);state.salaryIncreases[i][el.dataset.increase]=el.dataset.increase==='amount'?Number(el.value||0):el.value;saveState()}));
  box.querySelectorAll('[data-delete-increase]').forEach(btn=>btn.addEventListener('click',()=>{state.salaryIncreases.splice(Number(btn.dataset.deleteIncrease),1);saveState();renderIncreases()}));
}

$('addShiftChange').addEventListener('click',()=>{collectForm();state.shiftChanges.push({effectiveFrom:'',weeklyOff1:state.settings.weeklyOff1,weeklyOff2:state.settings.weeklyOff2,shiftSystem:state.settings.shiftSystem,cycleStartShift:state.settings.cycleStartShift||'صباحي'});saveState();renderChanges()});
$('addSalaryIncrease').addEventListener('click',()=>{state.salaryIncreases.push({effectiveFrom:'',amount:0});saveState();renderIncreases()});
$('saveSettingsBtn').addEventListener('click',saveAll);
$('exportSalary').addEventListener('click',()=>{collectForm();saveState();S.download(`shifti-attendance-salary-${S.today()}.json`,JSON.stringify(state,null,2))});
$('importSalary').addEventListener('change',async()=>{const f=$('importSalary').files[0];if(!f)return;try{const imported=JSON.parse(await f.text());if(!imported.settings||!imported.records)throw Error();localStorage.setItem(STORAGE_KEY,JSON.stringify(imported));state=load();loadForm();S.toast('تم استيراد البيانات')}catch{alert('ملف النسخة الاحتياطية غير صالح')}finally{$('importSalary').value=''}});
document.addEventListener('change',e=>{if(e.target.matches('[data-setting],[data-percent],[data-bool]')){collectForm();saveState()}});
loadForm();
