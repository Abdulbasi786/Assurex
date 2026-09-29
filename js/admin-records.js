/* On-demand, administrator-only related record inspection. Firestore rules remain authoritative. */
(function(){'use strict';
const make=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
const stringify=x=>JSON.stringify(x,(key,value)=>value&&typeof value.toDate==='function'?value.toDate().toISOString():value,2);
async function fetchRecords(collection,fields,uid){const snapshots=await Promise.all(fields.map(field=>fbDb.collection(collection).where(field,'==',uid).get()));const rows=new Map();snapshots.forEach(s=>s.docs.forEach(d=>rows.set(d.id,{id:d.id,...d.data()})));return [...rows.values()];}
document.addEventListener('click',async e=>{
 const button=e.target.closest('[data-user-records]');if(!button)return;
 if(window.AssureXRole!=='admin')return;
 const parent=button.closest('.user-row');let existing=parent.nextElementSibling;if(existing?.classList.contains('ax-user-records')){existing.hidden=!existing.hidden;button.setAttribute('aria-expanded',String(!existing.hidden));return;}
 const panel=make('section');panel.className='ax-user-records';panel.setAttribute('aria-live','polite');parent.after(panel);button.setAttribute('aria-expanded','true');panel.append(make('p','Loading associated records…'));
 const uid=button.dataset.userRecords;
 try{
 const profile=await fbDb.collection('users').doc(uid).get();const identity=profile.data()?.uid||uid;
 const sources=[['Claims','claims',['userId']],['Products','products',['userId','user_id']],['Documents','documents',['userId']],['Repairs','repair_records',['userId']],['Notifications','notifications',['userId']],['Audit log','audit_logs',['userId','user_id']],['Security events','security_events',['uid','userId']],['Errors','error_events',['userId']],['Anomalies','anomaly_alerts',['userId']]];
 const results=await Promise.allSettled(sources.map(s=>fetchRecords(s[1],s[2],identity)));panel.replaceChildren();
 const claimResult=results[0];if(claimResult.status==='fulfilled'){
 const claims=claimResult.value;const status=c=>String(c.status||'pending').toLowerCase().replace(/[_-]/g,' ');
 const counts=[['Total claims',claims.length],['Pending / review',claims.filter(c=>['pending','under review','manual review','manual review required','pending review','in review','under evaluation','additional information required'].includes(status(c))).length],['Approved',claims.filter(c=>['approved','accepted','valid'].includes(status(c))).length],['Rejected',claims.filter(c=>['rejected','declined','invalid'].includes(status(c))).length]];
 const grid=make('div');grid.className='stats-grid';counts.forEach(([label,value])=>{const card=make('div');card.className='stat-card';card.append(make('span',label),make('strong',value));grid.append(card)});panel.append(grid);
 }else panel.append(make('p','Claim totals unavailable: '+(claimResult.reason?.message||'Access denied')));
 const profileDetails=make('details');profileDetails.append(make('summary','User profile'),make('pre',stringify(profile.data()||{})));panel.append(profileDetails);
 results.forEach((result,i)=>{const details=make('details');details.append(make('summary',sources[i][0]+(result.status==='fulfilled'?' ('+result.value.length+')':'')));if(result.status==='rejected'){details.append(make('p','Records unavailable: '+(result.reason?.message||'Access denied')))}else if(!result.value.length){details.append(make('p','No associated records.'))}else{result.value.forEach(row=>{const record=make('details');record.append(make('summary',row.id),make('pre',stringify(row)));details.append(record)})}panel.append(details)});
 }catch(error){panel.replaceChildren(make('p','Could not load records. '+error.message));const retry=make('button','Retry');retry.onclick=()=>{panel.remove();button.click()};panel.append(retry);}
});
})();
