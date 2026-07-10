// Netlify Function — riceve i webhook da Yousign (Sandbox) quando un
// contratto viene firmato, scarica il PDF firmato e aggiorna il contratto.
// Protetta da un token nell'URL (?token=...) finché non verifichiamo il
// formato reale di firma/autenticazione webhook di Yousign (non documentato
// pubblicamente in modo chiaro — non lo invento).

const SUPA_URL = 'https://ntwqfuvcosvzpqrfpipn.supabase.co';
const SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50d3FmdXZjb3N2enBxcmZwaXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NTQzNzYsImV4cCI6MjA5ODQzMDM3Nn0.i_JkizD5xMQBNYi0W8T_1lY0jO8vPJPYUajWm-jjODg';
const YOUSIGN_BASE = 'https://api-sandbox.yousign.app/v3';

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
async function inviaEmail(titolo, messaggio) {
  if (!process.env.RESEND_API_KEY) return;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'MBBET OS <notifiche@mbbet09.net>',
        to: DEST_EMAILS,
        subject: titolo, html: '<p>' + messaggio + '</p>'
      })
    });
  } catch (e) {}
}

exports.handler = async function (event) {
  const token = (event.queryStringParameters || {}).token;
  if (!token || token !== process.env.YOUSIGN_WEBHOOK_TOKEN) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Token non valido' }) };
  }

  let payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch (e) { return { statusCode: 400, body: JSON.stringify({ error: 'Payload non valido' }) }; }

  // Log grezzo dell'evento — utile per ispezionare gli header/il formato
  // reale la prima volta che arriva, dato che non è documentato pubblicamente.
  console.log('Yousign webhook ricevuto:', JSON.stringify({ headers: event.headers, payload: payload }));

  const eventType = payload.event_name || (payload.data && payload.data.event_name) || payload.type;
  const signatureRequestId = (payload.data && payload.data.signature_request && payload.data.signature_request.id)
    || (payload.signature_request && payload.signature_request.id)
    || payload.signature_request_id;

  if (eventType !== 'signature_request.done' || !signatureRequestId) {
    // Evento non gestito (es. signer.done intermedio) — rispondo 200 comunque
    // così Yousign non ritenta all'infinito.
    return { statusCode: 200, body: JSON.stringify({ ok: true, ignored: true, eventType: eventType }) };
  }

  try {
    // 1. Trova il contratto
    const cRes = await fetch(SUPA_URL + '/rest/v1/contratti?yousign_request_id=eq.' + signatureRequestId + '&select=*', { headers: supaHeaders() });
    const cRows = await cRes.json();
    const contratto = cRows[0];
    if (!contratto) return { statusCode: 200, body: JSON.stringify({ ok: true, warning: 'Contratto non trovato per ' + signatureRequestId }) };

    const ysAuth = { Authorization: 'Bearer ' + process.env.YOUSIGN_API_KEY };

    // 2. Trova il documento firmato e scaricalo
    const docsRes = await fetch(YOUSIGN_BASE + '/signature_requests/' + signatureRequestId + '/documents', { headers: ysAuth });
    const docs = await docsRes.json();
    const docList = Array.isArray(docs) ? docs : (docs.data || docs.documents || []);
    const documentId = docList[0] && docList[0].id;
    if (!documentId) return { statusCode: 200, body: JSON.stringify({ ok: true, warning: 'Nessun documento trovato', detail: docs }) };

    const dlRes = await fetch(YOUSIGN_BASE + '/signature_requests/' + signatureRequestId + '/documents/' + documentId + '/download', { headers: ysAuth });
    const pdfBuffer = Buffer.from(await dlRes.arrayBuffer());

    // 3. Carica nel bucket Supabase
    const path = 'firmati/' + Date.now() + '_' + (contratto.id) + '.pdf';
    await fetch(SUPA_URL + '/storage/v1/object/contratti/' + path, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/pdf' }, supaHeaders()),
      body: pdfBuffer
    });

    // 4. Aggiorna il contratto
    const nowIso = new Date().toISOString();
    const newLog = (contratto.log_eventi || []).concat([{ evento: 'Firmato su Yousign (Sandbox)', data: nowIso }]);
    await fetch(SUPA_URL + '/rest/v1/contratti?id=eq.' + contratto.id, {
      method: 'PATCH', headers: supaHeaders(),
      body: JSON.stringify({
        stato: 'FIRMATO', data_firma: nowIso.slice(0, 10),
        storage_path_firmato: path, log_eventi: newLog, updated_at: nowIso
      })
    });

    // 5. Notifica dentro MBBET OS
    var titoloNotif = 'Contratto firmato: ' + (contratto.nome_cliente || '');
    var msgNotif = (contratto.tipo_contratto || 'Contratto') + ' firmato su Yousign';
    await fetch(SUPA_URL + '/rest/v1/notifiche', {
      method: 'POST', headers: supaHeaders(),
      body: JSON.stringify({
        tipo: 'Contratto', titolo: titoloNotif,
        messaggio: msgNotif, priorita: 'Alta',
        destinatario: contratto.operatore || null, letto: false
      })
    });
    await inviaEmail(titoloNotif, msgNotif);

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.log('Errore webhook Yousign:', String(err && err.message || err));
    return { statusCode: 500, body: JSON.stringify({ error: 'Errore interno', detail: String(err && err.message || err) }) };
  }
};
