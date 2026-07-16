// Netlify Scheduled Function (07:00 Italia, vedi netlify.toml) — ogni mattina
// manda a ogni operatore su Telegram l'elenco dei suoi siti ancora aperti
// (In Corso o con un Problema segnalato), così sa da dove ripartire senza
// aprire l'app. Chi non ha nulla in sospeso non riceve nessun messaggio.

const SUPA_URL = 'https://ntwqfuvcosvzpqrfpipn.supabase.co';
const SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50d3FmdXZjb3N2enBxcmZwaXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NTQzNzYsImV4cCI6MjA5ODQzMDM3Nn0.i_JkizD5xMQBNYi0W8T_1lY0jO8vPJPYUajWm-jjODg';

function supaHeaders() {
  return { apikey: SUPA_ANON, Authorization: 'Bearer ' + SUPA_ANON, 'Content-Type': 'application/json' };
}

exports.handler = async function () {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { statusCode: 500, body: JSON.stringify({ error: 'TELEGRAM_BOT_TOKEN non configurato' }) };

  try {
    const [opRes, bnsRes] = await Promise.all([
      fetch(SUPA_URL + '/rest/v1/operatori?stato=eq.Attivo&telegram_chat_id=not.is.null&select=nome,telegram_chat_id', { headers: supaHeaders() }),
      fetch(SUPA_URL + '/rest/v1/bonus?stato=in.(LIBERO,IN_CORSO)&select=cliente,bookmaker,operatore,stato_op', { headers: supaHeaders() })
    ]);
    const operatori = await opRes.json();
    const righe = await bnsRes.json();
    if (!Array.isArray(operatori) || !Array.isArray(righe)) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Risposta inattesa da Supabase' }) };
    }

    let inviati = 0;
    for (const op of operatori) {
      const mie = righe.filter(function (r) { return r.operatore === op.nome; });
      if (!mie.length) continue;

      const problemi = mie.filter(function (r) { return r.stato_op === 'Problema'; });
      const altre = mie.filter(function (r) { return r.stato_op !== 'Problema'; });

      let testo = '☀️ <b>Buongiorno ' + op.nome + '</b>\nEcco i tuoi siti ancora aperti (' + mie.length + '):\n';
      if (problemi.length) {
        testo += '\n⚠️ <b>Da risolvere:</b>\n' + problemi.slice(0, 10).map(function (r) {
          return '• ' + r.cliente + ' — ' + r.bookmaker;
        }).join('\n');
      }
      if (altre.length) {
        testo += '\n\n🟡 <b>In corso:</b>\n' + altre.slice(0, 15).map(function (r) {
          return '• ' + r.cliente + ' — ' + r.bookmaker;
        }).join('\n');
        if (altre.length > 15) testo += '\n… e altri ' + (altre.length - 15);
      }

      await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: op.telegram_chat_id, text: testo, parse_mode: 'HTML' })
      });
      inviati++;
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, digest_inviati: inviati }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Errore interno', detail: String(err && err.message || err) }) };
  }
};
