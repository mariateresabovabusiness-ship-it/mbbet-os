// Netlify Function — aiuta Mary a trovare l'ID di ogni gruppo Telegram senza
// terminale: dopo aver aggiunto il bot a un gruppo e scritto un messaggio
// qualsiasi lì dentro, questa funzione elenca i gruppi/chat visti dal bot
// con il loro ID, cosi puo' essere incollato nel campo giusto per ogni
// operatore. Sola lettura, nessuna configurazione salvata da qui.
//
// Legge dalla tabella telegram_seen_chats (riempita dal webhook in tempo
// reale) invece che da getUpdates: da quando il bot ha un webhook attivo
// (per i bottoni Fatto/Problema), getUpdates non riceve più nulla.

const SUPA_URL = 'https://ntwqfuvcosvzpqrfpipn.supabase.co';
const SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50d3FmdXZjb3N2enBxcmZwaXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NTQzNzYsImV4cCI6MjA5ODQzMDM3Nn0.i_JkizD5xMQBNYi0W8T_1lY0jO8vPJPYUajWm-jjODg';

exports.handler = async function () {
  try {
    const res = await fetch(SUPA_URL + '/rest/v1/telegram_seen_chats?select=chat_id,titolo,tipo&order=seen_at.desc', {
      headers: { apikey: SUPA_ANON, Authorization: 'Bearer ' + SUPA_ANON }
    });
    const data = await res.json();
    if (!res.ok) return { statusCode: 502, body: JSON.stringify({ error: 'Errore Supabase', detail: data }) };

    const chats = (data || []).map(function (r) { return { chat_id: r.chat_id, titolo: r.titolo, tipo: r.tipo }; });
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, chats: chats }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Errore interno', detail: String(err && err.message || err) }) };
  }
};
