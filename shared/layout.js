// MBBET DATABASE OPERATIVO — Layout & Navigazione

/* Nota: solo le sezioni con una pagina reale nel progetto sono elencate qui.
   'documenti'/'task'/'report'/'config' non hanno ancora una pagina dedicata
   (stesso stato in tutto il resto dell'app — non li invento qui). */
var NAV_ITEMS = [
  { section:'clienti',  icon:'👥', label:'CRM Clienti',   file:'01_clienti.html' },
  { section:'bonus',    icon:'🎰', label:'Bonus',          file:'02_bonus.html' },
  { section:'team',     icon:'👔', label:'Team MBBET',     file:'03_team.html' },
  { section:'finanze',  icon:'💰', label:'Finanze',        file:'04_finanze.html' },
  { section:'social',   icon:'📱', label:'Social MBBET',   file:'09_social.html' }
];

function buildSidebar(activeSection) {
  var h = '';
  h += '<div class="sb-logo">';
  h += '<h1>🎯 MBBET</h1>';
  h += '<small>Database Operativo</small>';
  h += '</div>';
  h += '<div class="sb-user">';
  h += avatar(currentNome, 30);
  h += '<div class="sb-user-info">';
  h += '<div class="name">' + escHtml(currentNome) + '</div>';
  h += roleBadge(currentRole);
  h += '</div></div>';
  h += '<div class="nav-section">';
  h += '<a class="nav-item'+(activeSection==='hub'?' active':'')+'" href="index.html"><span class="nav-icon">🏠</span>Hub Centrale</a>';
  h += '</div>';
  h += '<div class="nav-section">';
  h += '<div class="nav-label">Sezioni</div>';
  NAV_ITEMS.forEach(function(item) {
    if (!canAccess(item.section)) return;
    var active = activeSection === item.section ? ' active' : '';
    h += '<a class="nav-item'+active+'" href="'+item.file+'">';
    h += '<span class="nav-icon">'+item.icon+'</span>';
    h += item.label;
    h += '</a>';
  });
  h += '</div>';
  h += '<div class="sb-logout">';
  h += '<button class="btn-logout" onclick="doLogout()">🚪 Esci — '+escHtml(currentNome)+'</button>';
  h += '</div>';
  return h;
}

function buildTopbar(title, actions) {
  var h = '<div class="topbar">';
  h += '<div class="topbar-title">'+escHtml(title)+'</div>';
  h += '<div class="topbar-actions">';
  h += '<span class="rt-dot" id="rt-dot"></span>';
  h += '<div style="position:relative">';
  h += '<div class="notif-btn" onclick="toggleNotif()" id="notif-btn">🔔';
  h += '<div class="notif-dot" id="notif-dot"></div></div>';
  h += '<div class="notif-panel" id="notif-panel">';
  h += '<div class="notif-panel-header"><span>Notifiche</span>';
  h += '<button class="btn btn-sm btn-ghost" onclick="markAllRead()">Leggi tutte</button></div>';
  h += '<div id="notif-list"></div></div></div>';
  if (actions) h += actions;
  h += '</div></div>';
  return h;
}

function initLayout(activeSection, pageTitle, topbarActions) {
  document.getElementById('sidebar').innerHTML = buildSidebar(activeSection);
  document.getElementById('topbar').innerHTML  = buildTopbar(pageTitle, topbarActions);
  initNotifPanel();
  loadNotifCount();
  initRealtimeDot();
}

// ── NOTIFICHE ─────────────────────────────────────────────────────────────
function toggleNotif() {
  var p = document.getElementById('notif-panel');
  if (p.classList.contains('open')) { p.classList.remove('open'); return; }
  p.classList.add('open');
  loadNotifPanel();
  setTimeout(function() {
    document.addEventListener('click', function close(e) {
      if (!p.contains(e.target) && !document.getElementById('notif-btn').contains(e.target)) {
        p.classList.remove('open');
        document.removeEventListener('click', close);
      }
    });
  }, 0);
}

function initNotifPanel() {}

async function loadNotifCount() {
  var r = await db.from('notifiche').select('id',{count:'exact'}).eq('letto',false);
  var n = r.count || 0;
  var dot = document.getElementById('notif-dot');
  if (!dot) return;
  dot.textContent = n > 9 ? '9+' : n;
  dot.className = 'notif-dot' + (n > 0 ? ' visible' : '');
}

// Trasforma gli URL http(s) dentro un testo già passato per escHtml in link
// cliccabili — sicuro perché opera solo dopo l'escaping, non prima.
function linkifyHtml(escaped) {
  return escaped.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
}

async function loadNotifPanel() {
  var r = await db.from('notifiche').select('*').order('created_at',{ascending:false}).limit(25);
  var items = r.data || [];
  var el = document.getElementById('notif-list');
  if (!el) return;
  if (!items.length) { el.innerHTML = '<div class="state-box" style="padding:24px">Nessuna notifica</div>'; return; }
  var h = '';
  items.forEach(function(n) {
    var cls = n.letto ? '' : (n.priorita === 'Alta' ? ' unread-red' : ' unread');
    var ts = fdt(n.created_at);
    h += '<div class="notif-item'+cls+'" onclick="markRead('+n.id+')">';
    h += '<div class="notif-item-title">['+escHtml(n.tipo)+'] '+escHtml(n.titolo)+'</div>';
    if (n.messaggio) h += '<div class="notif-item-msg">'+linkifyHtml(escHtml(n.messaggio))+'</div>';
    h += '<div class="notif-item-ts">'+ts+'</div></div>';
  });
  el.innerHTML = h;
}

async function markRead(id) {
  await db.from('notifiche').update({letto:true}).eq('id',id);
  loadNotifCount();
  loadNotifPanel();
}

async function markAllRead() {
  await db.from('notifiche').update({letto:true}).eq('letto',false);
  loadNotifCount();
  loadNotifPanel();
}

async function addNotif(tipo, titolo, msg, priorita, dest) {
  await db.from('notifiche').insert({
    tipo: tipo, titolo: titolo, messaggio: msg||null,
    priorita: priorita||'Bassa', destinatario: dest||null, letto: false
  });
}

// ── REALTIME DOT ──────────────────────────────────────────────────────────
var _rtChannel = null;
function initRealtimeDot() {
  var dot = document.getElementById('rt-dot');
  if (!dot) return;
  if (_rtChannel) { db.removeChannel(_rtChannel); _rtChannel = null; }
  _rtChannel = db.channel('mbbet-rt')
    .on('postgres_changes',{event:'*',schema:'public',table:'notifiche'}, function() {
      loadNotifCount();
    })
    .subscribe(function(status) {
      if (!dot) return;
      if (status === 'SUBSCRIBED') {
        dot.style.background = 'var(--green)';
        dot.title = 'Real-time connesso';
      } else if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
        dot.style.background = 'var(--red)';
        dot.title = 'Real-time offline';
      } else {
        dot.style.background = 'var(--orange)';
        dot.title = 'Connessione...';
      }
    });
}
