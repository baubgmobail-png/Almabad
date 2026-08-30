(()=>{
const homeDate=document.getElementById('homeDate');
const todayChip=document.getElementById('todayChip');
if(homeDate)homeDate.textContent=new Date().toLocaleDateString('ar-JO',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
if(todayChip)todayChip.textContent=new Date().toLocaleDateString('ar-JO',{weekday:'long',day:'numeric',month:'short'});
})();