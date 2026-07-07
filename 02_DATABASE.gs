// ═══════════════════════════════════════════════════════════════════════
//   CRM MBBET · 02_DATABASE.gs
//   Database Layer — CRUD, Caching, Batch Operations
//   v3.0
// ═══════════════════════════════════════════════════════════════════════
//
//   REGOLA: nessun altro file legge/scrive fogli direttamente.
//   Tutti passano da qui. Questo garantisce:
//   - Zero chiamate duplicate al foglio
//   - Caching automatico (invalidato a ogni write)
//   - Gestione errori centralizzata
//   - Log automatico di ogni mutazione
//
//   API pubblica:
//   DB.read(sheetName)            → righe dati (senza header), cached
//   DB.write(sheetName, rows)     → batch append
//   DB.update(sheetName, rowIdx, cols) → aggiorna celle specifiche
//   DB.findById(sheetName, id)    → prima riga con col[0] === id
//   DB.maxId(sheetName, prefix)   → prossimo ID numerico disponibile
//   DB.nextId(sheetName, pfx, pad) → prossimo ID formattato
//   DB.invalidate(sheetName)      → svuota cache di un foglio
//   DB.invalidateAll()            → svuota tutta la cache
//   DB.log(tipo, id, nome, det, esito, err)
//   DB.config(key)                → legge configurazione da CONFIG
// ═══════════════════════════════════════════════════════════════════════

const DB = (() => {

  // ── Cache interna ──────────────────────────────────────────────────────
  //    chiave: nome foglio, valore: {data: [], ts: timestamp}
  //    invalidata da ogni write/update

  const _cache = {};
  const _CACHE_TTL = 5 * 60 * 1000; // 5 minuti in ms
  let   _ss = null;

  // ── Riferimento spreadsheet (lazy) ────────────────────────────────────

  function _getSpreadsheet() {
    if (!_ss) _ss = SpreadsheetApp.getActiveSpreadsheet();
    return _ss;
  }

  function _getSheet(name) {
    const sh = _getSpreadsheet().getSheetByName(name);
    if (!sh) throw new Error(`Foglio non trovato: "${name}"`);
    return sh;
  }

  // ── Gestione cache ─────────────────────────────────────────────────────

  function _isCacheValid(name) {
    const entry = _cache[name];
    if (!entry) return false;
    return (Date.now() - entry.ts) < _CACHE_TTL;
  }

  function invalidate(name) {
    delete _cache[name];
  }

  function invalidateAll() {
    Object.keys(_cache).forEach(k => delete _cache[k]);
  }

  // ── READ ───────────────────────────────────────────────────────────────
  //    Restituisce tutte le righe dati (senza header row 1).
  //    Usa cache se disponibile.

  function read(sheetName) {
    if (_isCacheValid(sheetName)) {
      return _cache[sheetName].data;
    }
    const sh = _getSheet(sheetName);
    const lastRow = sh.getLastRow();
    const lastCol = sh.getLastColumn();
    if (lastRow <= 1 || lastCol === 0) {
      _cache[sheetName] = {data: [], ts: Date.now()};
      return [];
    }
    const data = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
    _cache[sheetName] = {data, ts: Date.now()};
    return data;
  }

  // ── READ con filtro inline ─────────────────────────────────────────────
  //    Evita di creare array intermedi enormi

  function find(sheetName, predicate) {
    return read(sheetName).filter(predicate);
  }

  function findFirst(sheetName, predicate) {
    return read(sheetName).find(predicate) || null;
  }

  // ── FIND BY ID ────────────────────────────────────────────────────────
  //    Cerca nella colonna 0 (ID). Ritorna {row, idx} o null.

  function findById(sheetName, id) {
    const data = read(sheetName);
    const idx  = data.findIndex(r => r[0] === id);
    if (idx === -1) return null;
    return {row: data[idx], idx, sheetRow: idx + 2};  // sheetRow = riga nel foglio (1-based + header)
  }

  // ── FIND BY COL VALUE ────────────────────────────────────────────────

  function findByCol(sheetName, colIdx, value) {
    const v = (value || '').toString().toLowerCase().trim();
    return read(sheetName).filter(r =>
      (r[colIdx] || '').toString().toLowerCase().trim() === v
    );
  }

  // ── WRITE (batch append) ───────────────────────────────────────────────
  //    rows: array di array [[val1, val2, ...], ...]
  //    Scrive in una singola chiamata. Invalida cache.

  function write(sheetName, rows) {
    if (!rows || rows.length === 0) return 0;
    const sh = _getSheet(sheetName);
    const firstRow = sh.getLastRow() + 1;
    sh.getRange(firstRow, 1, rows.length, rows[0].length).setValues(rows);
    invalidate(sheetName);
    return rows.length;
  }

  // ── WRITE WITH FORMULAS ───────────────────────────────────────────────
  //    Scrive valori E formula separatamente per le colonne formula.
  //    formulaCols: {colIdx: (sheetRowNum) => formula}

  function writeWithFormulas(sheetName, rows, formulaCols) {
    if (!rows || rows.length === 0) return 0;
    const sh = _getSheet(sheetName);
    const firstRow = sh.getLastRow() + 1;

    // Scrivi valori (senza colonne formula)
    sh.getRange(firstRow, 1, rows.length, rows[0].length).setValues(rows);

    // Scrivi formule per ogni colonna formula
    if (formulaCols) {
      Object.entries(formulaCols).forEach(([colIdx, fFn]) => {
        const colNum = parseInt(colIdx) + 1; // 0-based → 1-based
        const formulas = rows.map((_, i) => [fFn(firstRow + i)]);
        sh.getRange(firstRow, colNum, rows.length, 1).setFormulas(formulas);
      });
    }

    invalidate(sheetName);
    return rows.length;
  }

  // ── UPDATE SINGOLA RIGA ───────────────────────────────────────────────
  //    sheetRow: riga nel foglio (1-based, incluso header → dati da riga 2)
  //    updates: {colIdx: newValue, ...}

  function update(sheetName, sheetRow, updates) {
    if (!updates || Object.keys(updates).length === 0) return;
    const sh = _getSheet(sheetName);
    Object.entries(updates).forEach(([colIdx, value]) => {
      sh.getRange(sheetRow, parseInt(colIdx) + 1).setValue(value);
    });
    invalidate(sheetName);
  }

  // ── UPDATE FORMULA ────────────────────────────────────────────────────

  function updateFormula(sheetName, sheetRow, colIdx, formula) {
    const sh = _getSheet(sheetName);
    sh.getRange(sheetRow, colIdx + 1).setFormula(formula);
    invalidate(sheetName);
  }

  // ── MAX ID ────────────────────────────────────────────────────────────
  //    Legge il massimo numero usato per ID con il dato prefisso.
  //    Esempio: prefix='MBBET-' → trova 'MBBET-042' → ritorna 42

  function maxId(sheetName, prefix) {
    const data = read(sheetName);
    return data.reduce((m, r) => {
      const v = (r[0] || '').toString();
      if (!v.startsWith(prefix)) return m;
      const n = parseInt(v.slice(prefix.length)) || 0;
      return n > m ? n : m;
    }, 0);
  }

  // ── NEXT ID ───────────────────────────────────────────────────────────

  function nextId(sheetName, prefix, padding) {
    return mkId(prefix, maxId(sheetName, prefix) + 1, padding || 4);
  }

  // ── LOG ───────────────────────────────────────────────────────────────

  function log(tipo, id, nome, det, esito, err) {
    try {
      const sh = _getSpreadsheet().getSheetByName(SH.LOG);
      if (!sh) return;
      const now = new Date();
      sh.appendRow([now, tipo, id || '', nome || '', det || '', esito || 'OK', err || '']);
      // Taglia se supera limite
      const lastRow = sh.getLastRow();
      if (lastRow > CFG.MAX_LOG + 1) {
        sh.deleteRows(2, lastRow - CFG.MAX_LOG - 1);
      }
      invalidate(SH.LOG);
    } catch (_) { /* silenzioso */ }
  }

  // ── CONFIG ────────────────────────────────────────────────────────────
  //    Legge un valore dalla sheet CONFIG cercando per chiave (col A = chiave, col B = valore)

  function config(key) {
    try {
      const sh = _getSpreadsheet().getSheetByName(SH.CFG);
      if (!sh) return null;
      const data = sh.getDataRange().getValues();
      const row = data.find(r => (r[0] || '').toString().trim().toLowerCase() === key.toLowerCase());
      return row ? (row[1] || null) : null;
    } catch (_) { return null; }
  }

  // ── HEADER VALIDATION ─────────────────────────────────────────────────
  //    Verifica che gli header in riga 1 corrispondano allo schema atteso.
  //    Ritorna lista di discrepanze, vuota se tutto ok.

  function validateHeaders(sheetName, expectedHeaders) {
    try {
      const sh = _getSheet(sheetName);
      if (sh.getLastRow() === 0) return [];
      const actual = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
      const issues = [];
      expectedHeaders.forEach((exp, i) => {
        if ((actual[i] || '').toString().trim() !== exp) {
          issues.push(`Col ${i+1}: atteso "${exp}", trovato "${actual[i] || '(vuoto)'}"`);
        }
      });
      return issues;
    } catch (e) {
      return [`Errore: ${e.message}`];
    }
  }

  // ── SHEET EXISTS ──────────────────────────────────────────────────────

  function exists(sheetName) {
    return !!_getSpreadsheet().getSheetByName(sheetName);
  }

  // ── COUNT ─────────────────────────────────────────────────────────────

  function count(sheetName) {
    return read(sheetName).length;
  }

  function countWhere(sheetName, colIdx, value) {
    return read(sheetName).filter(r =>
      (r[colIdx] || '').toString().toLowerCase() === (value || '').toString().toLowerCase()
    ).length;
  }

  // ── SUM ───────────────────────────────────────────────────────────────

  function sumWhere(sheetName, sumColIdx, filterColIdx, filterValue) {
    return read(sheetName)
      .filter(r => (r[filterColIdx] || '').toString() === filterValue)
      .reduce((s, r) => s + (parseFloat(r[sumColIdx]) || 0), 0);
  }

  // ── DUPLICATE CHECK ───────────────────────────────────────────────────
  //    Controlla se esiste già una riga con queste combinazioni di valori.
  //    combos: array di array di indici colonna
  //    Esempio: [[1,2], [1,3], [2,3]] = controlla nome+tel, nome+email, tel+email

  function hasDuplicate(sheetName, values, combos) {
    const data = read(sheetName);
    return combos.some(cols =>
      data.some(r =>
        cols.every(ci => {
          const a = (r[ci] || '').toString().toLowerCase().trim();
          const b = (values[ci] || '').toString().toLowerCase().trim();
          return a && b && a === b;
        })
      )
    );
  }

  // ── EXPOSE API ────────────────────────────────────────────────────────

  return {
    read,
    find,
    findFirst,
    findById,
    findByCol,
    write,
    writeWithFormulas,
    update,
    updateFormula,
    maxId,
    nextId,
    log,
    config,
    validateHeaders,
    exists,
    count,
    countWhere,
    sumWhere,
    hasDuplicate,
    invalidate,
    invalidateAll,
    ss: _getSpreadsheet,
  };

})();

// ── FORMULE CALCOLATE ─────────────────────────────────────────────────────
//    Generatori di formula per le colonne calcolate.
//    Centralizzati qui per mantenere coerenza tra import e write live.

const FX = {

  // CLIENTI: totale ricavo (SUMIF su BONUS per questo cliente)
  cli_totRicavo: (r, idCell) =>
    `=IFERROR(SUMIF('${SH.BONUS}'!B:B,A${r},'${SH.BONUS}'!K:K),0)`,

  // CLIENTI: totale pagato
  cli_totPagato: (r) =>
    `=IFERROR(SUMIF('${SH.BONUS}'!B:B,A${r},'${SH.BONUS}'!L:L),0)`,

  // CLIENTI: margine = ricavo - pagato - (comp op da BONUS) - (comp collab da BONUS)
  cli_margine: (r) =>
    `=IFERROR(N${r}-O${r}-SUMIF('${SH.BONUS}'!B:B,A${r},'${SH.BONUS}'!M:M)-SUMIF('${SH.BONUS}'!B:B,A${r},'${SH.BONUS}'!W:W),0)`,

  // CLIENTI: giorni ritardo (col AB = 28)
  cli_ggRitardo: (r) =>
    `=IFERROR(IF(AD${r}="",IF(Y${r}<>"",MAX(0,TODAY()-Y${r}-2),0),MAX(0,AD${r}-Y${r}-2)),0)`,

  // CLIENTI: totale penale (col AC = 29)
  cli_totPenale: (r) =>
    `=IFERROR(AB${r}*${CFG.PENALE_GG},0)`,

  // BONUS: comp. operatore = ricavo_reale * % / 100
  bns_compOp: (r) =>
    `=IFERROR(K${r}*H${r}/100,0)`,

  // BONUS: margine = ricavo_reale - pagato - comp_op - costi_extra - comp_collab
  bns_margine: (r) =>
    `=IFERROR(K${r}-L${r}-M${r}-N${r}-IF(W${r}<>"",W${r},0),0)`,

  // COLLAB: clienti portati
  clb_cliPortati: (r, nomeCell) =>
    `=IFERROR(COUNTIF('${SH.CLIENTI}'!X:X,B${r}),0)`,

  // COLLAB: bonus collegati
  clb_bnsCollegati: (r) =>
    `=IFERROR(COUNTIF('${SH.BONUS}'!V:V,B${r}),0)`,

  // COLLAB: totale ricavo generato
  clb_totRic: (r) =>
    `=IFERROR(SUMIF('${SH.BONUS}'!V:V,B${r},'${SH.BONUS}'!K:K),0)`,

  // COLLAB: totale compenso = totale ricavo * %
  clb_totComp: (r) =>
    `=IFERROR(I${r}*H${r}/100,0)`,

  // COLLAB: saldo da pagare = compenso - pagato
  clb_saldo: (r) =>
    `=IFERROR(J${r}-SUMIF('${SH2.PAGAMENTI}'!F:F,B${r},'${SH2.PAGAMENTI}'!G:G),0)`,
};

// ── NUMERO FORMATO ────────────────────────────────────────────────────────
//    Helper per formattare celle dopo una write

const FMT = {
  EURO:  '€#,##0.00',
  DATA:  'dd/mm/yyyy',
  ORARIO:'dd/mm/yyyy hh:mm',
  PERC:  '0.00%',
  NUM:   '#,##0',
  INT:   '0',
};
