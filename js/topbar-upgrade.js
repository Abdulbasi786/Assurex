/* AssureX navbar notifications: personal Firestore inbox + authorized admin activity.
   No dummy events, cross-account notification writes, or role bypass. */
(function () {
  'use strict';
  var unsubs = [], authUser = null, inbox = [], activitySources = {}, isAdmin = false;
  var open = false, inboxState = 'loading', activityState = 'loading', bell, panel, list, all, seenKey = '', seen = new Set();
  function el(id) { return document.getElementById(id); }
  function make(tag, cls, value) { var node = document.createElement(tag); if (cls) node.className = cls; if (value !== undefined) node.textContent = value; return node; }
  function stamp(t) {
    try { var d = t && t.toDate ? t.toDate() : t && t.seconds ? new Date(t.seconds * 1000) : new Date(t);
      return isNaN(d.getTime()) ? '' : d.toLocaleString(); } catch (_) { return ''; }
  }
  function time(t) { return t && t.toMillis ? t.toMillis() : t && t.seconds ? t.seconds * 1000 : +new Date(t || 0) || 0; }
  function safeLink(url) { if (typeof url !== 'string') return null; try { var u = new URL(url, location.href); return u.origin === location.origin && /\.html$/i.test(u.pathname) ? u.href : null; } catch (_) { return null; } }
  function eventKey(x) { return x.key || x.id || ''; }
  function isUnread(x) { return x.activity ? !seen.has(eventKey(x)) : !x.read; }
  function activityRows() {
    var items = Object.keys(activitySources).flatMap(function (k) { return activitySources[k]; });
    var keys = new Set(); return items.sort(function (a, b) { return time(b.createdAt) - time(a.createdAt); }).filter(function (n) {
      if (keys.has(n.key)) return false; keys.add(n.key); return true;
    }).slice(0, 65);
  }
  function combined() { return inbox.filter(function(n){ return ['claim_submission','claim_review','status_change','missing_documents'].includes(String(n.type||'')); }).concat(isAdmin ? activityRows() : []).sort(function (a, b) { return time(b.createdAt) - time(a.createdAt); }); }
  function announce() {
    window.dispatchEvent(new CustomEvent('assurex-notifications-update', { detail: {
      items: combined().slice(0, 15).map(function (n) { return { title: n.title, body: n.body, link: n.link, createdAt: n.createdAt, unread: isUnread(n) }; }),
      unread: combined().filter(isUnread).length
    } }));
  }
  function saveSeen() { try { localStorage.setItem(seenKey, JSON.stringify(Array.from(seen).slice(-300))); } catch (_) {} }
  function render() {
    var items = combined(), unread = items.filter(isUnread).length, badge = el('assurexUnread');
    if (badge) { badge.hidden = !unread; badge.textContent = unread > 99 ? '99+' : String(unread); }
    bell.classList.toggle('has-unread', !!unread); all.disabled = !items.length || !unread;
    list.replaceChildren();
    if (!authUser) { list.append(make('p','assurex-notify-message','Sign in to view notifications.')); announce(); return; }
    if (inboxState === 'error') list.append(make('p','assurex-notify-error','Personal notifications could not load. Check your Firestore permissions.'));
    if (isAdmin && activityState === 'error') list.append(make('p','assurex-notify-error','Admin activity could not load. Check Firestore read permissions.'));
    if (!items.length) {
      list.append(make('p','assurex-notify-message', inboxState === 'loading' || (isAdmin && activityState === 'loading') ? 'Loading notifications…' : 'No notifications yet.'));
      announce(); return;
    }
    items.forEach(function (n) {
      var b = make('button','assurex-notify-item' + (isUnread(n) ? ' unread' : ''));
      b.type = 'button'; b.append(make('strong','',n.title || 'Notification'));
      b.append(make('span','',n.body || n.message || ''));
      var foot = make('small','',stamp(n.createdAt)); if (n.activity) foot.textContent = 'Admin activity · ' + foot.textContent; b.append(foot);
      b.addEventListener('click', async function () {
        if (n.activity) { seen.add(eventKey(n)); saveSeen(); }
        else if (!n.read && window.DbService && typeof DbService.markNotificationRead === 'function') {
          try { await DbService.markNotificationRead(n.id); n.read = true; } catch (e) { console.warn('[AssureX] Mark notification read:', e); }
        }
        var dest = safeLink(n.link); if (dest) location.assign(dest); else render();
      }); list.append(b);
    }); announce();
  }
  function setOpen(next) {
    open = typeof next === 'boolean' ? next : !open; panel.hidden = !open;
    bell.setAttribute('aria-expanded', String(open));
    if (open && isAdmin) { activityRows().forEach(function (n) { seen.add(eventKey(n)); }); saveSeen(); }
    if (open) render();
  }
  function stop() { unsubs.splice(0).forEach(function (u) { try { u(); } catch (_) {} }); }
  function observeCollection(source, field, map) {
    try {
      var unsub = fbDb.collection(source).orderBy(field, 'desc').limit(45).onSnapshot(function (snap) {
        activitySources[source + ':' + field] = snap.docs.map(function (d) { return map(d.id,d.data()); }).filter(Boolean);
        activityState = 'ready'; render();
      }, function (err) { console.warn('[AssureX] Admin activity listener:', source,field, err);
        if (activityState !== 'ready') activityState = 'error'; render();
      }); unsubs.push(unsub);
    } catch (err) { console.warn('[AssureX] Could not attach admin activity:', err); }
  }
  function auditItem(id, a) {
    var action = String(a.action || a.type || ''), labels = {
      CREATE_PRODUCT:'Product submitted', UPDATE_PRODUCT:'Product updated', DELETE_PRODUCT:'Product removed',
      product_created:'Product submitted', product_updated:'Product updated', product_deleted:'Product removed',
      document_added:'Document submitted', document_uploaded:'Document submitted', document_deleted:'Document removed',
      repair_record_created:'Repair record submitted', repair_record_updated:'Repair record updated',
      claim_created:'Claim submitted', claim_updated:'Claim updated', claim_deleted:'Claim removed',
      profile_updated:'Profile updated', user_created:'User registered'
    };
    if (!labels[action]) return null;
    var d = a.details || a, who = a.userId || a.uid || d.userId || 'User';
    var path = /product/i.test(action) ? 'products.html' : /document/i.test(action) ? 'documents.html' : /repair/i.test(action) ? 'repair-history.html' : /claim/i.test(action) ? 'claims.html' : /profile/i.test(action) ? 'profile.html' : 'admin.html';
    return { key:'audit:'+id, activity:true, title:labels[action], body:'Account '+String(who).slice(0,48)+(d.claimId?' · Claim '+d.claimId:''), link:path, createdAt:a.timestamp||a.createdAt||a.created_at };
  }
  function claimItem(id, c) {
    var owner = c.userProfile && (c.userProfile.displayName || c.userProfile.email) || c.userId || 'User';
    return { key:'claim:'+id, activity:true, title:'Claim submitted', body:String(owner).slice(0,64)+' · Claim '+String(c.claimId||id).slice(0,48),
      link:'claims.html?claimId='+encodeURIComponent(id), createdAt:c.createdAt||c.created_at };
  }
  function connectAdmin() {
    if (!authUser || isAdmin || !window.fbDb) return;
    isAdmin = true; activityState = 'loading'; activitySources = {};
    // Real database documents; this stays useful even if a user's cross-account notification writes are denied.
    observeCollection('claims','createdAt',claimItem);
    observeCollection('claims','created_at',claimItem);
    observeCollection('users','createdAt',function (id, u) {
      if (String(u.role || '').toLowerCase() === 'admin') return null;
      return {key:'registration:'+id,activity:true,title:'User registered',
        body:String(u.displayName || u.email || id).slice(0,80)+' joined AssureX',
        link:'admin.html',createdAt:u.createdAt};
    });
    ['timestamp','created_at','createdAt'].forEach(function (field) { observeCollection('audit_logs',field,auditItem); });
    render();
  }
  function roleReady(role) { if (role === 'admin') connectAdmin(); }
  function connect() {
    if (!window.fbAuth || !window.DbService || typeof DbService.listenNotifications !== 'function') { inboxState = 'error'; render(); return; }
    fbAuth.onAuthStateChanged(function (user) {
      stop(); authUser = user; inbox = []; activitySources = {}; isAdmin = false; inboxState = 'loading'; activityState = 'loading';
      seenKey = 'assurex:admin-activity-seen:' + (user ? user.uid : 'guest');
      try { seen = new Set(JSON.parse(localStorage.getItem(seenKey) || '[]')); } catch (_) { seen = new Set(); }
      render(); if (!user) return;
      try { unsubs.push(DbService.listenNotifications(user.uid, function (rows) { inboxState = 'ready'; inbox = rows || []; render(); }, function (err) {
        inboxState = 'error'; console.warn('[AssureX] Notification permission:',err); render();
      })); } catch (e) { inboxState = 'error'; render(); }
      // role-guard may resolve before or after the auth callback.
      if (window.AssureXRole) roleReady(window.AssureXRole);
      else fbDb.collection('users').doc(user.uid).get().then(function (doc) {
        if (authUser && authUser.uid === user.uid && doc.exists) roleReady(String(doc.data().role || '').toLowerCase());
      }).catch(function (err) { console.warn('[AssureX] Notification role lookup:',err); });
    });
  }
  function setup() {
    var bar = document.querySelector('.topbar .topbar-actions'), top = document.querySelector('.topbar'); if (!top) return;
    if (!bar) { bar = make('div','topbar-actions'); top.append(bar); }
    var old = el('logout'); if (old && !old.classList.contains('header-signout')) {
      old.remove(); old.classList.add('header-signout'); old.setAttribute('aria-label','Sign out of AssureX');
      old.innerHTML='<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg><span>Sign out</span>'; bar.append(old);
    }
    bell = el('notifyButton'); if (!bell) { bell = make('button','icon-button notification-button','♢'); bell.id='notifyButton'; bell.type='button'; bar.insertBefore(bell,old||null); }
    bell.setAttribute('aria-label','Notifications'); bell.setAttribute('aria-expanded','false'); bell.setAttribute('aria-controls','assurexNotifications');
    bell.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg><span class="notification-count" id="assurexUnread" hidden></span>';
    panel = make('section','assurex-notifications'); panel.id='assurexNotifications'; panel.hidden=true; panel.setAttribute('aria-label','Notifications');
    var head = make('div','assurex-notify-head'); head.append(make('strong','','Notifications')); all=make('button','assurex-mark-all','Mark all read'); all.type='button'; head.append(all); panel.append(head);
    list=make('div','assurex-notify-list'); list.id='assurexNotifyList'; panel.append(list); bar.append(panel);
    bell.addEventListener('click', function (e) { e.preventDefault(); e.stopImmediatePropagation(); setOpen(); },true);
    all.addEventListener('click', async function () {
      if (!authUser) return; all.disabled=true;
      if (isAdmin) { activityRows().forEach(function (n) { seen.add(eventKey(n)); }); saveSeen(); }
      try { if (window.DbService && DbService.markAllNotificationsRead) await DbService.markAllNotificationsRead(); inbox.forEach(function (n) { n.read=true; }); }
      catch(e) { console.warn('[AssureX] Mark all read:',e); list.prepend(make('p','assurex-notify-error','Could not save all read states.')); }
      render();
    });
    document.addEventListener('click',function (e) { if(open && !panel.contains(e.target) && !bell.contains(e.target)) setOpen(false); });
    document.addEventListener('keydown',function (e) { if(e.key==='Escape' && open) { setOpen(false); bell.focus(); } });
    window.addEventListener('assurex-role-ready',function(e) { roleReady(e.detail && e.detail.role); });
    connect();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',setup); else setup();
  window.addEventListener('pagehide',stop);
})();
