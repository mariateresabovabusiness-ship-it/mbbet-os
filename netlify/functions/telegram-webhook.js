// Netlify Function — webhook Telegram: riceve in tempo reale ogni messaggio
// e ogni tap sui bottoni "✅ Fatto / ⚠️ Problema" dei messaggi di notifica.
// Due compiti:
//  1) callback_query (bottone toccato) -> aggiorna lo stato del bonus su
//     Supabase e conferma all'operatore, esattamente come il menu a tendina
//     di Vista Operativa.
//  2) qualunque altro messaggio in un gruppo/chat -> registra quella chat in
//     telegram_seen_chats, così la pagina Team può ancora trovarne l'ID
//     (da quando c'è un webhook attivo, getUpdates non è più utilizzabile).

const SUPA_URL = 'https://ntwqfuvcosvzpqrfpipn.supabase.co';
const SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50d3FmdXZjb3N2enBxcmZwaXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NTQzNzYsImV4cCI6MjA5ODQzMDM3Nn0.i_JkizD5xMQBNYi0W8T_1lY0jO8vPJPYUajWm-jjODg';

function supaHeaders(extra) {
  return Object.assign({ apikey: SUPA_ANON, Authorization: 'Bearer ' + SUPA_ANON, 'Content-Type': 'application/json' }, extra || {});
}

async function tg(token, method, payload) {
  return fetch('https://api.telegram.org/bot' + token + '/' + method, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
}

async function registraChat(chat) {
  if (!chat || chat.type === 'private') return; // le chat private (test bot) non servono nella lista gruppi
  try {
    await fetch(SUPA_URL + '/rest/v1/telegram_seen_chats', {
      method: 'POST',
      headers: supaHeaders({ Prefer: 'resolution=merge-duplicates' }),
      body: JSON.stringify({ chat_id: String(chat.id), titolo: chat.title || chat.username || '(senza nome)', tipo: chat.type, seen_at: new Date().toISOString() })
    });
  } catch (e) {}
}

async function gestisciCallback(token, cq) {
  const data = cq.data || '';
  const parti = data.split('|');
  const azione = parti[0];
  const bonusId = parti[1];
  if (!bonusId || (azione !== 'fatto' && azione !== 'problema')) {
    await tg(token, 'answerCallbackQuery', { callback_query_id: cq.id, text: 'Azione non riconosciuta' });
    return;
  }

  const upd = azione === 'fatto'
    ? { stato: 'FATTO', stato_op: 'Completato' }
    : { stato: 'DA_VERIFICARE', stato_op: 'Problema' };
  upd.ult_azione = new Date().toISOString();

  const res = await fetch(SUPA_URL + '/rest/v1/bonus?id=eq.' + encodeURIComponent(bonusId), {
    method: 'PATCH', headers: supaHeaders(), body: JSON.stringify(upd)
  });

  if (!res.ok) {
    await tg(token, 'answerCallbackQuery', { callback_query_id: cq.id, text: '⚠️ Errore, riprova dall\'app' });
    return;
  }

  const testoConferma = azione === 'fatto' ? '✅ Fatto' : '⚠️ Problema';
  await tg(token, 'answerCallbackQuery', { callback_query_id: cq.id, text: 'Segnato: ' + testoConferma });
  if (cq.message) {
    const nuovoTesto = (cq.message.text || '') + '\n\n' + testoConferma + ' — segnato da ' + (cq.from && (cq.from.first_name || cq.from.username) || 'operatore');
    await tg(token, 'editMessageText', {
      chat_id: cq.message.chat.id, message_id: cq.message.message_id,
      text: nuovoTesto, parse_mode: 'HTML'
    });
  }
}

exports.handler = async function (event) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { statusCode: 200, body: 'ok' }; // rispondi comunque 200 a Telegram

  let update;
  try { update = JSON.parse(event.body || '{}'); }
  catch (e) { return { statusCode: 200, body: 'ok' }; }

  try {
    if (update.callback_query) {
      await gestisciCallback(token, update.callback_query);
    } else if (update.message && update.message.chat) {
      await registraChat(update.message.chat);
    } else if (update.my_chat_member && update.my_chat_member.chat) {
      await registraChat(update.my_chat_member.chat);
    }
  } catch (e) {
    // Telegram si aspetta comunque 200: un errore qui non deve far ritentare
    // la stessa update all'infinito.
  }

  return { statusCode: 200, body: 'ok' };
};
