// ═══════════════════════════════════════════════════════════════════════
//   CRM MBBET · 10_SETUP.gs
//   Setup Module — Crea e configura tutti i fogli
//   v3.0
// ═══════════════════════════════════════════════════════════════════════
//
//   Funzione principale: Setup.run()
//   Crea tutti i fogli, applica formattazione, validazioni, banding.
//   Idempotente: eseguibile più volte senza distruggere dati esistenti.
// ═══════════════════════════════════════════════════════════════════════

const Setup = (() => {

  // ── Helper: ottieni o crea foglio ─────────────────────────────────────

  function _sh(nome) {
    const ss = DB.ss();
    return ss.getSheetByName(nome) || ss.insertSheet(nome);
  }

  // ── Helper: applica stile header riga 1 ──────────────────────────────

  function _headerRow(sh, headers, bgColor) {
    const bg  = bgColor || C.NAVY2;
    const row = sh.getRange(1, 1, 1, headers.length);
    row.setValues([headers])
       .setBackground(bg)
       .setFontColor(C.GOLD)
       .setFontWeight('bold')
       .setFontSize(9)
       .setHorizontalAlignment('center')
       .setVerticalAlignment('middle');
    sh.setRowHeight(1, 32);
    sh.setFrozenRows(1);
  }

  // ── Helper: banding standard ─────────────────────────────────────────

  function _banding(sh, startRow, nRows, nCols) {
    try { sh.getBandings().forEach(b => b.remove()); } catch(_) {}
    sh.getRange(startRow, 1, nRows, nCols)
      .applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY)
      .setHeaderRowColor(C.NAVY2)
      .setFirstRowColor(C.NAVY)
      .setSecondRowColor(C.NAVY3);
  }

  // ── Helper: validazione dropdown da lista ─────────────────────────────

  function _dropdown(sh, startRow, col, list, nRows) {
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(list, true)
      .setAllowInvalid(false)
      .build();
    sh.getRange(startRow, col, nRows || 3000, 1).setDataValidation(rule);
  }

  // ── Helper: formattazione condizionale stato BK ───────────────────────

  function _cfStatoBK(sh, col) {
    const rules = [];
    STATI_BK.forEach(stato => {
      const s = STATUS_STYLE[stato];
      if (!s) return;
      rules.push(
        SpreadsheetApp.newConditionalFormatRule()
          .whenTextEqualTo(stato)
          .setBackground(s.bg).setFontColor(s.fg)
          .setRanges([sh.getRange(2, col, 5000)])
          .build()
      );
    });
    const existing = sh.getConditionalFormatRules();
    sh.setConditionalFormatRules([...existing, ...rules]);
  }

  // ── Helper: larghezze colonne ─────────────────────────────────────────

  function _widths(sh, widthsArr, startCol) {
    widthsArr.forEach((w, i) => {
      if (w > 0) sh.setColumnWidth((startCol || 1) + i, w);
    });
  }

  // ════════════════════════════════════════════════════════════════════
  // SETUP SINGOLI FOGLI
  // ════════════════════════════════════════════════════════════════════

  function _setupClienti() {
    const sh = _sh(SH.CLIENTI);
    sh.setTabColor(C.BLUE);
    sh.hideGridlines();
    if (sh.getLastRow() === 0) _headerRow(sh, HDR.CLIENTI);

    // Larghezze colonne
    _widths(sh, [
      110,180,120,170,170, // ID, Nome, Tel, Email, EmailSiti
      100,140,110,70,70,   // Oper, Ref, Tipo, SPID, CC
      110,100,60,           // DataIng, Stato, Drive(link)
      110,110,110,           // Ricavo, Pagato, Margine
      100,100,160,           // CostoRef, Pot, ProssBonus
      80,100,110,180,       // Prio, Mese, Nuovo, Note
      140,120,130,          // Collab, DataAcc, StatoAcc
      90,100,100,120        // PenaleAtt, GgRit, TotPen, DataPrimaOp
    ]);
    sh.setColumnWidth(13, 180); // Drive link

    _dropdown(sh, 2, COL.CLI.STATO + 1,    STATI_CLI);
    _dropdown(sh, 2, COL.CLI.TIPOLOGIA + 1, TIPOLOGIE);
    _dropdown(sh, 2, COL.CLI.PRIORITA + 1,  PRIORITA);
    _dropdown(sh, 2, COL.CLI.SPID + 1,      ['Sì', 'No']);
    _dropdown(sh, 2, COL.CLI.CC + 1,        ['Sì', 'No']);
    _dropdown(sh, 2, COL.CLI.NUOVO_VEC + 1, ['Nuovo', 'Già Cliente']);
    _dropdown(sh, 2, COL.CLI.STATO_ACC + 1, STATI_ACC);
    _dropdown(sh, 2, COL.CLI.PENALE_ATT + 1,['Sì', 'No']);

    // Formattazione condizionale STATO
    const cfRules = [];
    STATI_CLI.forEach(s => {
      const st = STATUS_STYLE[s];
      if (!st) return;
      cfRules.push(
        SpreadsheetApp.newConditionalFormatRule()
          .whenTextEqualTo(s)
          .setBackground(st.bg).setFontColor(st.fg)
          .setRanges([sh.getRange(2, COL.CLI.STATO + 1, 3000)])
          .build()
      );
    });
    sh.setConditionalFormatRules(cfRules);

    sh.setFrozenColumns(2);
    _banding(sh, 2, 3000, HDR.CLIENTI.length);
    sh.getRange(2, COL.CLI.DATA_ING + 1, 3000).setNumberFormat(FMT.DATA);
    sh.getRange(2, COL.CLI.DATA_ACC + 1, 3000).setNumberFormat(FMT.DATA);
    sh.getRange(2, COL.CLI.DATA_PRIMA_OP + 1, 3000).setNumberFormat(FMT.DATA);
    [COL.CLI.TOT_RICAVO, COL.CLI.TOT_PAGATO, COL.CLI.MARGINE,
     COL.CLI.COSTO_REF, COL.CLI.POT_RESIDUO, COL.CLI.TOT_PENALE].forEach(c =>
      sh.getRange(2, c + 1, 3000).setNumberFormat(FMT.EURO)
    );
  }

  function _setupBonus() {
    const sh = _sh(SH.BONUS);
    sh.setTabColor(C.GREEN);
    sh.hideGridlines();
    if (sh.getLastRow() === 0) _headerRow(sh, HDR.BONUS);

    _widths(sh, [
      100,100,170,160,60,  // ID, IDCli, Cliente, BK, Tier
      130,100,70,140,       // Stato, Oper, %, Ref
      110,110,110,          // RicPrev, RicReal, PagCli
      110,100,110,          // CompOp, CostiEx, Margine
      110,120,200,80,200,  // DataAp, UltAz, ProssAz, Prio, Note
      100,140,110           // IDCollab, NomeCollab, CompCollab
    ]);

    _dropdown(sh, 2, COL.BNS.STATO + 1,    STATI_BK);
    _dropdown(sh, 2, COL.BNS.PRIORITA + 1, PRIORITA);
    _cfStatoBK(sh, COL.BNS.STATO + 1);

    sh.setFrozenColumns(4);
    _banding(sh, 2, 10000, HDR.BONUS.length);
    [COL.BNS.RIC_PREV, COL.BNS.RIC_REAL, COL.BNS.PAG_CLI,
     COL.BNS.COMP_OP, COL.BNS.COSTI_EX, COL.BNS.MARGINE,
     COL.BNS.COMP_COLLAB].forEach(c =>
      sh.getRange(2, c + 1, 10000).setNumberFormat(FMT.EURO)
    );
    sh.getRange(2, COL.BNS.DATA_AP + 1, 10000).setNumberFormat(FMT.DATA);
    sh.getRange(2, COL.BNS.ULT_AZ + 1,  10000).setNumberFormat(FMT.DATA);
  }

  function _setupCollab() {
    const sh = _sh(SH.COLLAB);
    sh.setTabColor('#10b981');
    sh.hideGridlines();
    if (sh.getLastRow() === 0) _headerRow(sh, HDR.COLLAB);

    _widths(sh, [90,170,160,130,120,  100,100, 80,120,120,120, 120,110,120,220]);
    _dropdown(sh, 2, COL.CLB.STATO + 1,  STATI_COLLAB);
    _dropdown(sh, 2, COL.CLB.TIPO + 1,   TIPI_COLLAB);
    _banding(sh, 2, 500, HDR.COLLAB.length);
    sh.setFrozenColumns(2);
    [COL.CLB.TOT_RIC, COL.CLB.TOT_COMP, COL.CLB.SALDO].forEach(c =>
      sh.getRange(2, c + 1, 500).setNumberFormat(FMT.EURO)
    );
    sh.getRange(2, COL.CLB.DATA_INI + 1, 500).setNumberFormat(FMT.DATA);
  }

  function _setupPagamenti() {
    const sh = _sh(SH.PAGAMENTI);
    sh.setTabColor('#22c55e');
    sh.hideGridlines();
    if (sh.getLastRow() === 0) _headerRow(sh, HDR.PAGAMENTI);

    _widths(sh, [100,110,100,170,120,170,110,110,200,110,220]);
    _dropdown(sh, 2, COL.PAG.TIPO + 1,   TIPI_PAG);
    _dropdown(sh, 2, COL.PAG.METODO + 1, METODI_PAG);
    _dropdown(sh, 2, COL.PAG.STATO + 1,  STATI_PAG);

    const cfPag = STATI_PAG.map(s => {
      const st = s === 'Pagato' ? {bg:C.GREEN_BG,fg:C.GREEN_T}
               : s === 'Da Pagare' ? {bg:C.RED_BG,fg:C.RED_T}
               : s === 'Parziale' ? {bg:C.YELLOW_BG,fg:C.YELLOW_T}
               : {bg:'#f1f5f9',fg:'#475569'};
      return SpreadsheetApp.newConditionalFormatRule()
        .whenTextEqualTo(s).setBackground(st.bg).setFontColor(st.fg)
        .setRanges([sh.getRange(2, COL.PAG.STATO + 1, 3000)]).build();
    });
    sh.setConditionalFormatRules(cfPag);
    _banding(sh, 2, 3000, HDR.PAGAMENTI.length);
    sh.getRange(2, COL.PAG.IMPORTO + 1, 3000).setNumberFormat(FMT.EURO);
    sh.getRange(2, COL.PAG.DATA + 1, 3000).setNumberFormat(FMT.DATA);
  }

  function _setupPenali() {
    const sh = _sh(SH.PENALI);
    sh.setTabColor('#ef4444');
    sh.hideGridlines();

    // Avviso legale in cima (solo se nuovo foglio)
    if (sh.getLastRow() === 0) {
      sh.getRange('A1:N1').merge()
        .setValue('⚠️  CLAUSOLA PENALE OPERATIVA — Fai revisionare da un avvocato prima dell\'uso con clienti reali')
        .setBackground('#7f1d1d').setFontColor('#fca5a5')
        .setFontWeight('bold').setFontSize(10)
        .setHorizontalAlignment('center').setVerticalAlignment('middle');
      sh.setRowHeight(1, 36);

      sh.getRange('A2:N2').merge()
        .setValue(
          '"Mi impegno a rendermi disponibile per la prima operazione entro 48h dall\'accettazione. ' +
          'In caso contrario, MBBET si riserva di applicare un contributo operativo di €10/giorno di ritardo, ' +
          'deducibile dal primo pagamento spettante." — Da includere nel modulo cliente e accettare separatamente.'
        )
        .setBackground('#450a0a').setFontColor('#fca5a5')
        .setFontSize(8).setWrap(true)
        .setHorizontalAlignment('center').setVerticalAlignment('middle');
      sh.setRowHeight(2, 64);

      sh.setRowHeight(3, 6);
      _headerRow(sh, HDR.PENALI, '#7f1d1d');
      // Sposta header a riga 4
      const hRange = sh.getRange(1, 1, 1, HDR.PENALI.length);
      // Rimuovi header riga 1 che abbiamo appena messo e mettilo in riga 4
      sh.getRange(4, 1, 1, HDR.PENALI.length)
        .setValues([HDR.PENALI])
        .setBackground('#7f1d1d').setFontColor('#fca5a5')
        .setFontWeight('bold').setFontSize(9)
        .setHorizontalAlignment('center').setVerticalAlignment('middle');
      sh.setRowHeight(4, 32);
      sh.setFrozenRows(4);
    }

    _dropdown(sh, 5, COL.PEN.STATO + 1, STATI_PENALE, 2000);
    _banding(sh, 5, 2000, HDR.PENALI.length);
    [COL.PEN.TOT_MAT, COL.PEN.TOT_PAG, COL.PEN.SALDO, COL.PEN.EUR_GG].forEach(c =>
      sh.getRange(5, c + 1, 2000).setNumberFormat(FMT.EURO)
    );
    [COL.PEN.DATA_ACC, COL.PEN.SCAD_48H, COL.PEN.DATA_PRIMA_OP].forEach(c =>
      sh.getRange(5, c + 1, 2000).setNumberFormat(FMT.DATA)
    );
  }

  function _setupTask() {
    const sh = _sh(SH.TASK);
    sh.setTabColor(C.GOLD);
    sh.hideGridlines();
    if (sh.getLastRow() === 0) _headerRow(sh, HDR.TASK);

    _widths(sh, [100,80,160,100,170,120,280,120,100,110,220]);
    _dropdown(sh, 2, COL.TSK.PRIO + 1,  PRIORITA);
    _dropdown(sh, 2, COL.TSK.TIPO + 1,  TIPI_TASK);
    _dropdown(sh, 2, COL.TSK.STATO + 1, STATI_TASK);

    // CF priorità
    const cfPrio = PRIORITA.map(p => {
      const s = STATUS_STYLE[p] || {bg:'#f1f5f9', fg:'#475569'};
      return SpreadsheetApp.newConditionalFormatRule()
        .whenTextEqualTo(p).setBackground(s.bg).setFontColor(s.fg)
        .setRanges([sh.getRange(2, COL.TSK.PRIO + 1, 5000)]).build();
    });
    // CF stato
    const cfStato = [
      ['Aperto',    {bg:C.RED_BG, fg:C.RED_T}],
      ['In Corso',  {bg:C.YELLOW_BG, fg:C.YELLOW_T}],
      ['Fatto',     {bg:C.GREEN_BG, fg:C.GREEN_T}],
      ['Annullato', {bg:'#f1f5f9', fg:'#475569'}],
    ].map(([v, s]) =>
      SpreadsheetApp.newConditionalFormatRule()
        .whenTextEqualTo(v).setBackground(s.bg).setFontColor(s.fg)
        .setRanges([sh.getRange(2, COL.TSK.STATO + 1, 5000)]).build()
    );
    sh.setConditionalFormatRules([...cfPrio, ...cfStato]);

    sh.setFrozenColumns(5);
    _banding(sh, 2, 5000, HDR.TASK.length);
    sh.getRange(2, COL.TSK.SCADENZA + 1, 5000).setNumberFormat(FMT.ORARIO);
    sh.getRange(2, COL.TSK.DATA_CR + 1, 5000).setNumberFormat(FMT.DATA);
  }

  function _setupDocumenti() {
    const sh = _sh(SH.DOCUMENTI);
    sh.setTabColor(C.BLUE);
    sh.hideGridlines();
    if (sh.getLastRow() === 0) _headerRow(sh, HDR.DOCUMENTI);

    _widths(sh, [100,100,170,150,260,110,110,220]);
    _dropdown(sh, 2, COL.DOC.TIPO + 1,  TIPI_DOC);
    _dropdown(sh, 2, COL.DOC.STATO + 1, STATI_DOC);

    const cfDoc = [
      ['Presente',      {bg:C.GREEN_BG,  fg:C.GREEN_T}],
      ['Mancante',      {bg:C.RED_BG,    fg:C.RED_T}],
      ['Da Verificare', {bg:C.YELLOW_BG, fg:C.YELLOW_T}],
      ['Scaduto',       {bg:C.PURPLE_BG, fg:C.PURPLE_T}],
    ].map(([v,s]) =>
      SpreadsheetApp.newConditionalFormatRule()
        .whenTextEqualTo(v).setBackground(s.bg).setFontColor(s.fg)
        .setRanges([sh.getRange(2, COL.DOC.STATO + 1, 5000)]).build()
    );
    sh.setConditionalFormatRules(cfDoc);
    _banding(sh, 2, 5000, HDR.DOCUMENTI.length);
    sh.getRange(2, COL.DOC.DATA_UP + 1, 5000).setNumberFormat(FMT.DATA);
  }

  function _setupLog() {
    const sh = _sh(SH.LOG);
    sh.setTabColor(C.STEEL);
    sh.hideGridlines();
    if (sh.getLastRow() === 0) _headerRow(sh, HDR.LOG);
    _widths(sh, [140,120,100,170,300,80,250]);
    sh.getRange(2, COL.LOG.TS + 1, 5000).setNumberFormat(FMT.ORARIO);
    // CF esito
    sh.setConditionalFormatRules([
      SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('OK')
        .setBackground(C.GREEN_BG).setFontColor(C.GREEN_T)
        .setRanges([sh.getRange(2, COL.LOG.ESITO + 1, 5000)]).build(),
      SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('ERRORE')
        .setBackground(C.RED_BG).setFontColor(C.RED_T)
        .setRanges([sh.getRange(2, COL.LOG.ESITO + 1, 5000)]).build(),
    ]);
    sh.setFrozenColumns(2);
  }

  function _setupBookmaker() {
    const sh = _sh(SH.BOOKMAKER);
    sh.setTabColor('#94a3b8');
    sh.hideGridlines();
    if (sh.getLastRow() === 0) {
      _headerRow(sh, HDR.BOOKMAKER);
      // Popola con i bookmaker da CONSTANTS
      const rows = BOOKMAKERS.map(b => [
        b.nome, b.tier, b.attivo ? 'Sì' : 'No', b.prio,
        b.rMin, b.rMax, ''
      ]);
      if (rows.length > 0) {
        sh.getRange(2, 1, rows.length, HDR.BOOKMAKER.length).setValues(rows);
        // Colora per tier
        rows.forEach((r, i) => {
          const st = TIER_STYLE[r[1]];
          if (st) {
            sh.getRange(i + 2, 1, 1, 4)
              .setBackground(st.bg).setFontColor(st.fg)
              .setFontWeight(st.bold ? 'bold' : 'normal');
          }
        });
      }
    }
    _widths(sh, [180, 70, 60, 70, 110, 110, 220]);
    _dropdown(sh, 2, 3, ['Sì', 'No']);
  }

  function _setupConfig() {
    const sh = _sh(SH.CFG);
    sh.setTabColor('#8b5cf6');
    sh.hideGridlines();

    if (sh.getLastRow() === 0) {
      const config = [
        ['CONFIGURAZIONE', ''],
        ['', ''],
        ['── EMAIL ──────────────────────────────────', ''],
        ['Email notifiche 1',     'mariateresabova.business@gmail.com'],
        ['Email notifiche 2',     'ponzios71@gmail.com'],
        ['Email benvenuto',       'No'],
        ['', ''],
        ['── OPERATORI E % ────────────────────────', ''],
        ['% Manu',                20],
        ['% Sere',                25],
        ['% Samu',                20],
        ['% Mary',                25],
        ['', ''],
        ['── SISTEMA ────────────────────────────────', ''],
        ['Penale €/giorno',       10],
        ['Ore prima operazione',  48],
        ['Giorni inattività alert', 7],
        ['Ora agente giornaliero', 8],
        ['', ''],
        ['── REFERRAL ───────────────────────────────', ''],
        ['Bronze (1-3 clienti)',   10],
        ['Silver (4-9 clienti)',   15],
        ['Gold (10-19 clienti)',   20],
        ['Diamond (20-49 clienti)', 25],
        ['Elite (50+ clienti)',    30],
        ['', ''],
        ['── DRIVE ──────────────────────────────────', ''],
        ['Cartella Drive root',   'CRM MBBET - Documenti Clienti'],
      ];

      sh.getRange(1, 1, config.length, 2).setValues(config);
      // Stile titolo e separatori
      config.forEach((r, i) => {
        if (r[0].startsWith('──') || r[0] === 'CONFIGURAZIONE') {
          sh.getRange(i+1, 1, 1, 2).setBackground(C.NAVY2).setFontColor(C.GOLD).setFontWeight('bold');
        }
      });
      sh.getRange(1, 1, 1, 2).setBackground(C.NAVY).setFontColor(C.GOLD2).setFontSize(14).setFontWeight('bold');
    }

    sh.setColumnWidth(1, 240);
    sh.setColumnWidth(2, 280);
  }

  function _setupListe() {
    const sh = _sh(SH.LISTE);
    sh.hideSheet();

    const cols = [
      ['STATI BK',   ...STATI_BK],
      ['STATI CLI',  ...STATI_CLI],
      ['TIPOLOGIE',  ...TIPOLOGIE],
      ['PRIORITA',   ...PRIORITA],
      ['BK ATTIVI',  ...BOOKMAKERS.filter(b=>b.attivo).map(b=>b.nome)],
      ['OPERATORI',  'Manu', 'Sere', 'Samu', 'Mary'],
      ['STATI ACC',  ...STATI_ACC],
      ['STATI TASK', ...STATI_TASK],
      ['TIPI PAG',   ...TIPI_PAG],
      ['METODI PAG', ...METODI_PAG],
      ['TIPI DOC',   ...TIPI_DOC],
    ];

    // Scrivi per colonne
    cols.forEach((col, c) => {
      col.forEach((v, r) => sh.getRange(r+1, c+1).setValue(v));
      sh.getRange(1, c+1).setBackground(C.NAVY).setFontColor(C.WHITE).setFontWeight('bold');
    });
  }

  function _setupImport() {
    const sh = _sh(SH.IMPORT);
    sh.setTabColor('#6366f1');
    sh.hideGridlines();
    sh.getRange('A1').setValue('IMPORT — Usa Menu → 📥 Importa 200 Clienti')
      .setBackground(C.NAVY).setFontColor(C.GOLD).setFontWeight('bold').setFontSize(12);
  }

  function _setupDaCompletare() {
    const sh = _sh(SH.DA_FARE);
    sh.setTabColor('#8b5cf6');
    sh.hideGridlines();
    sh.getRange(1,1,1,14).setBackground('#4c1d95').setFontColor('#c4b5fd');
    sh.getRange('A1:N1').merge()
      .setValue('🔧  DA COMPLETARE — Aggiorna con Menu → 🔧 Analizza Clienti Incompleti')
      .setFontWeight('bold').setFontSize(11)
      .setHorizontalAlignment('center').setVerticalAlignment('middle');
    sh.setRowHeight(1, 40);

    const hdrs = ['ID','Nome','Op.','Tel','Email','SPID','C/C','Acc.','Drive','# Mancanti','Campi Mancanti','Prossima Azione','Priorità'];
    sh.getRange(2, 1, 1, hdrs.length)
      .setValues([hdrs])
      .setBackground('#4c1d95').setFontColor('#c4b5fd')
      .setFontWeight('bold').setFontSize(8)
      .setHorizontalAlignment('center');
    sh.setRowHeight(2, 28);
    sh.setFrozenRows(2);
    _widths(sh, [100,180,100,110,160,60,60,60,60,80,280,200,90]);
  }

  // ════════════════════════════════════════════════════════════════════
  // ORDINE FOGLI
  // ════════════════════════════════════════════════════════════════════

  function _orderSheets() {
    const ss = DB.ss();
    const ordine = [
      SH.HOME, SH.CLIENTI, SH.BONUS, SH.COLLAB,
      SH.TASK, SH.PAGAMENTI, SH.PENALI, SH.DOCUMENTI,
      SH.RICERCA, SH.DASH, SH.DASH_COLLAB,
      SH.BOOKMAKER, SH.CFG, SH.LOG, SH.IMPORT, SH.DA_FARE, SH.LISTE,
    ];
    ordine.forEach((nome, i) => {
      const sh = ss.getSheetByName(nome);
      if (sh) ss.moveActiveSheet(i + 1, sh);
    });
  }

  // ════════════════════════════════════════════════════════════════════
  // RUN — Setup Completo
  // ════════════════════════════════════════════════════════════════════

  function run() {
    const ui = SpreadsheetApp.getUi();
    const ss = DB.ss();

    ui.showToast('Setup in corso — attendi ~60 secondi…', '⚙️', 90);

    // 1. Crea tutti i fogli base (se non esistono)
    Object.values(SH).forEach(nome => {
      if (!ss.getSheetByName(nome)) ss.insertSheet(nome);
    });

    // 2. Setup ogni foglio
    _setupClienti();
    _setupBonus();
    _setupCollab();
    _setupPagamenti();
    _setupPenali();
    _setupTask();
    _setupDocumenti();
    _setupLog();
    _setupBookmaker();
    _setupConfig();
    _setupListe();
    _setupImport();
    _setupDaCompletare();

    // 3. Setup HOME e RICERCA (da altri moduli)
    if (typeof HomeSetup !== 'undefined') HomeSetup.run();
    if (typeof SearchSetup !== 'undefined') SearchSetup.run();
    if (typeof Dashboard !== 'undefined') Dashboard.rebuild();

    // 4. Ordina fogli
    _orderSheets();

    // 5. Nascondi LISTE
    const shL = ss.getSheetByName(SH.LISTE);
    if (shL) shL.hideSheet();

    // 6. Vai alla HOME
    const shHome = ss.getSheetByName(SH.HOME);
    if (shHome) ss.setActiveSheet(shHome);

    DB.log('SETUP', '', '', 'Setup completo eseguito', 'OK', '');

    ui.alert(
      '✅  CRM MBBET Pronto!',
      'Setup completato con successo.\n\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      'PROSSIMI PASSI:\n\n' +
      '1️⃣  Menu → 📥 Importa 200 Clienti\n' +
      '   (una sola volta — poi è automatico)\n\n' +
      '2️⃣  Menu → 🔧 Installa Trigger Form\n' +
      '   (nuovi clienti entrano da soli)\n\n' +
      '3️⃣  Menu → 🤖 Installa Agente 08:00\n' +
      '   (automazione giornaliera)\n\n' +
      '4️⃣  Menu → 🔧 Analizza Clienti Incompleti\n' +
      '   (dopo l\'import)\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      ui.ButtonSet.OK
    );
  }

  return { run };

})();

// ── Funzione globale per il menu ──────────────────────────────────────

function setupCRM() {
  Setup.run();
}
