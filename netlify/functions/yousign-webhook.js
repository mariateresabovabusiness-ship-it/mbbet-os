// Netlify Function — riceve i webhook da Yousign (produzione) quando un
// contratto viene inviato, firmato, rifiutato o scade, e tiene sincronizzata
// la tabella contratti. I contratti si creano direttamente su Yousign.com
// (non dentro MBBET OS), quindi se arriva un evento per un
// yousign_request_id che non conosciamo ancora, lo recuperiamo dall'API
// Yousign e creiamo la riga qui invece di limitarci ad aggiornarla.
// Autenticità verificata con la firma HMAC-SHA256 che Yousign manda
// nell'header X-Yousign-Signature-256 (vedi developers.yousign.com/docs/webhooks).

const crypto = require('crypto');

const SUPA_URL = 'https://ntwqfuvcosvzpqrfpipn.supabase.co';
const SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50d3FmdXZjb3N2enBxcmZwaXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NTQzNzYsImV4cCI6MjA5ODQzMDM3Nn0.i_JkizD5xMQBNYi0W8T_1lY0jO8vPJPYUajWm-jjODg';
// L'account non ha ancora una vera API key di produzione (in attesa che
// Yousign la attivi), ma il webhook di produzione può comunque arrivare:
// le chiamate che arricchiscono nome/email cliente e scaricano il PDF
// firmato falliranno silenziosamente finché non impostiamo la chiave vera
// (già gestito con valori di riserva più sotto), ma lo stato del contratto
// si aggiorna comunque.
const YOUSIGN_BASE = 'https://api.yousign.app/v3';

const EVENTO_STATO = {
  'signature_request.activated': 'INVIATO',
  'signature_request.done': 'FIRMATO',
  'signature_request.declined': 'RIFIUTATO',
  'signature_request.expired': 'SCADUTO'
};
const EVENTO_LABEL = {
  'signature_request.activated': 'Inviato per la firma su Yousign',
  'signature_request.done': 'Firmato su Yousign',
  'signature_request.declined': 'Rifiutato dal cliente su Yousign',
  'signature_request.expired': 'Scaduto su Yousign'
};

function supaHeaders() {
  return { apikey: SUPA_ANON, Authorization: 'Bearer ' + SUPA_ANON, 'Content-Type': 'application/json' };
}

// Email reale via Resend — dominio mbbet09.net verificato, arriva a tutto il team.
const DEST_EMAILS = [
  'mariateresabova.business@gmail.com',
  'dm.businessita@gmail.com',
  'samuelebetting7@gmail.com',
  'ponzios71@gmail.com'
];
async function inviaEmail(titolo, messaggio, link) {
  if (!process.env.RESEND_API_KEY) return;
  var html = '<p>' + messaggio + '</p>' + (link ? '<p><a href="' + link + '" style="display:inline-block;background:#f7cc46;color:#04070c;padding:8px 16px;border-radius:8px;text-decoration:none;font-weight:bold">Apri in MBBET OS →</a></p>' : '');
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'MBBET OS <notifiche@mbbet09.net>',
        to: DEST_EMAILS,
        subject: titolo, html: html
      })
    });
  } catch (e) {}
}

const APP_BASE = 'https://effervescent-tapioca-e827c7.netlify.app';

function corpoGrezzo(event) {
  return event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : (event.body || '');
}

function verificaFirma(event) {
  const secret = process.env.YOUSIGN_WEBHOOK_SECRET;
  if (!secret) return false;
  const headers = event.headers || {};
  const headerFirma = headers['x-yousign-signature-256'] || headers['X-Yousign-Signature-256'] || '';
  if (!headerFirma) return false;
  const hmac = crypto.createHmac('sha256', secret).update(corpoGrezzo(event), 'utf8').digest('hex');
  const atteso = 'sha256=' + hmac;
  const bufRicevuto = Buffer.from(headerFirma, 'utf8');
  const bufAtteso = Buffer.from(atteso, 'utf8');
  if (bufRicevuto.length !== bufAtteso.length) return false;
  return crypto.timingSafeEqual(bufRicevuto, bufAtteso);
}

async function trovaClienteIdPerEmail(email) {
  if (!email) return null;
  try {
    const r = await fetch(SUPA_URL + '/rest/v1/clienti?email=eq.' + encodeURIComponent(email) + '&select=id&limit=1', { headers: supaHeaders() });
    const rows = await r.json();
    return (rows && rows[0] && rows[0].id) || null;
  } catch (e) { return null; }
}

async function recuperaDatiRichiesta(signatureRequestId, ysAuth) {
  const [srRes, signersRes] = await Promise.all([
    fetch(YOUSIGN_BASE + '/signature_requests/' + signatureRequestId, { headers: ysAuth }),
    fetch(YOUSIGN_BASE + '/signature_requests/' + signatureRequestId + '/signers', { headers: ysAuth })
  ]);
  const sr = await srRes.json().catch(function () { return {}; });
  const signersData = await signersRes.json().catch(function () { return []; });
  const signersList = Array.isArray(signersData) ? signersData : (signersData.data || signersData.signers || []);
  const primo = signersList[0] || {};
  const info = primo.info || primo || {};
  const nome = [info.first_name, info.last_name].filter(Boolean).join(' ').trim() || 'Cliente Yousign';
  const email = info.email || null;
  const tipo = sr.name || 'Contratto';
  return { nome: nome, email: email, tipo: tipo };
}

// Trova il contratto per yousign_request_id; se non esiste (creato
// direttamente su Yousign.com, mai visto prima da MBBET OS) lo crea
// recuperando firmatario e nome del documento dall'API Yousign.
async function trovaOCreaContratto(signatureRequestId, ysAuth) {
  const cRes = await fetch(SUPA_URL + '/rest/v1/contratti?yousign_request_id=eq.' + signatureRequestId + '&select=*', { headers: supaHeaders() });
  const cRows = await cRes.json();
  if (cRows && cRows[0]) return cRows[0];

  const dati = await recuperaDatiRichiesta(signatureRequestId, ysAuth);
  const clienteId = await trovaClienteIdPerEmail(dati.email);
  const nowIso = new Date().toISOString();
  const nuovo = {
    cliente_id: clienteId,
    nome_cliente: dati.nome,
    email_cliente: dati.email,
    tipo_contratto: dati.tipo,
    stato: 'DA_INVIARE',
    provider_esterno: 'YOUSIGN',
    yousign_request_id: signatureRequestId,
    log_eventi: [],
    created_at: nowIso,
    updated_at: nowIso
  };
  const insRes = await fetch(SUPA_URL + '/rest/v1/contratti', {
    method: 'POST',
    headers: Object.assign({ Prefer: 'return=representation' }, supaHeaders()),
    body: JSON.stringify(nuovo)
  });
  const insRows = await insRes.json();
  return (insRows && insRows[0]) || nuovo;
}

exports.handler = async function (event) {
  if (!verificaFirma(event)) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Firma non valida' }) };
  }

  let payload;
  try { payload = JSON.parse(corpoGrezzo(event) || '{}'); }
  catch (e) { return { statusCode: 400, body: JSON.stringify({ error: 'Payload non valido' }) }; }

  const eventType = payload.event_name || (payload.data && payload.data.event_name) || payload.type;
  const signatureRequestId = (payload.data && payload.data.signature_request && payload.data.signature_request.id)
    || (payload.signature_request && payload.signature_request.id)
    || payload.signature_request_id;

  const nuovoStato = EVENTO_STATO[eventType];
  console.log('Yousign webhook:', eventType, signatureRequestId);

  if (!nuovoStato || !signatureRequestId) {
    // Evento non gestito (promemoria, identificazione, ecc.) — rispondo 200
    // comunque così Yousign non ritenta all'infinito.
    return { statusCode: 200, body: JSON.stringify({ ok: true, ignored: true, eventType: eventType }) };
  }

  try {
    const ysAuth = { Authorization: 'Bearer ' + process.env.YOUSIGN_API_KEY };
    const contratto = await trovaOCreaContratto(signatureRequestId, ysAuth);

    const nowIso = new Date().toISOString();
    const newLog = (contratto.log_eventi || []).concat([{ evento: EVENTO_LABEL[eventType], data: nowIso }]);
    const patch = { stato: nuovoStato, log_eventi: newLog, updated_at: nowIso };
    if (eventType === 'signature_request.activated' && !contratto.data_invio) patch.data_invio = nowIso.slice(0, 10);

    if (eventType === 'signature_request.done') {
      // Scarica il PDF firmato e lo archivia nel bucket Supabase
      const docsRes = await fetch(YOUSIGN_BASE + '/signature_requests/' + signatureRequestId + '/documents', { headers: ysAuth });
      const docs = await docsRes.json();
      const docList = Array.isArray(docs) ? docs : (docs.data || docs.documents || []);
      const documentId = docList[0] && docList[0].id;
      if (documentId) {
        const dlRes = await fetch(YOUSIGN_BASE + '/signature_requests/' + signatureRequestId + '/documents/' + documentId + '/download', { headers: ysAuth });
        const pdfBuffer = Buffer.from(await dlRes.arrayBuffer());
        const path = 'firmati/' + Date.now() + '_' + contratto.id + '.pdf';
        await fetch(SUPA_URL + '/storage/v1/object/contratti/' + path, {
          method: 'POST',
          headers: Object.assign({ 'Content-Type': 'application/pdf' }, supaHeaders()),
          body: pdfBuffer
        });
        patch.storage_path_firmato = path;
      }
      patch.data_firma = nowIso.slice(0, 10);
    }

    await fetch(SUPA_URL + '/rest/v1/contratti?id=eq.' + contratto.id, {
      method: 'PATCH', headers: supaHeaders(),
      body: JSON.stringify(patch)
    });

    // Notifica dentro MBBET OS + email al team
    var linkContratto = APP_BASE + '/11_contratti.html?apri=' + contratto.id;
    var titoloNotif = EVENTO_LABEL[eventType] + ': ' + (contratto.nome_cliente || '');
    var msgNotif = (contratto.tipo_contratto || 'Contratto') + ' — ' + EVENTO_LABEL[eventType] + '\n' + linkContratto;
    await fetch(SUPA_URL + '/rest/v1/notifiche', {
      method: 'POST', headers: supaHeaders(),
      body: JSON.stringify({
        tipo: 'Contratto', titolo: titoloNotif,
        messaggio: msgNotif, priorita: 'Alta',
        destinatario: contratto.operatore || null, letto: false
      })
    });
    await inviaEmail(titoloNotif, (contratto.tipo_contratto || 'Contratto') + ' — ' + EVENTO_LABEL[eventType], linkContratto);

    return { statusCode: 200, body: JSON.stringify({ ok: true, stato: nuovoStato }) };
  } catch (err) {
    console.log('Errore webhook Yousign:', String(err && err.message || err));
    return { statusCode: 500, body: JSON.stringify({ error: 'Errore interno', detail: String(err && err.message || err) }) };
  }
};
