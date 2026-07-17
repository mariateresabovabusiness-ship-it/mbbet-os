// MBBET OS — Auth v5 (Supabase Auth reale, Fase 1)
var SUPA_URL  = 'https://ntwqfuvcosvzpqrfpipn.supabase.co';
var SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50d3FmdXZjb3N2enBxcmZwaXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NTQzNzYsImV4cCI6MjA5ODQzMDM3Nn0.i_JkizD5xMQBNYi0W8T_1lY0jO8vPJPYUajWm-jjODg';
var db = supabase.createClient(SUPA_URL, SUPA_ANON);

var currentUser = null;
var currentRole = 'VIEWER';
var currentNome = '';
var currentCollabNome = '';

var ROLE_SECTIONS = {
  'SOCIO_ADMIN':   ['clienti','bonus','team','finanze','documenti','task','report','config','social','email','collab','coda','import'],
  'SOCIO':         ['clienti','bonus','team','finanze','documenti','task','report','social','email','collab','coda','import'],
  'OPERATORE':     ['clienti','bonus','task','social','collab','coda'],
  'COLLAB':        ['clienti','bonus','social','collab'],
  'COLLAB_SELF':   ['collab'],
  'REFERRAL':      ['report'],
  'VIEWER':        ['clienti'],
  'ADMIN_TECNICO': ['clienti','bonus','team','finanze','documenti','task','report','config','social','email','collab','coda','import']
};

var ROLE_LABELS  = {'SOCIO_ADMIN':'Socio Admin','SOCIO':'Socio','OPERATORE':'Operatore','COLLAB':'Collab','COLLAB_SELF':'Collaboratore','REFERRAL':'Referral','VIEWER':'Viewer','ADMIN_TECNICO':'Admin Tecnico'};
var ROLE_COLORS  = {'SOCIO_ADMIN':'#f59e0b','SOCIO':'#d97706','OPERATORE':'#3b82f6','COLLAB':'#a78bfa','COLLAB_SELF':'#22c55e','REFERRAL':'#10b981','VIEWER':'#6b7280','ADMIN_TECNICO':'#ef4444'};

// ── Legge il profilo (ruolo/nome/collab) dell'utente autenticato da utenti_crm ──
async function _loadProfile(authUser) {
  var r = await db.from('utenti_crm')
    .select('nome,ruolo,attivo,collab:collab_id(nome)')
    .eq('auth_user_id', authUser.id)
    .maybeSingle();
  if (r.error || !r.data || !r.data.attivo) return null;
  return {
    email: authUser.email,
    nome: r.data.nome,
    ruolo: r.data.ruolo,
    collabNome: (r.data.collab && r.data.collab.nome) || ''
  };
}

// ── Init Auth: legge la sessione reale già persistita da Supabase ───────────
// Nota: onSuccess/onFail vengono chiamati FUORI dal try — un errore dentro
// boot() (onSuccess) non deve mai essere scambiato per un fallimento di login.
async function initAuth(onSuccess, onFail) {
  var profile = null;
  try {
    var s = await db.auth.getSession();
    var session = s.data && s.data.session;
    if (session && session.user) {
      profile = await _loadProfile(session.user);
    }
  } catch (e) { profile = null; }
  if (profile) {
    currentUser = { email: profile.email };
    currentNome = profile.nome || profile.email;
    currentRole = profile.ruolo || 'VIEWER';
    currentCollabNome = profile.collabNome || '';
    if (onSuccess) onSuccess();
  } else {
    if (onFail) onFail();
  }
}

// ── Login / Logout ───────────────────────────────────────────────────────────
async function doLogin(email, password) {
  var key = (email || '').toLowerCase().trim();
  var r = await db.auth.signInWithPassword({ email: key, password: password });
  if (r.error) return { error: 'Email o password non corretta.' };
  var profile = await _loadProfile(r.data.user);
  if (!profile) {
    try { await db.auth.signOut(); } catch (e) {}
    return { error: 'Utente non abilitato per questa applicazione.' };
  }
  currentUser = { email: profile.email };
  currentNome = profile.nome;
  currentRole = profile.ruolo;
  currentCollabNome = profile.collabNome || '';
  return { data: { user: currentUser } };
}

async function doLogout() {
  try { await db.auth.signOut(); } catch (e) {}
  currentUser = null; currentRole = 'VIEWER'; currentNome = ''; currentCollabNome = '';
  window.location.href = 'index.html';
}

// ── Navigazione: la sessione Supabase persiste da sola in localStorage ──────
function navTo(url) {
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
