// Netlify Function — legge il contenuto reale di una singola email (per UID)
// da una cartella di mail.mbbet09.net via IMAP, e la interpreta con mailparser
// per estrarre testo/html leggibili. Sola lettura.

const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');

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

  const folder = (body.folder || '').toUpperCase();
  const uid = parseInt(body.uid, 10);
  if (CARTELLE_VALIDE.indexOf(folder) < 0 || !uid) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Parametri non validi' }) };
  }

  const client = new ImapFlow({ host, port: 993, secure: true, auth: { user, pass }, logger: false });

  try {
    await client.connect();
    const lock = await client.getMailboxLock(folder);
    let risultato = null;
    try {
      const msg = await client.fetchOne(String(uid), { source: true }, { uid: true });
      if (msg && msg.source) {
        const parsed = await simpleParser(msg.source);
        risultato = {
          subject: parsed.subject || '(senza oggetto)',
          from: (parsed.from && parsed.from.text) || '—',
          date: parsed.date || null,
          text: parsed.text || '',
          html: parsed.html || null
        };
      }
    } finally {
      lock.release();
    }
    await client.logout();

    if (!risultato) return { statusCode: 404, body: JSON.stringify({ error: 'Messaggio non trovato' }) };
    return { statusCode: 200, body: JSON.stringify({ ok: true, messaggio: risultato }) };
  } catch (err) {
    try { client.logout(); } catch (e) {}
    return { statusCode: 500, body: JSON.stringify({ error: 'Errore connessione email', detail: String(err && err.message || err) }) };
  }
};
