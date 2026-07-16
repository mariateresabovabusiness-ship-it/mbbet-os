// Netlify Function — aiuta Mary a trovare l'ID di ogni gruppo Telegram senza
// terminale: dopo aver aggiunto il bot a un gruppo e scritto un messaggio
// qualsiasi lì dentro, questa funzione elenca i gruppi/chat visti dal bot
// con il loro ID, cosi puo' essere incollato nel campo giusto per ogni
// operatore. Sola lettura, nessuna configurazione salvata da qui.

exports.handler = async function () {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return { statusCode: 500, body: JSON.stringify({ error: 'TELEGRAM_BOT_TOKEN non configurato su Netlify' }) };
  }

  try {
    const res = await fetch('https://api.telegram.org/bot' + token + '/getUpdates?limit=100');
    const data = await res.json();
    if (!res.ok || !data.ok) return { statusCode: 502, body: JSON.stringify({ error: 'Errore Telegram', detail: data }) };

    const chats = {};
    (data.result || []).forEach(function (u) {
      const msg = u.message || u.my_chat_member || u.channel_post;
      const chat = msg && msg.chat;
      if (!chat) return;
      chats[chat.id] = {
        chat_id: chat.id,
        titolo: chat.title || chat.first_name || chat.username || '(senza nome)',
        tipo: chat.type
      };
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, chats: Object.values(chats) })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Errore interno', detail: String(err && err.message || err) }) };
  }
};
