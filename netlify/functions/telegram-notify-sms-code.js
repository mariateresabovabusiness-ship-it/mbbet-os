// Netlify Function — avvisa via Telegram chi coordina il lavoro (config
// "Notifica codice SMS ricevuto") quando un cliente invia il codice SMS
// dalla pagina pubblica 17_conferma_sms.html. Il codice arriva già dentro
// il messaggio, così chi lo riceve non deve nemmeno aprire il gestionale.
// Chiamata da una pagina pubblica (anon) — nessun dato sensibile (chat_id,
// destinatario configurato) torna mai al browser: tutto risolto qui dentro.

const SUPA_URL = 'https://ntwqfuvcosvzpqrfpipn.supabase.co';
const SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50d3FmdXZjb3N2enBxcmZwaXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NTQzNzYsImV4cCI6MjA5ODQzMDM3Nn0.i_JkizD5xMQBNYi0W8T_1lY0jO8vPJPYUajWm-jjODg';

function supaHeaders(extra) {
  return Object.assign({ apikey: SUPA_ANON, Authorization: 'Bearer ' + SUPA_ANON, 'Content-Type': 'application/json' }, extra || {});
}

async function leggiConfig(chiave) {
  const res = await fetch(SUPA_URL + '/rest/v1/config?chiave=eq.' + encodeURIComponent(chiave) + '&select=valore', { headers: supaHeaders() });
  const rows = await res.json();
  return Array.isArray(rows) && rows[0] ? rows[0].valore : null;
}
async function trovaChatIdOperatore(nome) {
  const res = await fetch(SUPA_URL + '/rest/v1/operatori?nome=eq.' + encodeURIComponent(nome) + '&select=telegram_chat_id', { headers: supaHeaders() });
  const rows = await res.json();
  return Array.isArray(rows) && rows[0] ? rows[0].telegram_chat_id : null;
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Metodo non permesso' }) };
  }
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return { statusCode: 500, body: JSON.stringify({ error: 'TELEGRAM_BOT_TOKEN non configurato su Netlify' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (e) { return { statusCode: 400, body: JSON.stringify({ error: 'Corpo richiesta non valido' }) }; }

  const cliente = body.cliente || '—';
  const bookmaker = body.bookmaker || '—';
  const codice = body.codice || '';
  if (!codice) return { statusCode: 400, body: JSON.stringify({ error: 'Manca il codice' }) };

  try {
    const destinatario = await leggiConfig('Notifica codice SMS ricevuto');
    if (!destinatario) return { statusCode: 200, body: JSON.stringify({ ok: true, skipped: 'nessun destinatario configurato' }) };
    const chatId = await trovaChatIdOperatore(destinatario);
    if (!chatId) return { statusCode: 200, body: JSON.stringify({ ok: true, skipped: 'destinatario senza telegram_chat_id' }) };

    const testo = '📲 <b>Codice SMS arrivato</b>\n👤 ' + cliente + '\n🎰 ' + bookmaker + '\n🔢 Codice: <b>' + codice + '</b>';
    const res = await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: testo, parse_mode: 'HTML' })
    });
    const data = await res.json();
    if (!res.ok || !data.ok) return { statusCode: 502, body: JSON.stringify({ error: 'Errore Telegram', detail: data }) };
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Errore interno', detail: String(err && err.message || err) }) };
  }
};
