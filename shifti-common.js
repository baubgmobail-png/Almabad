
window.Shifti={
 uid(){return crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`},
 today(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`},
 month(){return this.today().slice(0,7)},
 parseDate(s){const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d||1)},
 addDays(s,n){const d=this.parseDate(s);d.setDate(d.getDate()+n);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`},
 fmt(s,opt={day:'2-digit',month:'2-digit',year:'numeric'}){if(!s)return '—';return this.parseDate(s).toLocaleDateString('ar-JO',opt)},
 fmtMonth(s){if(!s)return '—';const [y,m]=s.split('-').map(Number);return new Date(y,m-1,1).toLocaleDateString('ar-JO',{month:'long',year:'numeric'})},
 money(n){return `${(Number(n)||0).toFixed(3)} د.أ`},
 num(n){return new Intl.NumberFormat('ar-JO',{maximumFractionDigits:2}).format(Number(n)||0)},
 toast(msg){let t=document.getElementById('sfToast');if(!t){t=document.createElement('div');t.id='sfToast';t.className='sf-toast';document.body.appendChild(t)}t.textContent=msg;t.classList.add('show');clearTimeout(t._tm);t._tm=setTimeout(()=>t.classList.remove('show'),1800)},
 download(name,data,type='application/json'){const b=new Blob([data],{type});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),200)},
 esc(v=''){return String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
};
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js?v=10').catch(()=>{}));}
