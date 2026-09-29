/* Render the real notification stream in the dashboard alert card, reusing navbar data. */
(function () {
  'use strict';
  function text(v) { return String(v == null ? '' : v); }
  function init() {
    var feed = document.getElementById('notificationFeed'), total = document.getElementById('notificationCount');
    if (!feed || !total) return;
    window.addEventListener('assurex-notifications-update', function (event) {
      var detail = event.detail || {}, rows = detail.items || [];
      total.textContent = rows.length + ' recent notification' + (rows.length === 1 ? '' : 's');
      feed.replaceChildren();
      if (!rows.length) { var empty=document.createElement('p'); empty.textContent='No notifications yet.'; feed.append(empty); return; }
      rows.slice(0,6).forEach(function (item) {
        var card=document.createElement('a'); card.className='ax-live-alert';
        var path = text(item.link);
        // Never use arbitrary href data from Firestore.
        if (/^[a-z-]+\.html(?:\?[a-zA-Z0-9=&%._-]+)?$/.test(path)) card.href=path;
        else card.href='#notificationFeed';
        var title=document.createElement('strong');title.textContent=text(item.title||'Notification');
        var body=document.createElement('span');body.textContent=text(item.body||'');
        card.append(title,body); if(item.unread) card.classList.add('unread'); feed.append(card);
      });
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
