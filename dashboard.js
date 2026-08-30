
(()=>{const S=window.Shifti;const today=S.today(),month=S.month();homeDate.textContent=new Date().toLocaleDateString('ar-JO',{weekday:'long',day:'numeric',month:'long',year:'numeric'});todayChip.textContent=new Date().toLocaleDateString('ar-JO',{weekday:'long',day:'numeric',month:'short'});
try{const p=JSON.parse(localStorage.getItem('shifti_profile_v9')||'{}');if(p.name)helloText.textContent=`مرحباً ${p.name.split(' ')[0]}`;}catch{}
try{const st=JSON.parse(localStorage.getItem('jadwal_dawam_v2')||'{}'),r=(st.records||{})[today];dashAttendance.textContent=r?(r.in&&r.out?`${r.in}–${r.out}`:r.dayTypeOverride||'مسجل'):'غير مسجل';}catch{dashAttendance.textContent='—'}
try{const t=JSON.parse(localStorage.getItem('shifti_tasks_v9')||'[]');dashTasks.textContent=t.filter(x=>!x.done).length;}catch{}
try{const raw=localStorage.getItem('shifti_leave_v9');if(!raw){dashLeave.textContent='—'}else{const l=JSON.parse(raw),base=Number(l.balances?.annual)||0,used=(l.records||[]).filter(x=>x.type==='سنوية'&&x.status==='معتمدة').reduce((a,x)=>a+(Number(x.days)||0),0);dashLeave.textContent=`${Math.max(0,base-used)} يوم`;}}catch{dashLeave.textContent='—'}
try{const f=JSON.parse(localStorage.getItem('shifti_finance_v9')||'{}'),e=f.entries||[];const curr=e.filter(x=>(x.date||'').slice(0,7)===month);let inc=0,out=0;curr.forEach(x=>{const a=Number(x.actual)||0;if(['income','debtIn'].includes(x.type))inc+=a;else if(['expense','commitment','saving','debtOut'].includes(x.type))out+=a});dashFinance.textContent=S.money(inc-out);}catch{}
})();
