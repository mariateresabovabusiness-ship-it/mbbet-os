// MBBET SOCIAL OS — Data Layer
// Ogni query Supabase del modulo Social passa da qui.
// Nessuna logica di rendering in questo file, solo accesso dati.

// Formatta una data in YYYY-MM-DD usando i componenti LOCALI (mai toISOString():
// converte in UTC e in fusi avanti rispetto a UTC, come l'Italia, sposta la data
// indietro di un giorno — bug reale trovato e corretto in questa sessione).
function ymd(d) {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

async function sdFetchPostsForCalendar(startIso, endIso) {
  return db.from('social_posts')
    .select('id,titolo,stato,tipo_contenuto,data_pubblicazione')
    .gte('data_pubblicazione', startIso).lte('data_pubblicazione', endIso);
}

async function sdFetchContenuti(filters) {
  var q = db.from('social_posts')
    .select('id,titolo,tipo_contenuto,assegnato_a,data_pubblicazione,stato,livello_rischio')
    .order('created_at', {ascending:false}).limit(100);
  if (filters.stato)   q = q.eq('stato', filters.stato);
  if (filters.tipo)    q = q.eq('tipo_contenuto', filters.tipo);
  if (filters.autore)  q = q.eq('assegnato_a', filters.autore);
  if (filters.rischio) q = q.eq('livello_rischio', filters.rischio);
  return q;
}

async function sdFetchPostById(id) {
  return db.from('social_posts').select('*').eq('id', id).single();
}

async function sdSavePost(payload, editingId) {
  if (editingId) return db.from('social_posts').update(payload).eq('id', editingId);
  return db.from('social_posts').insert(payload);
}

async function sdFetchAllPosts() {
  // select('*') invece di elencare colonne: alcune (pillar, risultato...) sono
  // aggiunte dalla migration_social_os_v1.sql e potrebbero non esistere ancora.
  return db.from('social_posts').select('*').order('created_at', {ascending:true});
}

async function sdFetchRiskWords() {
  return db.from('social_risk_words').select('*').eq('attiva', true);
}

async function sdFetchContentIdeas() {
  return db.from('social_content_ideas').select('*').order('settimana_piano,created_at');
}

async function sdGetConfig(chiave) {
  return db.from('config').select('valore').eq('chiave', chiave).maybeSingle();
}

async function sdSetConfig(chiave, valore) {
  return db.from('config').upsert({chiave: chiave, valore: String(valore)}, {onConflict: 'chiave'});
}

// ── ARIA insights ────────────────────────────────────────────────────
async function sdFetchInsights(stato) {
  var q = db.from('social_ai_insights').select('*').order('created_at', {ascending:false});
  if (stato) q = q.eq('stato', stato);
  return q;
}

async function sdInsertInsight(insight) {
  return db.from('social_ai_insights').insert(insight).select();
}

async function sdUpdateInsightStato(id, stato, extra) {
  var payload = Object.assign({stato: stato, risolto_at: (stato !== 'nuovo' ? new Date().toISOString() : null)}, extra || {});
  return db.from('social_ai_insights').update(payload).eq('id', id);
}

async function sdInsertTaskFromInsight(insight) {
  var id = 'TSK-' + Date.now();
  var payload = {
    id: id, tipo: 'Social', descrizione: insight.azione_consigliata || insight.titolo,
    operatore: null, priorita: insight.urgenza === 'alta' ? 'Alta' : 'Media',
    stato: 'Aperto', note: insight.descrizione || null, data_creazione: new Date().toISOString()
  };
  var r = await db.from('task').insert(payload);
  if (r.error) return r;
  return {data: {id: id}, error: null};
}

async function sdInsertIdeaFromInsight(insight) {
  var payload = {
    titolo: insight.titolo, descrizione: insight.descrizione,
    tipo: 'POST', obiettivo: null, origine: 'aria_insight',
    settimana_piano: 1, priorita: insight.urgenza === 'alta' ? 'alta' : 'media'
  };
  return db.from('social_content_ideas').insert(payload).select();
}
