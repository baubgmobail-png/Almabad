
(function(root){
'use strict';

const VERSION=17;
const FULL_FORMAT='shifti-full-backup';

const APPS=[
  {id:'salary',label:'الحضور وحساب الراتب',key:'jadwal_dawam_v2',aliases:['almaabad_salary_jadwal_dawam_v2']},
  {id:'schedule',label:'جدول الدوام والإجازات',key:'qwh_state',aliases:['almaabad_schedule_qwh_state']},
  {id:'insurance',label:'التأمين الصحي',key:'insurance_balance_app_v1',aliases:['almaabad_insurance_balance_app_v1']},
  {id:'jamiyati',label:'جمعياتي',key:'almaabad_jamiyati_v1',aliases:[]},
  {id:'leave',label:'رصيد الإجازات',key:'shifti_leave_v9',aliases:[]},
  {id:'finance',label:'الدفتر المالي',key:'shifti_finance_v9',aliases:[]},
  {id:'jannah',label:'طريقي إلى الجنة',key:'shifti_jannah_v2',aliases:['shifti_jannah_v1']}
];

const APP_BY_ID=Object.fromEntries(APPS.map(x=>[x.id,x]));
const APP_BY_KEY={};
APPS.forEach(a=>{APP_BY_KEY[a.key]=a;(a.aliases||[]).forEach(k=>APP_BY_KEY[k]=a)});

function isObj(x){return !!x && typeof x==='object' && !Array.isArray(x)}
function safeParse(raw){
  if(raw===null||raw===undefined)return {ok:false,value:null};
  if(typeof raw!=='string')return {ok:true,value:raw};
  try{return {ok:true,value:JSON.parse(raw)}}catch{return {ok:false,value:raw}}
}
function stringifyValue(v){
  return typeof v==='string'?v:JSON.stringify(v);
}
function meaningfulRaw(raw){
  if(raw===null||raw===undefined||raw==='')return false;
  const p=safeParse(raw);
  if(!p.ok)return String(raw).trim().length>0;
  const v=p.value;
  if(Array.isArray(v))return v.length>0;
  if(isObj(v))return Object.keys(v).length>0;
  return v!==null && v!=='';
}
function knownOrAppKey(k){
  return !!APP_BY_KEY[k] || k.startsWith('shifti_') || k.startsWith('almaabad_');
}
function collectStorage(rawMap){
  const out={};
  Object.entries(rawMap||{}).forEach(([k,raw])=>{
    if(k==='shifti_preimport_backup_v17'||k==='shifti_last_import_keys_v17')return;
    if(knownOrAppKey(k)||['jadwal_dawam_v2','qwh_state','insurance_balance_app_v1'].includes(k)){
      out[k]=raw;
    }
  });
  return out;
}
function packRaw(raw){
  const p=safeParse(raw);
  return p.ok?{encoding:'json',value:p.value}:{encoding:'text',value:String(raw)};
}
function unpackPacked(x){
  if(isObj(x)&&x.encoding==='text')return String(x.value??'');
  if(isObj(x)&&x.encoding==='json')return JSON.stringify(x.value);
  // Backward-compatible if storage directly contains parsed values.
  return typeof x==='string'?x:JSON.stringify(x);
}
function buildFullBackup(rawMap,nowIso){
  const storage=collectStorage(rawMap);
  const packed={};
  Object.entries(storage).forEach(([k,v])=>packed[k]=packRaw(v));
  return {
    format:FULL_FORMAT,
    version:VERSION,
    app:'Shifti',
    exportedAt:nowIso||new Date().toISOString(),
    storage:packed
  };
}
function restorePlanFromFull(obj){
  if(!isObj(obj)||obj.format!==FULL_FORMAT||!isObj(obj.storage))return null;
  const writes=[];
  Object.entries(obj.storage).forEach(([k,v])=>{
    if(knownOrAppKey(k)||['jadwal_dawam_v2','qwh_state','insurance_balance_app_v1'].includes(k)){
      writes.push({key:k,raw:unpackPacked(v),appId:APP_BY_KEY[k]?.id||'extra',label:APP_BY_KEY[k]?.label||k});
    }
  });
  return {kind:'full',writes,label:'نسخة Shifti شاملة'};
}

function detectLegacy(obj,filename=''){
  const f=String(filename||'').toLowerCase();

  // Full backup first.
  const full=restorePlanFromFull(obj);
  if(full)return full;

  // Old/current salary backup: exact original shape settings + records.
  if(isObj(obj)&&isObj(obj.settings)&&isObj(obj.records)){
    return {kind:'single',writes:[{key:'jadwal_dawam_v2',raw:JSON.stringify(obj),appId:'salary',label:'الحضور وحساب الراتب'}],label:'نسخة حساب الراتب القديمة'};
  }

  // Old/current insurance backup: exact original shape.
  if(isObj(obj)&&isObj(obj.years)&&obj.activeYear!==undefined){
    return {kind:'single',writes:[{key:'insurance_balance_app_v1',raw:JSON.stringify(obj),appId:'insurance',label:'التأمين الصحي'}],label:'نسخة التأمين الصحي القديمة'};
  }

  // Old/current QWH schedule backup.
  if(isObj(obj)&&Array.isArray(obj.employees)&&typeof obj.month==='string' &&
     (isObj(obj.overrides)||Array.isArray(obj.monthPlans)||Array.isArray(obj.rotationPlans)||isObj(obj.monthDecisions))){
    return {kind:'single',writes:[{key:'qwh_state',raw:JSON.stringify(obj),appId:'schedule',label:'جدول الدوام والإجازات'}],label:'نسخة جدول الدوام القديمة'};
  }

  // Current finance.
  if(isObj(obj)&&Array.isArray(obj.entries)){
    return {kind:'single',writes:[{key:'shifti_finance_v9',raw:JSON.stringify(obj),appId:'finance',label:'الدفتر المالي'}],label:'نسخة الدفتر المالي'};
  }

  // Current leave.
  if(isObj(obj)&&isObj(obj.balances)&&Array.isArray(obj.records)){
    return {kind:'single',writes:[{key:'shifti_leave_v9',raw:JSON.stringify(obj),appId:'leave',label:'رصيد الإجازات'}],label:'نسخة رصيد الإجازات'};
  }

  // Jannah progress.
  if(isObj(obj)&&(obj.lastRead||obj.lastTafsir||obj.lastAudio||Array.isArray(obj.pageMarks)||Array.isArray(obj.marks))){
    return {kind:'single',writes:[{key:'shifti_jannah_v2',raw:JSON.stringify(obj),appId:'jannah',label:'طريقي إلى الجنة'}],label:'نسخة طريقي إلى الجنة'};
  }

  // Jamiyati array. Empty array requires helpful filename.
  if(Array.isArray(obj) && (
      obj.some(x=>isObj(x)&&('startMonth' in x||'duration' in x||'monthly' in x)) ||
      (obj.length===0 && (f.includes('jamiy')||f.includes('جمع')))
  )){
    return {kind:'single',writes:[{key:'almaabad_jamiyati_v1',raw:JSON.stringify(obj),appId:'jamiyati',label:'جمعياتي'}],label:'نسخة جمعياتي'};
  }

  // Legacy wrapper support: {state:{...}} or {data:{...}}
  if(isObj(obj)&&isObj(obj.state)){
    const d=detectLegacy(obj.state,filename);
    if(d)return d;
  }
  if(isObj(obj)&&isObj(obj.data)){
    const d=detectLegacy(obj.data,filename);
    if(d)return d;
  }

  // Filename hints only when data is structurally plausible.
  if(f.includes('insurance')&&isObj(obj))return {kind:'single',writes:[{key:'insurance_balance_app_v1',raw:JSON.stringify(obj),appId:'insurance',label:'التأمين الصحي'}],label:'نسخة تأمين بحسب اسم الملف'};
  if((f.includes('quality')||f.includes('working-hours')||f.includes('qwh'))&&isObj(obj))return {kind:'single',writes:[{key:'qwh_state',raw:JSON.stringify(obj),appId:'schedule',label:'جدول الدوام والإجازات'}],label:'نسخة جدول بحسب اسم الملف'};
  if((f.includes('salary')||f.includes('راتب')||f.includes('دوام-backup'))&&isObj(obj))return {kind:'single',writes:[{key:'jadwal_dawam_v2',raw:JSON.stringify(obj),appId:'salary',label:'الحضور وحساب الراتب'}],label:'نسخة راتب بحسب اسم الملف'};

  return null;
}

function planFiles(files){
  const writes=[],reports=[];
  for(const f of files||[]){
    let obj;
    try{obj=typeof f.value==='string'?JSON.parse(f.value):f.value}
    catch{reports.push({file:f.name||'ملف',ok:false,message:'JSON غير صالح'});continue}
    const d=detectLegacy(obj,f.name||'');
    if(!d){reports.push({file:f.name||'ملف',ok:false,message:'لم أتعرف على نوع النسخة'});continue}
    d.writes.forEach(w=>writes.push({...w,source:f.name||d.label}));
    reports.push({file:f.name||'ملف',ok:true,message:d.label,apps:[...new Set(d.writes.map(w=>w.label))]});
  }
  // Last file wins for same storage key.
  const byKey=new Map();
  writes.forEach(w=>byKey.set(w.key,w));
  return {writes:[...byKey.values()],reports};
}

function legacyDevicePlan(rawMap){
  const writes=[],reports=[];
  for(const app of APPS){
    const canonical=rawMap[app.key];
    if(meaningfulRaw(canonical)){
      reports.push({appId:app.id,label:app.label,status:'exists',message:'موجود أصلًا في Shifti'});
      continue;
    }
    const alias=(app.aliases||[]).find(k=>meaningfulRaw(rawMap[k]));
    if(alias){
      writes.push({key:app.key,raw:rawMap[alias],appId:app.id,label:app.label,source:alias});
      reports.push({appId:app.id,label:app.label,status:'migrate',message:`سيتم نقله من ${alias}`});
    }else{
      reports.push({appId:app.id,label:app.label,status:'none',message:'لا توجد بيانات قديمة منفصلة'});
    }
  }
  return {writes,reports};
}

function appSummary(appId,raw){
  const p=safeParse(raw);
  if(!p.ok)return 'بيانات موجودة';
  const x=p.value;
  try{
    if(appId==='salary')return `${Object.keys(x.records||{}).length} يوم مسجل`;
    if(appId==='schedule')return `${(x.employees||[]).length} موظفين · ${(x.monthPlans||x.rotationPlans||[]).length} إعداد شهر`;
    if(appId==='insurance'){
      const ys=Object.values(x.years||{});
      const visits=ys.reduce((n,y)=>n+(y.visits||[]).length,0);
      const tx=ys.reduce((n,y)=>n+(y.transactions||[]).length,0);
      return `${Object.keys(x.years||{}).length} سنة · ${visits} زيارة · ${tx} حركة`;
    }
    if(appId==='jamiyati')return `${Array.isArray(x)?x.length:0} جمعية`;
    if(appId==='leave')return `${(x.records||[]).length} إجازة/طلب`;
    if(appId==='finance')return `${(x.entries||[]).length} حركة مالية`;
    if(appId==='jannah')return `${(x.pageMarks||[]).length} علامة قرآن · ${(x.marks||[]).length} علامة أخرى`;
  }catch{}
  return 'بيانات موجودة';
}

const API={VERSION,FULL_FORMAT,APPS,APP_BY_ID,APP_BY_KEY,safeParse,meaningfulRaw,collectStorage,buildFullBackup,restorePlanFromFull,detectLegacy,planFiles,legacyDevicePlan,appSummary,stringifyValue};
root.ShiftiBackupCore=API;
if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof window!=='undefined'?window:globalThis);
