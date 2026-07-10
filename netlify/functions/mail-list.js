// Netlify Function — legge la lista degli ultimi messaggi di una cartella
// reale della casella mail.mbbet09.net via IMAP (libreria imapflow).
// Sola lettura: non modifica nulla sul server email.

const { ImapFlow } = require('imapflow');

const MAX_MESSAGES = 30;
const CARTELLE_VALIDE = ['VERIFICHE', 'SOSPENSIONI', 'BONUS', 'DOCUMENTI', 'PRELIEVI', 'INBOX'];

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Metodo non permesso' }) };
  }

  const host = process.env.MBBET_MAIL_HOST;
  const user = process.env.MBBET_MAIL_USER;
  const pass = process.env.MBBET_MAIL_PASSWORD;
  if (!host || !user || !pass) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Credenziali email non configurate su Netlify' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (e) { return { statusCode: 400, body: JSON.stringify({ error: 'Corpo richiesta non valido' }) }; }

  const folder = (body.folder || 'INBOX').toUpperCase();
  if (CARTELLE_VALIDE.indexOf(folder) < 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Cartella non valida' }) };
  }

  const client = new ImapFlow({ host, port: 993, secure: true, auth: { user, pass }, logger: false });

  try {
    await client.connect();
    const lock = await client.getMailboxLock(folder);
    const messaggi = [];
    try {
      const totale = client.mailbox.exists || 0;
      if (totale > 0) {
        const inizio = Math.max(1, totale - MAX_MESSAGES + 1);
        for await (const msg of client.fetch(inizio + ':*', { envelope: true, uid: true, flags: true })) {
          messaggi.push({
            uid: msg.uid,
            subject: (msg.envelope && msg.envelope.subject) || '(senza oggetto)',
            from: (msg.envelope && msg.envelope.from && msg.envelope.from[0] && (msg.envelope.from[0].name || msg.envelope.from[0].address)) || '—',
            date: (msg.envelope && msg.envelope.date) || null,
            letto: !!(msg.flags && msg.flags.has('\\Seen'))
          });
        }
      }
    } finally {
      lock.release();
    }
    await client.logout();

    messaggi.sort(function (a, b) { return new Date(b.date || 0) - new Date(a.date || 0); });
    return { statusCode: 200, body: JSON.stringify({ ok: true, folder: folder, messaggi: messaggi }) };
  } catch (err) {
    try { client.logout(); } catch (e) {}
    return { statusCode: 500, body: JSON.stringify({ error: 'Errore connessione email', detail: String(err && err.message || err) }) };
  }
};
