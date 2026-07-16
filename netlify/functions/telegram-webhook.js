// Netlify Function — webhook Telegram: riceve in tempo reale ogni messaggio
// e ogni tap sui bottoni "✅ Fatto / ⚠️ Problema" dei messaggi di notifica.
// Tre compiti:
//  1) callback_query (bottone toccato) -> aggiorna lo stato del bonus su
//     Supabase e conferma all'operatore, esattamente come il menu a tendina
//     di Vista Operativa.
//  2) qualunque altro messaggio in un gruppo/chat -> registra quella chat in
//     telegram_seen_chats, così la pagina Team può ancora trovarne l'ID
//     (da quando c'è un webhook attivo, getUpdates non è più utilizzabile).
//  3) "/chiedi <domanda>" nel gruppo di un operatore -> risponde con Claude,
//     con in mano i suoi siti aperti presi da Supabase. Solo un comando
//     esplicito (non ogni messaggio) per non rispondere a chiacchiere tra
//     le persone nel gruppo e non generare costi API inutili. Solo consigli:
//     non scrive mai nulla sul database da qui.

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

async function trovaOperatorePerChat(chatId) {
  const res = await fetch(SUPA_URL + '/rest/v1/operatori?telegram_chat_id=eq.' + encodeURIComponent(chatId) + '&select=nome', { headers: supaHeaders() });
  const rows = await res.json();
  return Array.isArray(rows) && rows[0] ? rows[0].nome : null;
}

async function sitiApertiOperatore(nome) {
  const res = await fetch(SUPA_URL + '/rest/v1/bonus?operatore=eq.' + encodeURIComponent(nome) + '&stato=in.(LIBERO,IN_CORSO,DA_VERIFICARE)&select=cliente,bookmaker,stato,stato_op,note', { headers: supaHeaders() });
  const rows = await res.json();
  return Array.isArray(rows) ? rows : [];
}

async function gestisciDomandaAI(token, msg, domanda) {
  const chatId = msg.chat.id;
  const claudeKey = process.env.ANTHROPIC_API_KEY;
  if (!claudeKey) {
    await tg(token, 'sendMessage', { chat_id: chatId, text: '⚠️ L\'assistente AI non è ancora configurato (manca la chiave su Netlify).' });
    return;
  }

  const nomeOp = await trovaOperatorePerChat(chatId);
  const siti = nomeOp ? await sitiApertiOperatore(nomeOp) : [];
  const elencoSiti = siti.length
    ? siti.map(function (s) { return '- ' + s.cliente + ' su ' + s.bookmaker + ' (stato: ' + (s.stato_op || s.stato) + (s.note ? ', nota: ' + s.note : '') + ')'; }).join('\n')
    : 'Nessun sito aperto al momento.';

  const systemPrompt = 'Sei l\'assistente MBBET OS per gli operatori di matched betting. Rispondi in italiano, breve e pratico (max 6-7 righe), con toni amichevoli e concreti. Puoi consigliare come procedere su un sito, spiegare passaggi tipici (registrazione, deposito, verifica documenti, prelievo), o aiutare a capire perché un sito è bloccato. Se non sei sicuro di qualcosa di specifico su questo bookmaker, dillo chiaramente invece di inventare dettagli. Non puoi modificare nulla nel gestionale: se l\'operatore chiede di segnare qualcosa come fatto, digli di usare i bottoni sotto il messaggio di notifica o l\'app.\n\nSiti attualmente aperti per ' + (nomeOp || 'questo operatore') + ':\n' + elencoSiti;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': claudeKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 400,
        system: systemPrompt,
        messages: [{ role: 'user', content: domanda }]
      })
    });
    const data = await res.json();
    const risposta = (res.ok && data.content && data.content[0] && data.content[0].text) ? data.content[0].text : '⚠️ DEBUG status=' + res.status + ' body=' + JSON.stringify(data).slice(0, 300);
    await tg(token, 'sendMessage', { chat_id: chatId, text: risposta });
  } catch (e) {
    await tg(token, 'sendMessage', { chat_id: chatId, text: '⚠️ DEBUG exception: ' + String(e && e.message || e) });
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
      const testo = (update.message.text || '').trim();
      const match = testo.match(/^\/chiedi(@\w+)?\s+([\s\S]+)/i);
      if (match) {
        await gestisciDomandaAI(token, update.message, match[2].trim());
      } else {
        await registraChat(update.message.chat);
      }
    } else if (update.my_chat_member && update.my_chat_member.chat) {
      await registraChat(update.my_chat_member.chat);
    }
  } catch (e) {
    // Telegram si aspetta comunque 200: un errore qui non deve far ritentare
    // la stessa update all'infinito.
  }

  return { statusCode: 200, body: 'ok' };
};
