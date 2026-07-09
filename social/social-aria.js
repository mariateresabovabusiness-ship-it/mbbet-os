// MBBET SOCIAL OS — ARIA Social Intelligence Engine
// Motore di regole (NON un modello linguistico): analizza dati reali
// del modulo Social e produce insight persistiti in social_ai_insights.
// Ogni insight dichiara esplicitamente il tipo di dato usato:
// DATO_REALE / REGOLA_EURISTICA / STIMA / DATO_NON_DISPONIBILE.

var ARIA_MIN_SAMPLE_CONTENT_DNA = 5;

async function ariaComputeInsights() {
  var rPosts = await sdFetchAllPosts();
  var posts = rPosts.data || [];
  var rIdeas = await sdFetchContentIdeas();
  var ideas = rIdeas.data || [];
  // Controllo duplicati su TUTTI gli insight passati (non solo "nuovo"): un
  // insight già accettato/ignorato non deve essere ricreato identico al giro dopo.
  var rExisting = await sdFetchInsights();
  var existing = rExisting.data || [];
  var existingKeys = {};
  existing.forEach(function(e){ existingKeys[e.categoria+'|'+e.titolo] = true; });

  var candidates = [];
  var oggi = Date.now();
  var oggiIso = ymd(new Date());

  // Regola 0 — contenuti di oggi ancora da preparare (non ancora avanzati dalla fase "Idea")
  var daPrepareOggi = posts.filter(function(p){
    return p.data_pubblicazione === oggiIso && p.stato === 'IDEA';
  });
  if (daPrepareOggi.length > 0) {
    candidates.push({
      categoria: 'OPERATIONS',
      titolo: daPrepareOggi.length + ' content' + (daPrepareOggi.length===1?'o di oggi da preparare':'i di oggi da preparare') + ' ('+new Date(oggiIso+'T00:00:00').toLocaleDateString('it-IT')+')',
      descrizione: daPrepareOggi.map(function(p){ return p.titolo; }).join(', '),
      motivazione: 'Sono programmati per oggi ma sono ancora fermi in stato "Idea": nessuno ha iniziato a scriverli o registrarli.',
      evidenze: {contenuti: daPrepareOggi.map(function(p){ return {id:p.id, titolo:p.titolo, assegnato_a:p.assegnato_a}; })},
      tipo_dato: 'DATO_REALE',
      urgenza: 'alta',
      azione_consigliata: 'Apri il calendario di oggi e fai avanzare questi contenuti (script, registrazione, montaggio).'
    });
  }

  // Regola 1 — calendario vuoto nei prossimi 7 giorni
  var prossimi7 = posts.filter(function(p){
    if (!p.data_pubblicazione) return false;
    var diff = (new Date(p.data_pubblicazione).getTime() - oggi) / 86400000;
    return diff >= 0 && diff <= 7;
  });
  if (prossimi7.length === 0) {
    candidates.push({
      categoria: 'OPPORTUNITY',
      titolo: 'Nessun contenuto programmato nei prossimi 7 giorni',
      descrizione: 'Il calendario editoriale è vuoto per la prossima settimana.',
      motivazione: 'Trovati 0 contenuti con data di pubblicazione nei prossimi 7 giorni, su ' + posts.length + ' contenuti totali nel sistema.',
      evidenze: {contenuti_prossimi_7gg: 0, totale_contenuti: posts.length},
      tipo_dato: 'DATO_REALE',
      urgenza: 'alta',
      azione_consigliata: 'Programma almeno un contenuto per i prossimi giorni.'
    });
  }

  // Regola 2 — contenuti fermi in uno stato non-finale da 3+ giorni
  var STATI_FINALI = ['PUBBLICATO','SCARTATO'];
  var fermi = posts.filter(function(p){
    if (STATI_FINALI.indexOf(p.stato) >= 0) return false;
    var ref = p.updated_at || p.created_at;
    if (!ref) return false;
    return (oggi - new Date(ref).getTime()) / 86400000 >= 3;
  });
  if (fermi.length > 0) {
    candidates.push({
      categoria: 'WARNING',
      titolo: fermi.length + (fermi.length === 1 ? ' contenuto fermo' : ' contenuti fermi') + ' da più di 3 giorni',
      descrizione: fermi.map(function(p){ return p.titolo; }).slice(0,5).join(', '),
      motivazione: 'Questi contenuti non hanno cambiato stato da almeno 3 giorni: rischiano di restare bloccati nella pipeline.',
      evidenze: {contenuti: fermi.map(function(p){ return {id:p.id, titolo:p.titolo, stato:p.stato}; })},
      tipo_dato: 'DATO_REALE',
      urgenza: 'media',
      azione_consigliata: 'Controlla questi contenuti e sblocca chi è responsabile.'
    });
  }

  // Regola 3 — idee ad alto potenziale mai trasformate, ferme da 7+ giorni
  var titoliUsati = {};
  posts.forEach(function(p){ if (p.titolo) titoliUsati[p.titolo] = true; });
  var ideeAlte = ideas.filter(function(i){
    if (titoliUsati[i.titolo]) return false;
    if (i.potenziale !== 'alto') return false;
    if (!i.created_at) return false;
    return (oggi - new Date(i.created_at).getTime()) / 86400000 >= 7;
  });
  if (ideeAlte.length > 0) {
    candidates.push({
      categoria: 'IDEA',
      titolo: ideeAlte.length + (ideeAlte.length === 1 ? ' idea' : ' idee') + ' ad alto potenziale ferma da oltre 7 giorni',
      descrizione: ideeAlte.map(function(i){ return i.titolo; }).slice(0,5).join(', '),
      motivazione: 'Queste idee sono segnate a potenziale alto nel Piano Editoriale ma non sono ancora diventate contenuti.',
      evidenze: {idee: ideeAlte.map(function(i){ return {id:i.id, titolo:i.titolo}; })},
      tipo_dato: 'DATO_REALE',
      urgenza: 'media',
      azione_consigliata: 'Trasforma una di queste idee in un contenuto questa settimana.'
    });
  }

  // Regola 4 — squilibrio di formato (solo con campione sufficiente)
  if (posts.length >= ARIA_MIN_SAMPLE_CONTENT_DNA) {
    var perTipo = {};
    posts.forEach(function(p){ var t = p.tipo_contenuto || '—'; perTipo[t] = (perTipo[t]||0)+1; });
    var topTipo = Object.keys(perTipo).reduce(function(a,b){ return perTipo[a] > perTipo[b] ? a : b; });
    var pct = Math.round(perTipo[topTipo] / posts.length * 100);
    if (pct >= 70) {
      candidates.push({
        categoria: 'CONTENT',
        titolo: 'Il ' + pct + '% dei contenuti è di tipo ' + topTipo,
        descrizione: 'Poca varietà di formato nei contenuti registrati.',
        motivazione: 'Su ' + posts.length + ' contenuti totali, ' + perTipo[topTipo] + ' sono di tipo "' + topTipo + '".',
        evidenze: {distribuzione: perTipo},
        tipo_dato: 'DATO_REALE',
        urgenza: 'bassa',
        azione_consigliata: 'Prova un formato diverso per variare il piano editoriale.'
      });
    }
  }

  // Regola 5 — pubblicati ma mai analizzati
  var nonAnalizzati = posts.filter(function(p){ return p.stato === 'PUBBLICATO' && !p.risultato; });
  if (nonAnalizzati.length > 0) {
    candidates.push({
      categoria: 'OPERATIONS',
      titolo: nonAnalizzati.length + (nonAnalizzati.length === 1 ? ' contenuto pubblicato mai analizzato' : ' contenuti pubblicati mai analizzati'),
      descrizione: nonAnalizzati.map(function(p){ return p.titolo; }).slice(0,5).join(', '),
      motivazione: 'Contenuti già pubblicati senza un risultato/analisi registrata.',
      evidenze: {contenuti: nonAnalizzati.map(function(p){ return {id:p.id, titolo:p.titolo}; })},
      tipo_dato: 'DATO_REALE',
      urgenza: 'bassa',
      azione_consigliata: 'Apri ogni contenuto pubblicato e registra il risultato ottenuto.'
    });
  }

  // Regola 6 — Reel e Post/Carosello dello stesso giorno troppo simili (fotocopie)
  var ARIA_STOP = {di:1,e:1,il:1,la:1,le:1,un:1,una:1,per:1,che:1,non:1,ci:1,ti:1,tu:1,noi:1,con:1,se:1,da:1,del:1,della:1,dei:1,cosa:1,come:1,più:1,ha:1,ai:1,al:1,in:1,a:1,ma:1,sono:1,anche:1};
  function ariaKeywords(s) {
    return (s||'').toLowerCase().replace(/[^\wàèéìòù\s]/g,'').split(/\s+/).filter(function(w){ return w.length>3 && !ARIA_STOP[w]; });
  }
  function ariaOverlap(a,b) {
    var wa=ariaKeywords(a), wb=ariaKeywords(b);
    if(!wa.length||!wb.length) return 0;
    var setB={}; wb.forEach(function(w){ setB[w]=1; });
    var common=wa.filter(function(w){ return setB[w]; }).length;
    return common/Math.min(wa.length,wb.length);
  }
  var postsPerGiorno = {};
  posts.forEach(function(p){
    if (!p.data_pubblicazione) return;
    (postsPerGiorno[p.data_pubblicazione] = postsPerGiorno[p.data_pubblicazione] || []).push(p);
  });
  var fotocopie = [];
  Object.keys(postsPerGiorno).forEach(function(giorno){
    var delGiorno = postsPerGiorno[giorno];
    var reel = delGiorno.filter(function(p){ return p.tipo_contenuto==='REEL'; });
    var altri = delGiorno.filter(function(p){ return p.tipo_contenuto==='POST'||p.tipo_contenuto==='CAROSELLO'; });
    reel.forEach(function(r){
      altri.forEach(function(o){
        if (ariaOverlap(r.titolo, o.titolo) >= 0.5) {
          fotocopie.push({giorno:giorno, titoli:[r.titolo, o.titolo]});
        }
      });
    });
  });
  if (fotocopie.length > 0) {
    candidates.push({
      categoria: 'CONTENT',
      titolo: fotocopie.length + (fotocopie.length===1 ? ' contenuto sembra una fotocopia' : ' contenuti sembrano fotocopie') + ' dello stesso giorno',
      descrizione: fotocopie.map(function(f){ return f.titoli.join(' / '); }).slice(0,5).join('; '),
      motivazione: 'Reel e Post/Carosello dello stesso giorno hanno titoli troppo simili: rischiano di essere percepiti come lo stesso contenuto ripetuto due volte.',
      evidenze: {fotocopie: fotocopie},
      tipo_dato: 'DATO_REALE',
      urgenza: 'media',
      azione_consigliata: 'Cambia l\'angolazione di uno dei due contenuti (obiettivo, formato o dettaglio) prima di pubblicarli.'
    });
  }

  var nuoviInseriti = 0;
  for (var i=0; i<candidates.length; i++) {
    var c = candidates[i];
    var key = c.categoria + '|' + c.titolo;
    if (existingKeys[key]) continue;
    var r = await sdInsertInsight(c);
    if (!r.error) nuoviInseriti++;
  }

  var rAll = await sdFetchInsights('nuovo');
  return {insights: rAll.data || [], nuovi: nuoviInseriti, totaleContenuti: posts.length, totaleIdee: ideas.length};
}
