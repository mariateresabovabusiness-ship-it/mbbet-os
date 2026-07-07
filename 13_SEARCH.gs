// ═══════════════════════════════════════════════════════════════════════
//   CRM MBBET · 13_SEARCH.gs
//   Foglio RICERCA — cerca cliente per nome, tel, email, ID
//   v3.0
// ═══════════════════════════════════════════════════════════════════════

const Search = (() => {

  // ══════════════════════════════════════════════════════════════════
  // RUN — lanciato da onEdit quando l'utente scrive in RICERCA!A3
  // ══════════════════════════════════════════════════════════════════

  function run() {
    const ss    = DB.ss();
    const shR   = ss.getSheetByName(SH.RICERCA);
    if (!shR) return;

    const query = (shR.getRange('A3').getValue() || '').toString().trim();

    // Pulisci area risultati (righe 6+)
    if (shR.getLastRow() >= 6) {
      shR.getRange(6, 1, Math.max(shR.getLastRow() - 5, 1), 14)
         .clearContent().setBackground(C.NAVY).setFontColor(C.NAVY)
         .setBorder(false, false, false, false, false, false);
    }

    if (!query || query.length < 2) {
      shR.getRange('A4').setValue('✏️  Scrivi almeno 2 caratteri in A3');
      return;
    }

    const risultati = Client.search(query);

    if (risultati.length === 0) {
      shR.getRange('A4').setValue(`❌  Nessun risultato per: "${query}"`);
      return;
    }

    shR.getRange('A4').setValue(`✅  ${risultati.length} risultato/i per: "${query}"`);
    _renderResults(shR, risultati);
  }

  // ══════════════════════════════════════════════════════════════════
  // RENDER — scrive i risultati a partire da riga 6
  // ══════════════════════════════════════════════════════════════════

  function _renderResults(shR, risultati) {
    const bnsData = DB.read(SH.BONUS);

    risultati.slice(0, 20).forEach((r, i) => {
      const rigaR = 6 + i * 7; // ogni cliente occupa 7 righe

      // ── Riga 1: ID + Nome + Stato ──────────────────────────────
      shR.setRowHeight(rigaR, 32);
      const statoColor = _statoColor(r[COL.CLI.STATO]);
      shR.getRange(rigaR, 1, 1, 14).setBackground('#1e293b');
      shR.getRange(rigaR, 1)
         .setValue(r[COL.CLI.ID])
         .setFontSize(11).setFontWeight('bold').setFontColor(C.GOLD)
         .setVerticalAlignment('middle');
      shR.getRange(rigaR, 2, 1, 5).merge()
         .setValue(r[COL.CLI.NOME])
         .setFontSize(14).setFontWeight('bold').setFontColor('#f8fafc')
         .setVerticalAlignment('middle');
      shR.getRange(rigaR, 7)
         .setValue(r[COL.CLI.STATO] || '—')
         .setFontSize(11).setFontWeight('bold')
         .setFontColor(statoColor.fg).setBackground(statoColor.bg)
         .setHorizontalAlignment('center').setVerticalAlignment('middle');
      shR.getRange(rigaR, 8)
         .setValue(r[COL.CLI.OPERATORE] || '—')
         .setFontSize(11).setFontColor('#94a3b8').setVerticalAlignment('middle');

      // ── Riga 2: Contatti ────────────────────────────────────────
      shR.setRowHeight(rigaR + 1, 22);
      shR.getRange(rigaR + 1, 1, 1, 14).setBackground('#0f172a');
      shR.getRange(rigaR + 1, 1)
         .setValue('📱 Tel').setFontSize(10).setFontColor('#64748b');
      shR.getRange(rigaR + 1, 2)
         .setValue(r[COL.CLI.TEL] || '—').setFontSize(10).setFontColor('#e2e8f0');
      shR.getRange(rigaR + 1, 3)
         .setValue('📧 Email').setFontSize(10).setFontColor('#64748b');
      shR.getRange(rigaR + 1, 4, 1, 2).merge()
         .setValue(r[COL.CLI.EMAIL] || '—').setFontSize(10).setFontColor('#e2e8f0');
      shR.getRange(rigaR + 1, 6)
         .setValue('🌐 Siti').setFontSize(10).setFontColor('#64748b');
      shR.getRange(rigaR + 1, 7, 1, 3).merge()
         .setValue(r[COL.CLI.EMAIL_SITI] || '—').setFontSize(10).setFontColor('#e2e8f0');

      // ── Riga 3: Finanze ─────────────────────────────────────────
      shR.setRowHeight(rigaR + 2, 22);
      shR.getRange(rigaR + 2, 1, 1, 14).setBackground('#0f172a');
      shR.getRange(rigaR + 2, 1)
         .setValue('💰 Ricavo').setFontSize(10).setFontColor('#64748b');
      shR.getRange(rigaR + 2, 2)
         .setValue(r[COL.CLI.TOT_RICAVO] || 0).setFontSize(10).setFontColor('#34d399')
         .setNumberFormat(FMT.EURO);
      shR.getRange(rigaR + 2, 3)
         .setValue('💸 Pagato').setFontSize(10).setFontColor('#64748b');
      shR.getRange(rigaR + 2, 4)
         .setValue(r[COL.CLI.TOT_PAGATO] || 0).setFontSize(10).setFontColor('#f87171')
         .setNumberFormat(FMT.EURO);
      shR.getRange(rigaR + 2, 5)
         .setValue('📈 Margine').setFontSize(10).setFontColor('#64748b');
      const marg = parseFloat(r[COL.CLI.MARGINE]) || 0;
      shR.getRange(rigaR + 2, 6)
         .setValue(marg).setFontSize(10).setFontWeight('bold')
         .setFontColor(marg >= 0 ? '#34d399' : '#f87171')
         .setNumberFormat(FMT.EURO);
      shR.getRange(rigaR + 2, 7)
         .setValue('🔗 Referral').setFontSize(10).setFontColor('#64748b');
      shR.getRange(rigaR + 2, 8)
         .setValue(r[COL.CLI.REFERRAL] || '—').setFontSize(10).setFontColor('#e2e8f0');

      // ── Riga 4: Accettazione + Penale ───────────────────────────
      shR.setRowHeight(rigaR + 3, 22);
      shR.getRange(rigaR + 3, 1, 1, 14).setBackground('#0f172a');
      shR.getRange(rigaR + 3, 1)
         .setValue('📜 Accett.').setFontSize(10).setFontColor('#64748b');
      const statoAcc = r[COL.CLI.STATO_ACC] || '—';
      const accColor = statoAcc === 'Accettato' ? '#34d399' : '#fbbf24';
      shR.getRange(rigaR + 3, 2)
         .setValue(statoAcc).setFontSize(10).setFontColor(accColor);
      shR.getRange(rigaR + 3, 3)
         .setValue('📅 Data').setFontSize(10).setFontColor('#64748b');
      shR.getRange(rigaR + 3, 4)
         .setValue(r[COL.CLI.DATA_ACC] instanceof Date ? fmtDate(r[COL.CLI.DATA_ACC]) : '—')
         .setFontSize(10).setFontColor('#e2e8f0');
      const hasPenale = (parseFloat(r[COL.CLI.TOT_PENALE]) || 0) > 0;
      shR.getRange(rigaR + 3, 5)
         .setValue('⚠️ Penale').setFontSize(10).setFontColor('#64748b');
      shR.getRange(rigaR + 3, 6)
         .setValue(hasPenale ? fmtEuro(parseFloat(r[COL.CLI.TOT_PENALE])) : '—')
         .setFontSize(10).setFontColor(hasPenale ? '#fca5a5' : '#94a3b8')
         .setFontWeight(hasPenale ? 'bold' : 'normal');
      shR.getRange(rigaR + 3, 7)
         .setValue('📁 Drive').setFontSize(10).setFontColor('#64748b');
      const driveUrl = r[COL.CLI.DRIVE];
      if (driveUrl) {
        shR.getRange(rigaR + 3, 8)
           .setFormula(`=HYPERLINK("${driveUrl}","📂 Apri cartella")`)
           .setFontSize(10).setFontColor('#60a5fa');
      } else {
        shR.getRange(rigaR + 3, 8)
           .setValue('❌ Non creata').setFontSize(10).setFontColor('#f87171');
      }

      // ── Riga 5: Bonus attivi ─────────────────────────────────────
      shR.setRowHeight(rigaR + 4, 22);
      shR.getRange(rigaR + 4, 1, 1, 14).setBackground('#0f172a');
      const idC      = r[COL.CLI.ID];
      const bnsCli   = bnsData.filter(b => b[COL.BNS.ID_CLI] === idC);
      const inCorso  = bnsCli.filter(b => b[COL.BNS.STATO] === 'IN CORSO');
      const liberi   = bnsCli.filter(b => b[COL.BNS.STATO] === 'LIBERO');
      const fatti    = bnsCli.filter(b => b[COL.BNS.STATO] === 'FATTO');
      shR.getRange(rigaR + 4, 1)
         .setValue('🎰 Bonus').setFontSize(10).setFontColor('#64748b');
      shR.getRange(rigaR + 4, 2, 1, 4).merge()
         .setValue(`IN CORSO: ${inCorso.length} | LIBERI: ${liberi.length} | FATTI: ${fatti.length} | TOTALE BK: ${bnsCli.length}`)
         .setFontSize(10).setFontColor('#e2e8f0');
      if (inCorso.length > 0) {
        shR.getRange(rigaR + 4, 6, 1, 4).merge()
           .setValue(`▶ ${inCorso.slice(0,3).map(b=>b[COL.BNS.BK]).join(', ')}`)
           .setFontSize(10).setFontColor('#a78bfa');
      }

      // ── Riga 6: Note ────────────────────────────────────────────
      shR.setRowHeight(rigaR + 5, 20);
      shR.getRange(rigaR + 5, 1, 1, 14).setBackground('#0f172a');
      const note = r[COL.CLI.NOTE] || '';
      if (note) {
        shR.getRange(rigaR + 5, 1)
           .setValue('📝').setFontSize(10).setFontColor('#64748b');
        shR.getRange(rigaR + 5, 2, 1, 8).merge()
           .setValue(note).setFontSize(10).setFontColor('#94a3b8').setWrap(true);
      }

      // ── Separatore ─────────────────────────────────────────────
      shR.setRowHeight(rigaR + 6, 8);
      shR.getRange(rigaR + 6, 1, 1, 14).setBackground(C.NAVY);
    });

    SpreadsheetApp.flush();
  }

  // ── Colore per stato cliente ─────────────────────────────────────

  function _statoColor(stato) {
    const map = {
      'ATTIVO':     {bg:'#134e2f', fg:'#86efac'},
      'IN PAUSA':   {bg:'#2d1c02', fg:'#fde68a'},
      'BLOCCATO':   {bg:'#450a0a', fg:'#fca5a5'},
      'TERMINATO':  {bg:'#1e293b', fg:'#64748b'},
    };
    return map[stato] || {bg:'#1e293b', fg:'#94a3b8'};
  }

  // ══════════════════════════════════════════════════════════════════
  // SETUP FOGLIO — costruisce il foglio RICERCA
  // ══════════════════════════════════════════════════════════════════

  function setup() {
    const ss = DB.ss();
    let sh = ss.getSheetByName(SH.RICERCA);
    if (!sh) sh = ss.insertSheet(SH.RICERCA);

    sh.clearContents();
    sh.clearFormats();
    sh.getRange('A1:Z200').setBackground(C.NAVY);

    sh.setColumnWidth(1, 120);
    sh.setColumnWidth(2, 200);
    sh.setColumnWidth(3, 200);
    sh.setColumnWidth(4, 200);
    sh.setColumnWidth(5, 160);
    sh.setColumnWidth(6, 140);
    sh.setColumnWidth(7, 140);
    sh.setColumnWidth(8, 200);
    sh.setColumnWidth(9, 160);

    // Header
    sh.setRowHeight(1, 44);
    sh.getRange('A1:I1').merge()
      .setValue('🔍  RICERCA CLIENTE')
      .setFontSize(20).setFontWeight('bold').setFontColor(C.GOLD)
      .setBackground('#0f172a').setHorizontalAlignment('center')
      .setVerticalAlignment('middle');

    sh.setRowHeight(2, 30);
    sh.getRange('A2:I2').merge()
      .setValue('Cerca per nome, telefono, email o ID (es: MBBET-042)')
      .setFontSize(11).setFontColor('#94a3b8')
      .setBackground('#0f172a').setHorizontalAlignment('center');

    // Input
    sh.setRowHeight(3, 40);
    sh.getRange('A3').setValue('🔍 Cerca:')
      .setFontSize(12).setFontWeight('bold').setFontColor(C.GOLD)
      .setBackground('#1e293b').setVerticalAlignment('middle')
      .setHorizontalAlignment('center');
    sh.getRange('B3:I3').merge()
      .setValue('')
      .setFontSize(14).setFontColor('#f8fafc')
      .setBackground('#334155')
      .setBorder(true, true, true, true, false, false, C.GOLD, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

    // Stato
    sh.setRowHeight(4, 24);
    sh.getRange('A4:I4').merge()
      .setValue('✏️  Scrivi nella cella B3 e premi Invio')
      .setFontSize(11).setFontColor('#64748b')
      .setBackground('#0f172a').setHorizontalAlignment('center');

    sh.setRowHeight(5, 8);
    sh.getRange('A5:I5').setBackground(C.GOLD);

    sh.setFrozenRows(5);
    SpreadsheetApp.flush();
  }

  // ── EXPOSE ────────────────────────────────────────────────────────
  return { run, setup };

})();

// Alias globale
const SearchSetup = { run: () => Search.setup() };
