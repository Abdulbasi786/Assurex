/* User-only notifications for claims linked to that user's registered products. */
(function(){'use strict';
  const panel=document.getElementById('profileClaimAlerts'),counter=document.getElementById('profileClaimCount');
  if(!panel||!counter)return;
  let unsubscribe=null,activeUid=null;
  const allowed=new Set(['claim_submission','claim_review','status_change','missing_documents']);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function render(notes){const items=notes.filter(n=>allowed.has(String(n.type||''))).slice(0,15);
    counter.textContent=String(items.filter(n=>!n.read).length);
    if(!items.length){panel.innerHTML='<p>No product claim notifications yet.</p>';return;}
    panel.innerHTML=items.map(n=>'<a class="profile-claim-alert'+(n.read?' read':'')+'" href="claims.html?claimId='+encodeURIComponent(n.claimId||'')+'" data-id="'+esc(n.id)+'"><i aria-hidden="true"></i><span class="profile-claim-alert-text"><strong>'+esc(n.title||'Claim update')+'</strong><small>'+esc(n.body||'A registered product claim has been updated.')+'</small></span><span aria-hidden="true">↗</span></a>').join('');
    panel.querySelectorAll('[data-id]').forEach(link=>link.addEventListener('click',()=>{
      if(window.DbService&&typeof DbService.markNotificationRead==='function')DbService.markNotificationRead(link.dataset.id).catch(e=>console.warn('[Claim notification] Mark read:',e));
    }));
  }
  function start(u){if(unsubscribe){unsubscribe();unsubscribe=null;}activeUid=u?.uid||null;
    if(!activeUid){panel.innerHTML='<p>Sign in to view your product claim notifications.</p>';counter.textContent='0';return;}
    if(!window.DbService||typeof DbService.listenNotifications!=='function'){
      panel.innerHTML='<p>Notification service is unavailable.</p>';return;
    }
    unsubscribe=DbService.listenNotifications(activeUid,notes=>{if(activeUid===u.uid)render(notes||[]);},err=>{
      console.warn('[Profile notifications]',err);panel.innerHTML='<p>Cannot load product claim alerts. Check your notification read permission in Firestore.</p>';
    });
  }
  if(window.fbAuth)fbAuth.onAuthStateChanged(start);
  else panel.innerHTML='<p>Firebase Authentication is unavailable.</p>';
  window.addEventListener('pagehide',()=>{if(unsubscribe)unsubscribe();});
})();
