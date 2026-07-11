// Netlify Function — crea e invia una richiesta di firma su Yousign (produzione).
// Chiamata dal browser (11_contratti.html) passando { contratto_id }.
// La chiave segreta YOUSIGN_API_KEY vive solo qui (variabile d'ambiente
// Netlify), mai nel codice lato browser.

const SUPA_URL = 'https://ntwqfuvcosvzpqrfpipn.supabase.co';
const SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50d3FmdXZjb3N2enBxcmZwaXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NTQzNzYsImV4cCI6MjA5ODQzMDM3Nn0.i_JkizD5xMQBNYi0W8T_1lY0jO8vPJPYUajWm-jjODg';
// NOTA: l'account Yousign ha per ora solo accesso Sandbox all'API (la
// produzione richiede un'attivazione separata da richiedere a Yousign).
// Basta cambiare questa riga in 'https://api.yousign.app/v3' (e lo stesso
// in yousign-webhook.js) quando l'ambiente di produzione sarà attivo.
const YOUSIGN_BASE = 'https://api-sandbox.yousign.app/v3';

function supaHeaders() {
  return { apikey: SUPA_ANON, Authorization: 'Bearer ' + SUPA_ANON, 'Content-Type': 'application/json' };
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Metodo non permesso' }) };
  }

  const apiKey = process.env.YOUSIGN_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'YOUSIGN_API_KEY non configurata su Netlify' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (e) { return { statusCode: 400, body: JSON.stringify({ error: 'Corpo richiesta non valido' }) }; }

  const contrattoId = body.contratto_id;
  if (!contrattoId) return { statusCode: 400, body: JSON.stringify({ error: 'contratto_id mancante' }) };

  try {
    // 1. Leggi il contratto
    const cRes = await fetch(SUPA_URL + '/rest/v1/contratti?id=eq.' + contrattoId + '&select=*', { headers: supaHeaders() });
    const cRows = await cRes.json();
    const contratto = cRows[0];
    if (!contratto) return { statusCode: 404, body: JSON.stringify({ error: 'Contratto non trovato' }) };
    if (!contratto.storage_path_bozza) return { statusCode: 400, body: JSON.stringify({ error: 'Carica prima il PDF da firmare' }) };
    if (!contratto.email_cliente) return { statusCode: 400, body: JSON.stringify({ error: 'Email cliente mancante sul contratto' }) };

    // 2. Scarica il PDF dal bucket Supabase (signed URL)
    const signRes = await fetch(SUPA_URL + '/storage/v1/object/sign/contratti/' + contratto.storage_path_bozza, {
      method: 'POST', headers: supaHeaders(), body: JSON.stringify({ expiresIn: 300 })
    });
    const signData = await signRes.json();
    if (!signData.signedURL) return { statusCode: 500, body: JSON.stringify({ error: 'Impossibile leggere il PDF da firmare', detail: signData }) };
    const pdfRes = await fetch(SUPA_URL + '/storage/v1' + signData.signedURL);
    const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());

    const ysAuth = { Authorization: 'Bearer ' + apiKey };

    // 3. Crea la signature request
    const srRes = await fetch(YOUSIGN_BASE + '/signature_requests', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, ysAuth),
      body: JSON.stringify({ name: contratto.tipo_contratto || ('Contratto ' + contratto.nome_cliente), delivery_mode: 'email' })
    });
    const sr = await srRes.json();
    if (!srRes.ok) return { statusCode: 502, body: JSON.stringify({ error: 'Errore Yousign (creazione richiesta)', detail: sr }) };
    const signatureRequestId = sr.id;

    // 4. Allega il documento
    const form = new FormData();
    form.append('file', new Blob([pdfBuffer], { type: 'application/pdf' }), (contratto.tipo_contratto || 'contratto').replace(/[^a-zA-Z0-9 _-]/g, '') + '.pdf');
    form.append('nature', 'signable_document');
    const docRes = await fetch(YOUSIGN_BASE + '/signature_requests/' + signatureRequestId + '/documents', {
      method: 'POST', headers: ysAuth, body: form
    });
    const doc = await docRes.json();
    if (!docRes.ok) return { statusCode: 502, body: JSON.stringify({ error: 'Errore Yousign (documento)', detail: doc }) };

    // 5. Aggiungi il firmatario
    const parts = (contratto.nome_cliente || 'Cliente').trim().split(/\s+/);
    const firstName = parts[0] || 'Cliente';
    const lastName = parts.slice(1).join(' ') || firstName;
    const signerRes = await fetch(YOUSIGN_BASE + '/signature_requests/' + signatureRequestId + '/signers', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, ysAuth),
      body: JSON.stringify({
        info: { first_name: firstName, last_name: lastName, email: contratto.email_cliente, locale: 'it' },
        signature_level: 'electronic_signature',
        signature_authentication_mode: 'no_otp',
        fields: [{ document_id: doc.id, type: 'signature', page: 1, x: 100, y: 700 }]
      })
    });
    const signer = await signerRes.json();
    if (!signerRes.ok) return { statusCode: 502, body: JSON.stringify({ error: 'Errore Yousign (firmatario)', detail: signer }) };

    // 6. Attiva (invia per la firma)
    const actRes = await fetch(YOUSIGN_BASE + '/signature_requests/' + signatureRequestId + '/activate', {
      method: 'POST', headers: ysAuth
    });
    const act = await actRes.json();
    if (!actRes.ok) return { statusCode: 502, body: JSON.stringify({ error: 'Errore Yousign (invio)', detail: act }) };

    // 7. Aggiorna il contratto
    const nowIso = new Date().toISOString();
    const newLog = (contratto.log_eventi || []).concat([{ evento: 'Inviato con Yousign', data: nowIso }]);
    await fetch(SUPA_URL + '/rest/v1/contratti?id=eq.' + contrattoId, {
      method: 'PATCH', headers: supaHeaders(),
      body: JSON.stringify({
        yousign_request_id: signatureRequestId, stato: 'INVIATO',
        data_invio: nowIso.slice(0, 10), log_eventi: newLog, updated_at: nowIso
      })
    });

    return { statusCode: 200, body: JSON.stringify({ ok: true, signature_request_id: signatureRequestId }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Errore interno', detail: String(err && err.message || err) }) };
  }
};
