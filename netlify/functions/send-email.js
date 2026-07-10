// Netlify Function — invia una email reale via Resend per le notifiche ad
// alta priorità. Chiamata dal browser (dove la chiave API non può stare)
// da 02_bonus.html e 10_onboarding_cliente.html dopo aver creato una
// notifica. Senza un dominio verificato su Resend, può mandare email solo
// all'indirizzo di iscrizione dell'account Resend — verificato con un
// invio reale, non è un limite inventato.

const DEST_EMAIL = 'mariateresabova.business@gmail.com';

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Metodo non permesso' }) };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'RESEND_API_KEY non configurata su Netlify' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (e) { return { statusCode: 400, body: JSON.stringify({ error: 'Corpo richiesta non valido' }) }; }

  const titolo = body.titolo || 'Notifica MBBET OS';
  const messaggio = body.messaggio || '';

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'MBBET OS <onboarding@resend.dev>',
        to: [DEST_EMAIL],
        subject: titolo,
        html: '<p>' + messaggio + '</p>'
      })
    });
    const data = await res.json();
    if (!res.ok) return { statusCode: 502, body: JSON.stringify({ error: 'Errore Resend', detail: data }) };
    return { statusCode: 200, body: JSON.stringify({ ok: true, id: data.id }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Errore interno', detail: String(err && err.message || err) }) };
  }
};
