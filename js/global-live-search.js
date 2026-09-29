/* AssureX global search: real permission-scoped records, all workspace headers. */
(function () {
  'use strict';
  const input = document.getElementById('globalSearch');
  if (!input) return;
  const box = input.closest('.global-search');
  if (!box) return;
  const params = new URLSearchParams(location.search);
  if (params.has('search')) {
    document.addEventListener('DOMContentLoaded', function () {
      const current = location.pathname.split('/').pop();
      const selector = current === 'products.html' ? '#productSearch' : current === 'documents.html' ? '#docSearch' : null;
      const local = selector && document.querySelector(selector);
      if (local) { local.value = params.get('search'); local.dispatchEvent(new Event('input',{bubbles:true})); }
    });
  }
  input.setAttribute('autocomplete','off');
  input.setAttribute('role','combobox');
  input.setAttribute('aria-autocomplete','list');
  input.setAttribute('aria-expanded','false');
  input.setAttribute('aria-controls','assurex-search-results');
  const panel = document.createElement('div');
  panel.className = 'assurex-search-results'; panel.id = 'assurex-search-results';
  panel.setAttribute('role','listbox'); panel.hidden = true; box.appendChild(panel);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const val = (row,fields) => fields.map(k => row[k]).find(x=>typeof x==='string'&&x.trim()) || '';
  const sections = [
    { kind:'Claim',collection:'claims',method:'getClaims',fields:['userId','user_id'],
      title:r=>val(r,['claimNumber','claimId','claim_id','productName','product_name'])||r.id,
      detail:r=>[r.id,r.status,r.description,r.fault?.description].filter(Boolean).join(' · '),
      url:r=>(['admin','reviewer'].includes(role)?'decision.html':'claims.html')+'?claimId='+encodeURIComponent(r.id)},
    {kind:'Product',collection:'products',method:'getProducts',fields:['user_id','userId'],
      title:r=>val(r,['name','productName','product_name','model_number'])||r.id,
      detail:r=>[r.brand,r.serial_number,r.serialNumber,r.model_number,r.product_id].filter(Boolean).join(' · '),
      url:r=>'products.html?search='+encodeURIComponent(val(r,['serial_number','serialNumber','name','product_id'])||r.id)},
    {kind:'Document',collection:'documents',method:'getDocuments',fields:['userId','user_id'],
      title:r=>val(r,['fileName','name','originalName','documentName'])||r.id,
      detail:r=>[r.documentType,r.claimId,r.productId,r.fileType].filter(Boolean).join(' · '),
      url:r=>'documents.html?search='+encodeURIComponent(val(r,['fileName','name','originalName','documentName'])||r.id)}
  ];
  let role='user',rows=[],last=0,inflight=null,currentUid='',ticket=0,timer=null,active=-1;
  const show=()=>{panel.hidden=false;input.setAttribute('aria-expanded','true');};
  const hide=()=>{panel.hidden=true;input.setAttribute('aria-expanded','false');active=-1;};
  const normalized = doc => ({id:doc.id,...doc.data()});
  async function scopedCollection(section, uid) {
    // On standalone pages the app's full CRUD service isn't loaded; query this user's permitted documents.
    const root = fbDb.collection(section.collection);
    if (role==='admin') return (await root.get()).docs.map(normalized);
    const results = await Promise.allSettled(section.fields.map(field=>root.where(field,'==',uid).get()));
    const docs=new Map();
    results.forEach(out=>{if(out.status==='fulfilled')out.value.docs.forEach(doc=>docs.set(doc.id,normalized(doc)));});
    if (results.every(out=>out.status==='rejected')) throw results[0].reason;
    return [...docs.values()];
  }
  async function waitUser() {
    if (!window.fbAuth || !window.fbDb) throw new Error('Firebase is not available on this page.');
    return new Promise((resolve,reject)=>{
      let unsubscribe = () => {};
      unsubscribe = fbAuth.onAuthStateChanged(u=>{
        if (!u) {unsubscribe();reject(new Error('Sign in to search your account records.'));}
        else {unsubscribe();resolve(u);}
      },reject);
    });
  }
  async function fetchRows(force=false) {
    const user=await waitUser();
    if(currentUid!==user.uid){currentUid=user.uid;last=0;rows=[];}
    if (!force && last && Date.now()-last<30000) return rows;
    if(inflight) return inflight;
    inflight=(async()=>{
      let userDoc=null;
      try {userDoc=await fbDb.collection('users').doc(user.uid).get();}
      catch (_) {/* unverified roles must not receive broader access */}
      role=userDoc?.exists?String(userDoc.data().role||'user').toLowerCase():'user';
      const results=await Promise.allSettled(sections.map(section=>{
        const method=window.DbService && DbService[section.method];
        return typeof method==='function' ? method.call(DbService) : scopedCollection(section,user.uid);
      }));
      if(results.every(x=>x.status==='rejected')) throw new Error('Records are unavailable. Check your Firebase connection or access permissions.');
      rows=results.flatMap((result,i)=>result.status==='fulfilled'&&Array.isArray(result.value)?result.value.map(record=>({record,section:sections[i]})):[]);
      last=Date.now();return rows;
    })().finally(()=>inflight=null);
    return inflight;
  }
  function searchable(record){
    const found=[];
    function add(obj,depth){
      if(depth>2 || !obj || typeof obj!=='object')return;
      Object.entries(obj).forEach(([key,value])=>{
        if(/password|token|secret|credential|fileData|base64|chunk|image|blob|url|filePath/i.test(key))return;
        if(typeof value==='string'||typeof value==='number')found.push(String(value));
        else if(value && typeof value==='object'&&!Array.isArray(value)&&!('seconds' in value))add(value,depth+1);
      });
    }
    add(record,0); return found.join(' ').toLowerCase();
  }
  function render(items,q){
    active=-1;
    if(!items.length){panel.innerHTML='<div class="ax-search-message">No records found for <strong>'+esc(q)+'</strong>.</div>';show();return;}
    panel.innerHTML='<div class="ax-search-heading">Results <span>'+items.length+(items.length>30?' (first 30 shown)':'')+'</span></div>' + items.slice(0,30).map((item,index)=>{
      const r=item.record,s=item.section;
      return '<a class="ax-search-item" role="option" data-index="'+index+'" href="'+esc(s.url(r))+'"><span class="ax-search-kind">'+esc(s.kind)+'</span><span class="ax-search-text"><strong>'+esc(s.title(r))+'</strong><small>'+esc(s.detail(r))+'</small></span><span aria-hidden="true">↗</span></a>';
    }).join('');show();
  }
  async function search(){
    const q=input.value.trim().toLowerCase(),id=++ticket;
    if(!q){hide();return;}
    panel.innerHTML='<div class="ax-search-message">Searching your workspace…</div>';show();
    try{const list=await fetchRows();if(id!==ticket)return;render(list.filter(row=>searchable(row.record).includes(q)),input.value.trim());}
    catch(error){if(id!==ticket)return;panel.innerHTML='<div class="ax-search-message ax-search-error">'+esc(error?.message||'Search unavailable.')+'</div>';show();}
  }
  input.addEventListener('input',()=>{clearTimeout(timer);if(!input.value.trim()){++ticket;hide();return;}timer=setTimeout(search,170);});
  input.addEventListener('focus',()=>{if(input.value.trim())search();});
  input.addEventListener('keydown',event=>{
    if(event.key==='Escape'){hide();input.blur();return;}
    if(!['Enter','ArrowDown','ArrowUp'].includes(event.key))return;
    // Capturing this event also prevents the old command palette's Enter listener hijacking search.
    event.stopImmediatePropagation();event.preventDefault();
    const links=panel.querySelectorAll('a.ax-search-item');
    if(event.key==='Enter') {if(!panel.hidden&&links.length)location.assign(links[Math.max(0,active)].href);else search();return;}
    if(!links.length)return;
    active=(active+(event.key==='ArrowDown'?1:-1)+links.length)%links.length;
    links.forEach((a,i)=>a.classList.toggle('ax-active',i===active));links[active].scrollIntoView({block:'nearest'});
  },true);
  document.addEventListener('pointerdown',event=>{if(!box.contains(event.target))hide();});
  window.addEventListener('pageshow',()=>{last=0;rows=[];});
  window.addEventListener('assurex-data-changed',()=>{last=0;rows=[];});
  document.addEventListener('keydown',event=>{
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'&& !event.altKey){
      // Only override command shortcut when a workspace search control exists.
      event.preventDefault();event.stopImmediatePropagation();input.focus();input.select();
    }
  },true);
})();
