// Netlify Scheduled Function (ogni 30 minuti, vedi netlify.toml) — controlla le
// 5 cartelle email (Bonus/Verifiche/Sospensioni/Documenti/Prelievi) e crea una
// notifica (dentro MBBET OS + email reale) per ogni email nuova non ancora
// notificata. Deduplica confrontando tipo+titolo delle notifiche già create
// negli ultimi 7 giorni, stesso schema già usato per le scadenze automatiche.

const { ImapFlow } = require('imapflow');

const SUPA_URL = 'https://ntwqfuvcosvzpqrfpipn.supabase.co';
const SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50d3FmdXZjb3N2enBxcmZwaXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NTQzNzYsImV4cCI6MjA5ODQzMDM3Nn0.i_JkizD5xMQBNYi0W8T_1lY0jO8vPJPYUajWm-jjODg';

const CARTELLE = [
  { id: 'BONUS', label: 'Bonus' },
  { id: 'VERIFICHE', label: 'Verifiche' },
  { id: 'SOSPENSIONI', label: 'Sospensioni' },
  { id: 'DOCUMENTI', label: 'Documenti' },
  { id: 'PRELIEVI', label: 'Prelievi' }
];

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

async function creaNotifica(titolo, messaggio) {
  await fetch(SUPA_URL + '/rest/v1/notifiche', {
    method: 'POST', headers: supaHeaders(),
    body: JSON.stringify({ tipo: 'Email', titolo: titolo, messaggio: messaggio || null, priorita: 'Alta', destinatario: null, letto: false })
  });
  await inviaEmail(titolo, messaggio || '');
}

async function inviaEmail(titolo, messaggio) {
  if (!process.env.RESEND_API_KEY) return;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'MBBET OS <onboarding@resend.dev>',
        to: ['mariateresabova.business@gmail.com'],
        subject: titolo, html: '<p>' + messaggio + '</p>'
      })
    });
  } catch (e) {}
}

exports.handler = async function () {
  const host = process.env.MBBET_MAIL_HOST;
  const user = process.env.MBBET_MAIL_USER;
  const pass = process.env.MBBET_MAIL_PASSWORD;
  if (!host || !user || !pass) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Credenziali email non configurate su Netlify' }) };
  }

  const client = new ImapFlow({ host, port: 993, secure: true, auth: { user, pass }, logger: false });
  const risultato = {};

  try {
    await client.connect();
    for (const cartella of CARTELLE) {
      let count = 0;
      const lock = await client.getMailboxLock(cartella.id);
      try {
        const uids = await client.search({ seen: false }, { uid: true });
        for (const uid of uids || []) {
          const msg = await client.fetchOne(String(uid), { envelope: true }, { uid: true });
          if (!msg || !msg.envelope) continue;
          const subject = msg.envelope.subject || '(senza oggetto)';
          const toAddr = (msg.envelope.to && msg.envelope.to[0] && msg.envelope.to[0].address) || '';
          const cliente = toAddr.split('@')[0] || 'sconosciuto';
          const fromName = (msg.envelope.from && msg.envelope.from[0] && (msg.envelope.from[0].name || msg.envelope.from[0].address)) || '—';
          const titolo = '📧 ' + cartella.label + ' — ' + cliente + ': ' + subject;
          if (await giaNotificato('Email', titolo)) continue;
          await creaNotifica(titolo, 'Da ' + fromName + ' · Cartella ' + cartella.label);
          count++;
        }
      } finally {
        lock.release();
      }
      risultato[cartella.id] = count;
    }
    await client.logout();
    return { statusCode: 200, body: JSON.stringify({ ok: true, notifiche_create: risultato }) };
  } catch (err) {
    try { client.logout(); } catch (e) {}
    return { statusCode: 500, body: JSON.stringify({ error: 'Errore connessione email', detail: String(err && err.message || err) }) };
  }
};
