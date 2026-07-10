// Netlify Scheduled Function (@daily, vedi netlify.toml) — controlla contratti
// rimasti "INVIATO" da troppo tempo e task scaduti, e genera una notifica in
// MBBET OS per ciascuno. Deduplica confrontando tipo+titolo delle notifiche
// già create negli ultimi 7 giorni, così non spamma la stessa notifica ogni
// volta che gira.

const SUPA_URL = 'https://ntwqfuvcosvzpqrfpipn.supabase.co';
const SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50d3FmdXZjb3N2enBxcmZwaXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NTQzNzYsImV4cCI6MjA5ODQzMDM3Nn0.i_JkizD5xMQBNYi0W8T_1lY0jO8vPJPYUajWm-jjODg';
const ORE_ATTESA_CONTRATTO = 48;

function supaHeaders() {
  return { apikey: SUPA_ANON, Authorization: 'Bearer ' + SUPA_ANON, 'Content-Type': 'application/json' };
}

async function giaNotificato(tipo, titolo) {
  const sinceIso = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const url = SUPA_URL + '/rest/v1/notifiche?tipo=eq.' + encodeURIComponent(tipo)
    + '&titolo=eq.' + encodeURIComponent(titolo) + '&created_at=gte.' + sinceIso + '&select=id&limit=1';
  const res = await fetch(url, { headers: supaHeaders() });
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0;
}

async function creaNotifica(tipo, titolo, messaggio, destinatario) {
  await fetch(SUPA_URL + '/rest/v1/notifiche', {
    method: 'POST', headers: supaHeaders(),
    body: JSON.stringify({ tipo: tipo, titolo: titolo, messaggio: messaggio || null, priorita: 'Alta', destinatario: destinatario || null, letto: false })
  });
  await inviaEmail(titolo, messaggio || '');
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

exports.handler = async function () {
  const risultato = { contratti_notificati: 0, task_notificati: 0 };

  try {
    // 1. Contratti fermi in "INVIATO" da più di ORE_ATTESA_CONTRATTO ore
    const sogliaIso = new Date(Date.now() - ORE_ATTESA_CONTRATTO * 3600 * 1000).toISOString();
    const cRes = await fetch(SUPA_URL + '/rest/v1/contratti?stato=eq.INVIATO&updated_at=lt.' + sogliaIso + '&select=nome_cliente,operatore', { headers: supaHeaders() });
    const contratti = await cRes.json();
    if (Array.isArray(contratti)) {
      for (const c of contratti) {
        const titolo = 'Contratto in attesa di firma: ' + (c.nome_cliente || '');
        if (await giaNotificato('Contratto', titolo)) continue;
        await creaNotifica('Contratto', titolo, 'Nessuna firma da oltre ' + ORE_ATTESA_CONTRATTO + ' ore', c.operatore);
        risultato.contratti_notificati++;
      }
    }

    // 2. Task scaduti (stato Aperto, scadenza passata)
    const oggiIso = new Date().toISOString().slice(0, 10);
    const tRes = await fetch(SUPA_URL + '/rest/v1/task?stato=eq.Aperto&scadenza=lt.' + oggiIso + '&select=descrizione,operatore,nome_cli', { headers: supaHeaders() });
    const task = await tRes.json();
    if (Array.isArray(task)) {
      for (const t of task) {
        const desc = (t.descrizione || t.nome_cli || 'Task').slice(0, 80);
        const titolo = 'Task scaduta: ' + desc;
        if (await giaNotificato('Task', titolo)) continue;
        await creaNotifica('Task', titolo, 'Scadenza superata', t.operatore);
        risultato.task_notificati++;
      }
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, ...risultato }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Errore interno', detail: String(err && err.message || err) }) };
  }
};
