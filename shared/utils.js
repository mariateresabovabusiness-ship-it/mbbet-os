// MBBET DATABASE OPERATIVO — Utility Functions

function euro(v) {
  var n = parseFloat(v||0);
  return (n < 0 ? '-' : '') + '€ ' + Math.abs(n).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2});
}
function fd(d)  { return d ? new Date(d).toLocaleDateString('it-IT') : '—'; }
function fdt(d) { return d ? new Date(d).toLocaleString('it-IT',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'}) : '—'; }
function fago(d) {
  if (!d) return '—';
  var diff = Date.now() - new Date(d).getTime();
  var days = Math.floor(diff/86400000);
  if (days === 0) return 'oggi';
  if (days === 1) return 'ieri';
  if (days < 7)  return days+'g fa';
  if (days < 30) return Math.floor(days/7)+'sett fa';
  return Math.floor(days/30)+'mesi fa';
}

function badge(stato) {
  if (!stato) return '<span class="badge b-gray">—</span>';
  var s = stato.toUpperCase();
  var c = 'b-gray';
  if (/ATTIV|COMPLET|PAGAT|OK|LIBERO|FATTO/.test(s))     c = 'b-green';
  else if (/CORSO|LAVORA|ATTESA|PROGRESS/.test(s))       c = 'b-orange';
  else if (/BLOCC|CHIUSO|SOSP|BANNAT|LIMIT|PERDIT/.test(s)) c = 'b-red';
  else if (/VERIFIC|CONTROL|REVISIO/.test(s))            c = 'b-blue';
  else if (/NUOVO|POTENZ/.test(s))                        c = 'b-purple';
  return '<span class="badge '+c+'">'+stato+'</span>';
}

function tierBadge(t) {
  var m = {'S+':'b-purple','S':'b-gold','A':'b-blue','B':'b-green','C':'b-gray','D':'b-red'};
  return '<span class="badge '+(m[t]||'b-gray')+'">'+t+'</span>';
}

function roleBadge(r) {
  var m = {
    SOCIO_ADMIN:'r-socio-admin', SOCIO:'r-socio', OPERATORE:'r-operatore',
    COLLAB:'r-collab', REFERRAL:'r-referral', VIEWER:'r-viewer', ADMIN_TECNICO:'r-admin-tecnico'
  };
  var label = (ROLE_LABELS && ROLE_LABELS[r]) || r;
  return '<span class="role-tag '+(m[r]||'r-viewer')+'">'+label+'</span>';
}

function opColor(nome) {
  var m = {Mary:'#f59e0b',Manuele:'#3b82f6',Serena:'#8b5cf6',Samuele:'#10b981'};
  return m[nome] || '#6b7280';
}

function avatar(nome, size) {
  var s = size||28;
  var bg = opColor(nome);
  return '<div class="av" style="width:'+s+'px;height:'+s+'px;background:'+bg+';font-size:'+(s*0.45)+'px">'+
    (nome||'?').charAt(0).toUpperCase()+'</div>';
}

function toast(msg, type) {
  var el = document.createElement('div');
  el.className = 'toast t-'+(type||'info');
  el.textContent = msg;
  var c = document.getElementById('toasts');
  if (!c) { c = document.createElement('div'); c.id = 'toasts'; document.body.appendChild(c); }
  c.appendChild(el);
  setTimeout(function(){ el.remove(); }, 3500);
}

async function nextId(table, prefix, pad) {
  var res = await db.from(table).select('id').order('created_at',{ascending:false}).limit(300);
  if (!res.data||!res.data.length) return prefix+'-'+'1'.padStart(pad,'0');
  var nums = res.data.map(function(r){
    var m = String(r.id).match(/(\d+)$/); return m?parseInt(m[1]):0;
  });
  return prefix+'-'+String(Math.max.apply(null,nums)+1).padStart(pad,'0');
}

function escHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id){ document.getElementById(id).classList.remove('open'); }

function setView(id, html) {
  var el = document.getElementById(id);
  if (el) el.innerHTML = html;
}
function loadingHtml(msg) {
  return '<div class="state-box"><div class="spinner"></div>'+(msg||'Caricamento...')+'</div>';
}
function emptyHtml(icon, msg) {
  return '<div class="state-box"><div class="state-icon">'+(icon||'📭')+'</div><div class="state-msg">'+(msg||'Nessun dato')+'</div></div>';
}
function errorHtml(msg) {
  return '<div class="state-box state-err"><div class="state-icon">⚠️</div><div class="state-msg">'+(msg||'Errore')+'</div></div>';
}

// Debounce per ricerca
function debounce(fn, delay) {
  var t;
  return function() {
    var args = arguments, ctx = this;
    clearTimeout(t);
    t = setTimeout(function(){ fn.apply(ctx, args); }, delay||300);
  };
}
