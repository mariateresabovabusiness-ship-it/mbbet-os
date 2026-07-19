// Netlify Function — legge un documento d'identità (carta d'identità, tessera
// sanitaria, foto con documento) con Claude vision al posto del solo
// riconoscimento testo grezzo (Tesseract). Chiamata dal browser da
// 14_coda_clienti.html con l'immagine già caricata (nessun upload esterno,
// la stessa foto che l'operatore sta già guardando).
//
// Istruzione esplicita al modello: non inventare mai un dato che non
// riesce a leggere con sicurezza — meglio un campo vuoto che uno sbagliato,
// dato che questi dati vanno poi incollati su moduli di registrazione reali.

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Metodo non permesso' }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY non configurata su Netlify' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (e) { return { statusCode: 400, body: JSON.stringify({ error: 'Corpo richiesta non valido' }) }; }

  const mediaType = body.mediaType || 'image/jpeg';
  const data = body.data;
  if (!data) return { statusCode: 400, body: JSON.stringify({ error: 'Immagine mancante' }) };

  const systemPrompt = 'Sei un assistente che legge documenti d\'identità italiani (carta d\'identità, tessera sanitaria, patente, foto con documento in mano) da una foto, spesso non perfetta (storta, sfocata, con riflessi). Estrai SOLO i dati che riesci a leggere con sicurezza. Non inventare o dedurre mai un dato che non è chiaramente visibile: se un campo non si legge, lascialo null — questi dati vengono incollati su moduli di registrazione reali, un dato sbagliato è peggio di un campo vuoto. In particolare: il comune di NASCITA non è il comune di RESIDENZA, non confonderli mai nel campo "citta" (che è la residenza, se presente sul documento). Rispondi SOLO con un oggetto JSON valido, senza testo prima o dopo, con questa forma esatta: {"nome":string|null,"cognome":string|null,"data_nascita":string|null,"indirizzo":string|null,"cap":string|null,"citta":string|null,"numero_documento":string|null,"data_rilascio":string|null,"data_scadenza":string|null}. Le date in formato gg/mm/aaaa se presenti. "indirizzo" è via/piazza e numero civico, senza città/CAP. "numero_documento" è il numero identificativo stampato sul documento (carta d\'identità, tessera sanitaria/codice fiscale, o patente — a seconda di cosa vedi).';

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 500,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: data } },
            { type: 'text', text: 'Leggi questo documento ed estrai i dati richiesti.' }
          ]
        }]
      })
    });
    const result = await res.json();
    if (!res.ok) return { statusCode: 502, body: JSON.stringify({ error: 'Errore Claude', detail: result }) };

    const textBlock = Array.isArray(result.content) ? result.content.find(function (b) { return b.type === 'text'; }) : null;
    const raw = (textBlock && textBlock.text || '').trim().replace(/^```json\s*|```$/g, '').trim();
    let campi;
    try { campi = JSON.parse(raw); }
    catch (e) { return { statusCode: 502, body: JSON.stringify({ error: 'Risposta non interpretabile', detail: raw }) }; }

    return { statusCode: 200, body: JSON.stringify({ ok: true, campi: campi }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Errore interno', detail: String(err && err.message || err) }) };
  }
};
