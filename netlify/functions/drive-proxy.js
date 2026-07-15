// Google Drive non manda le intestazioni CORS sui suoi link diretti alle
// immagini: un <img> le mostra lo stesso (il browser non applica CORS al
// semplice caricamento visivo), ma qualunque script che debba leggerne i
// pixel (l'OCR di Clienti Attivi, in questo caso) viene bloccato dal
// browser perché l'immagine è "cross-origin senza permesso". Questa
// funzione la scarica lato server e la rimanda indietro con l'intestazione
// giusta, così lo script può leggerla. Funziona solo per i file già
// condivisi come "chiunque abbia il link" — per gli altri Drive risponde
// comunque con un errore di permessi, che qui si traduce in un errore
// chiaro invece di un blocco silenzioso.
exports.handler = async (event) => {
  const id = event.queryStringParameters && event.queryStringParameters.id;
  if (!id) {
    return { statusCode: 400, headers: { 'Access-Control-Allow-Origin': '*' }, body: 'Manca il parametro id' };
  }
  try {
    const url = 'https://drive.google.com/uc?export=view&id=' + encodeURIComponent(id);
    const resp = await fetch(url, { redirect: 'follow' });
    if (!resp.ok) {
      return { statusCode: resp.status, headers: { 'Access-Control-Allow-Origin': '*' }, body: 'Documento non raggiungibile su Drive (codice ' + resp.status + '). Probabilmente non è condiviso come "chiunque abbia il link".' };
    }
    const contentType = resp.headers.get('content-type') || 'application/octet-stream';
    if (contentType.indexOf('image') < 0) {
      return { statusCode: 422, headers: { 'Access-Control-Allow-Origin': '*' }, body: 'Il file non sembra un\'immagine (permessi Drive non ancora pubblici).' };
    }
    const buffer = Buffer.from(await resp.arrayBuffer());
    return {
      statusCode: 200,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600'
      },
      body: buffer.toString('base64'),
      isBase64Encoded: true
    };
  } catch (err) {
    return { statusCode: 500, headers: { 'Access-Control-Allow-Origin': '*' }, body: 'Errore: ' + String((err && err.message) || err) };
  }
};
