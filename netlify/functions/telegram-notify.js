// Netlify Function — manda un messaggio Telegram a un operatore quando gli
// viene assegnato un nuovo sito (da Vista Operativa o da Collaboratori).
// Chiamata dal browser dopo un insert/update su bonus con un operatore che
// ha un telegram_chat_id salvato. Il token del bot resta solo qui, mai nel
// codice lato client.

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

  const chatId = body.chat_id;
  const message = body.message || '';
  const bonusId = body.bonus_id; // opzionale: se presente, aggiunge i bottoni Fatto/Problema
  if (!chatId || !message) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Mancano chat_id o message' }) };
  }

  const payload = { chat_id: chatId, text: message, parse_mode: 'HTML' };
  if (bonusId) {
    payload.reply_markup = {
      inline_keyboard: [[
        { text: '✅ Fatto', callback_data: 'fatto|' + bonusId },
        { text: '⚠️ Problema', callback_data: 'problema|' + bonusId }
      ]]
    };
  }

  try {
    const res = await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data.ok) return { statusCode: 502, body: JSON.stringify({ error: 'Errore Telegram', detail: data }) };
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Errore interno', detail: String(err && err.message || err) }) };
  }
};
