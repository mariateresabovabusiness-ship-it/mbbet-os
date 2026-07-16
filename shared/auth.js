// MBBET OS — Auth v4
var SUPA_URL  = 'https://ntwqfuvcosvzpqrfpipn.supabase.co';
var SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50d3FmdXZjb3N2enBxcmZwaXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NTQzNzYsImV4cCI6MjA5ODQzMDM3Nn0.i_JkizD5xMQBNYi0W8T_1lY0jO8vPJPYUajWm-jjODg';
try {
  for (var _i = localStorage.length - 1; _i >= 0; _i--) {
    var _k = localStorage.key(_i);
    if (_k && _k.indexOf('sb-') === 0 && _k.indexOf('auth-token') !== -1) localStorage.removeItem(_k);
  }
} catch(e) {}
var db = supabase.createClient(SUPA_URL, SUPA_ANON);

var LOCAL_USERS = {
  'mariateresabova.business@gmail.com': { password: 'Luna2002@',  nome: 'Mary Bova', ruolo: 'SOCIO_ADMIN' },
  'manuele@mbbet.it':         { password: 'Mbbet2024!', nome: 'Manuele',   ruolo: 'SOCIO' },
  'serena@mbbet.it':          { password: 'Mbbet2024!', nome: 'Serena',    ruolo: 'OPERATORE' },
  'samuele@mbbet.it':         { password: 'Mbbet2024!', nome: 'Samuele',   ruolo: 'COLLAB' },
  'alan@mbbet.it':            { password: 'Mbbet2026!', nome: 'Alan', ruolo: 'COLLAB_SELF', collabNome: 'Alan' },
  'isma@mbbet.it':            { password: 'Mbbet2026!', nome: 'Isma', ruolo: 'COLLAB_SELF', collabNome: 'Isma' },
  'lorenzo@mbbet.it':         { password: 'Mbbet2026!', nome: 'Lorenzo Cestola', ruolo: 'COLLAB_SELF', collabNome: 'Lorenzo Cestola' }
};

var SESSION_KEY = 'mbbet_v2_session';
var currentUser = null;
var currentRole = 'VIEWER';
var currentNome = '';
var currentCollabNome = '';

var ROLE_SECTIONS = {
  'SOCIO_ADMIN':   ['clienti','bonus','team','finanze','documenti','task','report','config','social','email','collab','coda'],
  'SOCIO':         ['clienti','bonus','team','finanze','documenti','task','report','social','email','collab','coda'],
  'OPERATORE':     ['clienti','bonus','task','social','collab','coda'],
  'COLLAB':        ['clienti','bonus','social','collab'],
  'COLLAB_SELF':   ['collab'],
  'REFERRAL':      ['report'],
  'VIEWER':        ['clienti'],
  'ADMIN_TECNICO': ['clienti','bonus','team','finanze','documenti','task','report','config','social','email','collab','coda']
};

var ROLE_LABELS  = {'SOCIO_ADMIN':'Socio Admin','SOCIO':'Socio','OPERATORE':'Operatore','COLLAB':'Collab','COLLAB_SELF':'Collaboratore','REFERRAL':'Referral','VIEWER':'Viewer','ADMIN_TECNICO':'Admin Tecnico'};
var ROLE_COLORS  = {'SOCIO_ADMIN':'#f59e0b','SOCIO':'#d97706','OPERATORE':'#3b82f6','COLLAB':'#a78bfa','COLLAB_SELF':'#22c55e','REFERRAL':'#10b981','VIEWER':'#6b7280','ADMIN_TECNICO':'#ef4444'};

// ── Leggi sessione: prima da URL hash, poi da localStorage ──────────────────
function _readSession() {
  // Prova hash (#mbbet=base64)
  try {
    var h = window.location.hash || '';
    if (h.indexOf('#mbbet=') === 0) {
      var s = JSON.parse(decodeURIComponent(atob(h.slice(7))));
      if (s && s.email && s.ruolo) {
        try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch(e) {}
        try { history.replaceState(null, '', window.location.pathname); } catch(e) {}
        return s;
      }
    }
  } catch(e) {}
  // Prova localStorage
  try {
    var r = localStorage.getItem(SESSION_KEY);
    if (r) { var s2 = JSON.parse(r); if (s2 && s2.email && s2.ruolo) return s2; }
  } catch(e) {}
  return null;
}

// ── Init Auth ────────────────────────────────────────────────────────────────
function initAuth(onSuccess, onFail) {
  var s = _readSession();
  if (s) {
    currentUser = { email: s.email };
    currentNome = s.nome || s.email;
    currentRole = s.ruolo || 'VIEWER';
    currentCollabNome = s.collabNome || '';
    if (onSuccess) { onSuccess(); return; }
  }
  if (onFail) onFail();
}

// ── Login / Logout ───────────────────────────────────────────────────────────
function doLogin(email, password) {
  var key = (email || '').toLowerCase().trim();
  var u = LOCAL_USERS[key];
  if (!u) return { error: 'Email non trovata' };
  if (u.password !== password) return { error: 'Password non corretta' };
  currentUser = { email: key };
  currentNome = u.nome;
  currentRole = u.ruolo;
  currentCollabNome = u.collabNome || '';
  try { localStorage.setItem(SESSION_KEY, JSON.stringify({ email: key, nome: u.nome, ruolo: u.ruolo, collabNome: u.collabNome || '' })); } catch(e) {}
  return { data: { user: currentUser } };
}

function doLogout() {
  try { localStorage.removeItem(SESSION_KEY); } catch(e) {}
  currentUser = null; currentRole = 'VIEWER'; currentNome = ''; currentCollabNome = '';
  window.location.href = 'index.html';
}

// ── Navigazione con sessione nel hash ────────────────────────────────────────
function navTo(url) {
  var raw = null;
  // Prima prova localStorage
  try { raw = localStorage.getItem(SESSION_KEY); } catch(e) {}
  // Fallback: usa currentUser in memoria
  if (!raw && currentUser) {
    try { raw = JSON.stringify({ email: currentUser.email, nome: currentNome, ruolo: currentRole, collabNome: currentCollabNome }); } catch(e) {}
  }
  if (raw) {
    try {
      window.location.href = url + '#mbbet=' + btoa(encodeURIComponent(raw));
      return;
    } catch(e) {}
  }
  window.location.href = url;
}

// ── Permessi ─────────────────────────────────────────────────────────────────
function canAccess(s) { return (ROLE_SECTIONS[currentRole] || []).indexOf(s) >= 0; }
function requireSection(s) {
  if (canAccess(s)) return true;
  alert('Non hai i permessi per accedere a questa sezione.');
  window.location.href = 'index.html';
  return false;
}
function isSocioAdmin() { return currentRole === 'SOCIO_ADMIN'; }
function isSocio()      { return currentRole === 'SOCIO_ADMIN' || currentRole === 'SOCIO'; }
function canWrite()     { return ['SOCIO_ADMIN','SOCIO','OPERATORE','ADMIN_TECNICO'].indexOf(currentRole) >= 0; }
function canDelete()    { return currentRole === 'SOCIO_ADMIN' || currentRole === 'ADMIN_TECNICO'; }
function seeFinanze()   { return ['SOCIO_ADMIN','SOCIO','ADMIN_TECNICO'].indexOf(currentRole) >= 0; }
function isReadOnlyCollab() { return currentRole === 'COLLAB_SELF'; }
