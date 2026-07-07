// ═══════════════════════════════════════════════════════════════════════
//   CRM MBBET · 12_HOME.gs
//   HOME sheet — Pannello comandi, KPI cards, navigazione
//   v3.0
// ═══════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════
// PANNELLO — definizione azioni (riga → funzione)
// Colonna 2 = checkbox | Colonna 3 = etichetta | Colonna 4 = desc
// ════════════════════════════════════════════════════════════════════

const _PANNELLO = [
  // [row, fnName,                  etichetta,                         descrizione]
  [14, 'menuCosaDaFareOggi',      '🌅  Cosa Fare Oggi',               'Briefing mattutino — cosa fare adesso'],
  [15, 'menuVerificaSistema',     '🔍  Verifica Sistema',             'Controlla che tutto funzioni correttamente'],
  [17, 'menuImportaClienti',      '📥  Importa 200 Clienti',          'Importa i clienti dal Google Form vecchio'],
  [18, 'menuRegistraAccettazione','✅  Registra Accettazione',        'Registra che un cliente ha accettato le condizioni'],
  [19, 'menuAnalizzaIncompleti',  '🔧  Analizza Clienti Incompleti',  'Mostra tutti i clienti con dati mancanti'],
  [20, 'menuCercaCliente',        '🔍  Cerca Cliente',                'Vai al foglio RICERCA e cerca un cliente'],
  [22, 'menuCreaCollab',          '🤝  Crea Nuova Collab',            'Aggiungi un nuovo collaboratore/referral'],
  [23, 'menuRegistraPagamento',   '💸  Registra Pagamento',           'Registra un pagamento (cliente, collab, operatore)'],
  [24, 'menuCalcolaPenali',       '⚠️  Calcola Penali',               'Aggiorna le penali per ritardi sull\'avvio'],
  [26, 'menuLanciaAgente',        '🤖  Lancia Agente Ora',            'Esegui agente: penali + task + email report'],
  [27, 'menuGeneraTask',          '📋  Genera Task Operatori',        'Crea nuovi task basati sullo stato dei bonus'],
  [28, 'menuInviaReport',         '📧  Invia Report Email Adesso',    'Invia subito il report via email a tutti'],
  [30, 'setupCRM',                '⚙️  Setup Completo CRM',           'Prima installazione: crea tutti i fogli'],
  [31, 'menuRebuildHome',         '🏠  Aggiorna Home',                'Rigenera questa pagina HOME'],
  [32, 'menuRebuildDashboard',    '📊  Aggiorna Dashboard',           'Ricalcola tutte le statistiche della dashboard'],
];

// Map row → fnName per il dispatch
const _DISPATCH_MAP = {};
_PANNELLO.forEach(p => { _DISPATCH_MAP[p[0]] = p[1]; });

// ════════════════════════════════════════════════════════════════════
// HomePanel — namespace per HOME
// ════════════════════════════════════════════════════════════════════

const HomePanel = (() => {

  // ── DISPATCH checkbox ─────────────────────────────────────────────

  function dispatch(row) {
    const fnName = _DISPATCH_MAP[row];
    if (!fnName) return;

    // Direct dispatch — gli switch sono affidabili in Apps Script
    switch (fnName) {
      case 'menuCosaDaFareOggi':       menuCosaDaFareOggi();       break;
      case 'menuVerificaSistema':      menuVerificaSistema();      break;
      case 'menuImportaClienti':       menuImportaClienti();       break;
      case 'menuRegistraAccettazione': menuRegistraAccettazione(); break;
      case 'menuAnalizzaIncompleti':   menuAnalizzaIncompleti();   break;
      case 'menuCercaCliente':         menuCercaCliente();         break;
      case 'menuCreaCollab':           menuCreaCollab();           break;
      case 'menuRegistraPagamento':    menuRegistraPagamento();    break;
      case 'menuCalcolaPenali':        menuCalcolaPenali();        break;
      case 'menuLanciaAgente':         menuLanciaAgente();         break;
      case 'menuGeneraTask':           menuGeneraTask();           break;
      case 'menuInviaReport':          menuInviaReport();          break;
      case 'setupCRM':                 setupCRM();                 break;
      case 'menuRebuildHome':          menuRebuildHome();          break;
      case 'menuRebuildDashboard':     menuRebuildDashboard();     break;
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // BUILD — Costruisce il foglio HOME da zero
  // ══════════════════════════════════════════════════════════════════

  function build() {
    const ss = DB.ss();
    let sh = ss.getSheetByName(SH.HOME);
    if (!sh) { sh = ss.insertSheet(SH.HOME); }

    sh.clearContents();
    sh.clearFormats();
    sh.clearConditionalFormatRules();

    // ── Dimensioni colonne ─────────────────────────────────────────
    sh.setColumnWidth(1, 220);   // A: etichette sezione
    sh.setColumnWidth(2, 44);    // B: checkbox
    sh.setColumnWidth(3, 300);   // C: etichetta azione
    sh.setColumnWidth(4, 320);   // D: descrizione
    sh.setColumnWidth(5, 180);   // E: KPI sinistra
    sh.setColumnWidth(6, 180);   // F: KPI destra
    for (let c = 7; c <= 15; c++) sh.setColumnWidth(c, 100);

    // ── Sfondo base ────────────────────────────────────────────────
    sh.getRange('A1:Z200').setBackground(C.NAVY).setFontColor(C.NAVY);

    // ════════════════════════════════════════════════════════════════
    // INTESTAZIONE  (righe 1-5)
    // ════════════════════════════════════════════════════════════════
    sh.setRowHeight(1, 14);

    // Logo / Titolo
    sh.setRowHeight(2, 54);
    sh.getRange('A2:F2').merge()
      .setValue('🎯  MBBET CRM')
      .setFontSize(28)
      .setFontWeight('bold')
      .setFontColor(C.GOLD)
      .setVerticalAlignment('middle')
      .setHorizontalAlignment('center')
      .setBackground('#0f172a');

    sh.setRowHeight(3, 24);
    sh.getRange('A3:F3').merge()
      .setValue('Pannello di Controllo Operatori · MANU · SERE · SAMU · MARY')
      .setFontSize(11)
      .setFontColor('#94a3b8')
      .setHorizontalAlignment('center')
      .setBackground('#0f172a');

    sh.setRowHeight(4, 8);
    sh.getRange('A4:F4').setBackground('#f59e0b'); // linea oro

    sh.setRowHeight(5, 14);

    // ════════════════════════════════════════════════════════════════
    // KPI CARDS  (righe 6-12)
    // ════════════════════════════════════════════════════════════════

    const kpiDefs = [
      { label:'👥 Clienti Totali',    formula:`=COUNTA('${SH.CLIENTI}'!A:A)-1`,                   col:1, color:'#60a5fa' },
      { label:'✅ Attivi',             formula:`=COUNTIF('${SH.CLIENTI}'!L:L,"ATTIVO")`,            col:2, color:'#34d399' },
      { label:'🚨 Task Urgenti',       formula:`=COUNTIFS('${SH.TASK}'!B:B,"URGENTE",'${SH.TASK}'!I:I,"Aperto")`, col:3, color:'#f87171' },
      { label:'⚠️ Penali Attive',     formula:`=COUNTIF('${SH.PENALI}'!L:L,"In Calcolo")`,         col:4, color:'#fbbf24' },
      { label:'📋 Task Oggi',          formula:`=COUNTIFS('${SH.TASK}'!H:H,"<="&TODAY(),'${SH.TASK}'!I:I,"Aperto")`, col:5, color:'#a78bfa' },
      { label:'💰 Margine Totale',     formula:`=IFERROR(SUM('${SH.CLIENTI}'!P:P),0)`,             col:6, color:'#34d399' },
    ];

    const kpiCols = ['A','B','C','D','E','F'];
    kpiDefs.forEach((k, i) => {
      const baseCol = kpiCols[i];
      sh.setRowHeight(6, 16);
      sh.setRowHeight(7, 30);
      sh.setRowHeight(8, 30);
      sh.setRowHeight(9, 16);

      // Sfondo card
      sh.getRange(`${baseCol}6:${baseCol}9`).setBackground('#1e293b');

      // Valore
      sh.getRange(`${baseCol}7`)
        .setFormula(k.formula)
        .setFontSize(20)
        .setFontWeight('bold')
        .setFontColor(k.color)
        .setHorizontalAlignment('center')
        .setVerticalAlignment('bottom');

      // Etichetta
      sh.getRange(`${baseCol}8`)
        .setValue(k.label)
        .setFontSize(10)
        .setFontColor('#94a3b8')
        .setHorizontalAlignment('center')
        .setVerticalAlignment('top');
    });

    // Bordi navi per KPI
    sh.getRange('A6:F9')
      .setBorder(true, true, true, true, true, true, '#334155', SpreadsheetApp.BorderStyle.SOLID);

    // ── Margine Euro format ────────────────────────────────────────
    sh.getRange('F7').setNumberFormat(FMT.EURO);

    sh.setRowHeight(10, 8);
    sh.getRange('A10:F10').setBackground('#f59e0b'); // linea oro sep

    sh.setRowHeight(11, 8);
    sh.setRowHeight(12, 8);

    // ════════════════════════════════════════════════════════════════
    // PANNELLO COMANDI (righe 13+)
    // ════════════════════════════════════════════════════════════════

    sh.setRowHeight(13, 30);
    sh.getRange('A13:D13').merge()
      .setValue('  PANNELLO COMANDI — Clicca ✓ per eseguire')
      .setFontSize(13)
      .setFontWeight('bold')
      .setFontColor(C.GOLD)
      .setBackground('#1e293b')
      .setVerticalAlignment('middle');

    // Sezioni
    const SEZIONI = {
      16: '── 📥 CLIENTI ──────────────────────',
      21: '── 🤝 COLLAB E FINANZE ──────────────',
      25: '── 🤖 AUTOMAZIONE ───────────────────',
      29: '── ⚙️  SISTEMA ──────────────────────',
    };

    // Scrivi intestazioni sezioni
    Object.entries(SEZIONI).forEach(([row, label]) => {
      sh.setRowHeight(parseInt(row), 28);
      sh.getRange(parseInt(row), 1, 1, 4).merge()
        .setValue(label)
        .setFontSize(11)
        .setFontWeight('bold')
        .setFontColor('#64748b')
        .setBackground('#0f172a')
        .setVerticalAlignment('middle');
    });

    // Scrivi azioni
    _PANNELLO.forEach(([row, , etichetta, desc]) => {
      sh.setRowHeight(row, 34);

      // Checkbox in col B
      sh.getRange(row, 2).insertCheckboxes()
        .setBackground('#1e293b')
        .setHorizontalAlignment('center')
        .setVerticalAlignment('middle');

      // Etichetta in col C
      sh.getRange(row, 3)
        .setValue(etichetta)
        .setFontSize(12)
        .setFontWeight('bold')
        .setFontColor('#e2e8f0')
        .setBackground('#1e293b')
        .setVerticalAlignment('middle');

      // Descrizione in col D
      sh.getRange(row, 4)
        .setValue(desc)
        .setFontSize(10)
        .setFontColor('#64748b')
        .setBackground('#1e293b')
        .setVerticalAlignment('middle');
    });

    // ════════════════════════════════════════════════════════════════
    // NAVIGAZIONE RAPIDA (colonne E-F, righe 13+)
    // ════════════════════════════════════════════════════════════════

    sh.setRowHeight(13, 30);
    sh.getRange('E13:F13').merge()
      .setValue('  🔗 NAVIGAZIONE RAPIDA')
      .setFontSize(12)
      .setFontWeight('bold')
      .setFontColor(C.GOLD)
      .setBackground('#1e293b')
      .setVerticalAlignment('middle');

    const navLinks = [
      [14, `=HYPERLINK("#gid=0","👥 CLIENTI")`,        `=HYPERLINK("#gid=0","📊 BONUS")`],
      [15, `=HYPERLINK("#gid=0","🔍 RICERCA")`,        `=HYPERLINK("#gid=0","✅ TASK")`],
      [16, `=HYPERLINK("#gid=0","⚠️ PENALI")`,        `=HYPERLINK("#gid=0","🤝 COLLAB")`],
      [17, `=HYPERLINK("#gid=0","💸 PAGAMENTI")`,     `=HYPERLINK("#gid=0","📁 DOCUMENTI")`],
      [18, `=HYPERLINK("#gid=0","📊 DASHBOARD")`,     `=HYPERLINK("#gid=0","📋 DA FARE")`],
      [19, `=HYPERLINK("#gid=0","📔 LOG")`,           `=HYPERLINK("#gid=0","⚙️ CONFIG")`],
    ];

    navLinks.forEach(([row, fE, fF]) => {
      sh.setRowHeight(row, 28);
      sh.getRange(row, 5)
        .setFormula(fE).setFontSize(12).setFontWeight('bold')
        .setFontColor('#60a5fa').setBackground('#0f172a')
        .setHorizontalAlignment('left').setVerticalAlignment('middle');
      sh.getRange(row, 6)
        .setFormula(fF).setFontSize(12).setFontWeight('bold')
        .setFontColor('#60a5fa').setBackground('#0f172a')
        .setHorizontalAlignment('left').setVerticalAlignment('middle');
    });

    // ── Stato agente ───────────────────────────────────────────────
    sh.setRowHeight(21, 30);
    sh.getRange('E21:F21').merge()
      .setFormula(`=IFERROR("🤖 Agente: "&TEXT(MAX(IF('${SH.LOG}'!B:B="AGENTE",'${SH.LOG}'!A:A)),"dd/mm hh:mm"),"🤖 Agente: mai lanciato")`)
      .setFontSize(11).setFontColor('#94a3b8').setBackground('#0f172a')
      .setHorizontalAlignment('left').setVerticalAlignment('middle');

    // ── Timestamp ultimo aggiornamento ─────────────────────────────
    const now = new Date();
    sh.setRowHeight(33, 28);
    sh.getRange('A33:F33').merge()
      .setValue(`Aggiornato: ${fmtDateTime(now)}`)
      .setFontSize(10).setFontColor('#334155')
      .setBackground('#0f172a').setHorizontalAlignment('right');

    // ── Nascondi colonne non necessarie ───────────────────────────
    sh.hideColumns(1, 1); // Nascondi colonna A (etichette interne)
    sh.setColumnWidth(1, 20);

    // ── Blocca prime 5 righe ──────────────────────────────────────
    ss.setActiveSheet(sh);
    sh.setFrozenRows(5);

    SpreadsheetApp.flush();
  }

  // ══════════════════════════════════════════════════════════════════
  // REFRESH — aggiorna solo il timestamp + KPI senza ricostruire
  // ══════════════════════════════════════════════════════════════════

  function refresh() {
    const sh = DB.ss().getSheetByName(SH.HOME);
    if (!sh) { build(); return; }

    // Timestamp
    sh.getRange('A33:F33')
      .setValue(`Aggiornato: ${fmtDateTime(new Date())}`);
    SpreadsheetApp.flush();
  }

  // ── EXPOSE ────────────────────────────────────────────────────────
  return { build, refresh, dispatch };

})();

// Alias globale chiamato da menuRebuildHome()
const HomeSetup = { run: () => HomePanel.build() };
