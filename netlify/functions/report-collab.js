// Netlify Function — genera il riassunto testuale (in italiano semplice) del
// report automatico di un collaboratore MBBET (Gas, Ale e Fede, Lorenzo
// Cestola, Isma, Alan, ecc. — persone pagate a commissione che portano
// clienti). Il chiamante calcola già tutti i numeri (clienti attivi, siti
// mancanti, guadagni, ecc.) lato client/Supabase: qui Claude riceve SOLO
// quei dati già pronti e li trasforma in un breve paragrafo leggibile per il
// titolare dell'agenzia.
//
// Istruzione esplicita al modello: usare ESCLUSIVAMENTE i numeri e i nomi
// presenti nell'input — non deve mai inventare un cliente, una cifra o un
// dettaglio che non gli è stato dato, ed essere onesto quando mancano dati
// (es. array "problemi" vuoto va dichiarato esplicitamente, non riempito).

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

  const nome = body.nome || 'tutti';
  const periodo = body.periodo || 'Periodo non specificato';
  const stats = body.stats;
  const problemi = Array.isArray(body.problemi) ? body.problemi : [];

  if (!stats) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Campo "stats" mancante' }) };
  }

  const systemPrompt = 'Sei l\'assistente che genera il riassunto testuale del report automatico per il/la titolare di un\'agenzia di matched betting (MBBET). Il report riguarda un collaboratore esterno pagato a commissione (es. Gas, Ale e Fede, Lorenzo Cestola, Isma, Alan) che porta e segue dei clienti.\n\nRiceverai in un messaggio un oggetto JSON con: "nome" (il collaboratore, o "tutti"), "periodo" (l\'intervallo di riferimento del report), "stats" (numeri aggregati: totale_clienti, clienti_attivi, clienti_fermi, clienti_con_problemi, clienti_conclusi, siti_completati, siti_mancanti, bonus_attivi, capitale_fermo, guadagno_previsto, guadagno_completato, giorni_inattivita_media) e "problemi" (un array di casi specifici, ognuno con cliente, motivo, e giorni_fermo se disponibile).\n\nIl tuo compito: scrivere un riassunto breve (4-8 frasi) in italiano semplice e diretto, nello stile "Gas gestisce attualmente 24 clienti. Cinque clienti non ricevono aggiornamenti da più di sette giorni. Tre clienti hanno documenti mancanti. Il cliente Marco Rossi è fermo perché manca il contratto. La priorità di oggi è completare X, Y e Z." Regole obbligatorie e non negoziabili:\n\n1. Usa ESCLUSIVAMENTE i numeri presenti in "stats" e i nomi/motivi presenti nell\'array "problemi". Non inventare mai un nome di cliente, una cifra, un motivo o un dettaglio che non ti è stato fornito nell\'input.\n2. Se l\'array "problemi" è vuoto, dillo esplicitamente (es. "Non risultano problemi segnalati in questo periodo.") invece di inventare o supporre casi.\n3. Se un valore in "stats" è 0, mancante o non significativo, non forzarlo in una frase: ometti quel dato o dichiara che non ci sono elementi in quella categoria, senza inventare spiegazioni.\n4. Nomina il periodo di riferimento ("periodo") da qualche parte nel testo.\n5. Non promettere mai risultati economici garantiti: i valori di guadagno vanno presentati come dati numerici (previsti/completati), mai come garanzie o promesse future.\n6. Se "nome" è "tutti", scrivi il riassunto a livello aggregato (tutti i collaboratori insieme), altrimenti riferisciti al collaboratore per nome.\n7. Scrivi in modo diretto e concreto, senza preamboli, senza intestazioni, senza markdown: solo il paragrafo di testo. Se ha senso, chiudi con una frase sulla priorità del giorno basata solo sui dati forniti (es. sui problemi elencati o sui siti mancanti).\n\nSii onesto se i dati sono insufficienti per dire qualcosa di specifico: in quel caso dillo apertamente invece di riempire il vuoto con supposizioni.';

  const userMessage = JSON.stringify({ nome: nome, periodo: periodo, stats: stats, problemi: problemi });

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 600,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }]
      })
    });
    const result = await res.json();
    if (!res.ok) return { statusCode: 502, body: JSON.stringify({ error: 'Errore Claude', detail: result }) };

    // Claude a volte antepone un blocco "thinking" prima del testo vero:
    // va cercato il primo blocco di tipo "text", non dato per scontato che
    // sia il primo elemento dell'array.
    const textBlock = Array.isArray(result.content) ? result.content.find(function (b) { return b.type === 'text'; }) : null;
    const testo = (textBlock && textBlock.text || '').trim();
    if (!testo) return { statusCode: 502, body: JSON.stringify({ error: 'Risposta non interpretabile', detail: result }) };

    return { statusCode: 200, body: JSON.stringify({ ok: true, testo: testo }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Errore interno', detail: String(err && err.message || err) }) };
  }
};
