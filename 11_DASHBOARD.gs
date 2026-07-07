// ═══════════════════════════════════════════════════════════════════════
//   CRM MBBET · 11_DASHBOARD.gs
//   Dashboard — KPI globali, operatori, bookmaker, finanze
//   v3.0
// ═══════════════════════════════════════════════════════════════════════

const Dashboard = (() => {

  // ══════════════════════════════════════════════════════════════════
  // REBUILD — Ricostruisce l'intera Dashboard
  // ══════════════════════════════════════════════════════════════════

  function rebuild() {
    const ss = DB.ss();
    let sh = ss.getSheetByName(SH.DASHBOARD);
    if (!sh) sh = ss.insertSheet(SH.DASHBOARD);

    sh.clearContents();
    sh.clearFormats();
    sh.clearConditionalFormatRules();
    sh.getRange('A1:Z300').setBackground('#0f172a').setFontColor('#0f172a');

    sh.setColumnWidth(1, 24);
    sh.setColumnWidth(2, 200);
    sh.setColumnWidth(3, 160);
    sh.setColumnWidth(4, 160);
    sh.setColumnWidth(5, 160);
    sh.setColumnWidth(6, 160);
    sh.setColumnWidth(7, 160);
    sh.setColumnWidth(8, 100);

    let curRow = 1;

    curRow = _sectionHeader(sh, curRow, '🎯  MBBET CRM · Dashboard Operativa', 28, C.GOLD, '#0f172a');
    sh.getRange(curRow, 2, 1, 7).merge()
      .setFormula(`="Aggiornato: "&TEXT(NOW(),"dd/mm/yyyy hh:mm")`)
      .setFontSize(10).setFontColor('#475569').setHorizontalAlignment('right');
    curRow++;

    // ════════════════════════════════════════════════════════════════
    // SEZIONE 1 — KPI Globali
    // ════════════════════════════════════════════════════════════════
    curRow = _sectionTitle(sh, curRow, '📊 KPI GLOBALI');
    curRow = _kpiGrid(sh, curRow, [
      { label: '👥 Clienti Totali',
        formula: `=COUNTA('${SH.CLIENTI}'!A:A)-1`,
        color: '#60a5fa' },
      { label: '✅ Clienti Attivi',
        formula: `=COUNTIF('${SH.CLIENTI}'!L:L,"ATTIVO")`,
        color: '#34d399' },
      { label: '🔴 In Pausa',
        formula: `=COUNTIF('${SH.CLIENTI}'!L:L,"IN PAUSA")`,
        color: '#fbbf24' },
      { label: '⛔ Bloccati',
        formula: `=COUNTIF('${SH.CLIENTI}'!L:L,"BLOCCATO")`,
        color: '#f87171' },
      { label: '🏆 Bonus Fatti',
        formula: `=COUNTIF('${SH.BONUS}'!F:F,"FATTO")`,
        color: '#a78bfa' },
      { label: '▶ Bonus In Corso',
        formula: `=COUNTIF('${SH.BONUS}'!F:F,"IN CORSO")`,
        color: '#38bdf8' },
    ]);

    // ════════════════════════════════════════════════════════════════
    // SEZIONE 2 — Finanze
    // ════════════════════════════════════════════════════════════════
    curRow = _sectionTitle(sh, curRow, '💰 FINANZE');
    curRow = _kpiGrid(sh, curRow, [
      { label: '💰 Ricavo Totale',
        formula: `=IFERROR(SUMIF('${SH.BONUS}'!F:F,"FATTO",'${SH.BONUS}'!K:K),0)`,
        color: '#f59e0b', fmt: FMT.EURO },
      { label: '💸 Totale Pagato Clienti',
        formula: `=IFERROR(SUM('${SH.BONUS}'!L:L),0)`,
        color: '#f87171', fmt: FMT.EURO },
      { label: '📈 Margine Netto',
        formula: `=IFERROR(SUM('${SH.CLIENTI}'!P:P),0)`,
        color: '#34d399', fmt: FMT.EURO },
      { label: '⚠️ Penali Totali',
        formula: `=IFERROR(SUMIF('${SH.PENALI}'!L:L,"In Calcolo",'${SH.PENALI}'!K:K),0)`,
        color: '#fca5a5', fmt: FMT.EURO },
      { label: '💳 Pagamenti Registrati',
        formula: `=IFERROR(SUM('${SH.PAGAMENTI}'!F:F),0)`,
        color: '#a78bfa', fmt: FMT.EURO },
      { label: '📊 Ricavo Potenziale',
        formula: `=IFERROR(SUM('${SH.CLIENTI}'!R:R),0)`,
        color: '#38bdf8', fmt: FMT.EURO },
    ]);

    // ════════════════════════════════════════════════════════════════
    // SEZIONE 3 — Per Operatore (tabella)
    // ════════════════════════════════════════════════════════════════
    curRow = _sectionTitle(sh, curRow, '👥 PER OPERATORE');
    curRow = _tableHeader(sh, curRow, ['Operatore', 'Clienti', 'Bonus Fatti', 'Ricavo', 'Task Aperti', 'Penali Attive', '% Margine']);
    const ops = ['Manu', 'Sere', 'Samu', 'Mary'];
    ops.forEach(op => {
      curRow = _opRow(sh, curRow, op);
    });
    curRow++;

    // ════════════════════════════════════════════════════════════════
    // SEZIONE 4 — Top Bookmaker per ricavo
    // ════════════════════════════════════════════════════════════════
    curRow = _sectionTitle(sh, curRow, '🎰 TOP BOOKMAKER');
    curRow = _bkTable(sh, curRow);

    // ════════════════════════════════════════════════════════════════
    // SEZIONE 5 — Task summary
    // ════════════════════════════════════════════════════════════════
    curRow = _sectionTitle(sh, curRow, '✅ TASK');
    curRow = _kpiGrid(sh, curRow, [
      { label: '🚨 URGENTI',     formula: `=COUNTIFS('${SH.TASK}'!B:B,"URGENTE",'${SH.TASK}'!I:I,"Aperto")`,  color: '#f87171' },
      { label: '🔴 ALTA',        formula: `=COUNTIFS('${SH.TASK}'!B:B,"ALTA",'${SH.TASK}'!I:I,"Aperto")`,      color: '#fbbf24' },
      { label: '🟡 MEDIA',       formula: `=COUNTIFS('${SH.TASK}'!B:B,"MEDIA",'${SH.TASK}'!I:I,"Aperto")`,     color: '#a78bfa' },
      { label: '🟢 BASSA',       formula: `=COUNTIFS('${SH.TASK}'!B:B,"BASSA",'${SH.TASK}'!I:I,"Aperto")`,     color: '#34d399' },
      { label: '✅ Fatti',        formula: `=COUNTIF('${SH.TASK}'!I:I,"Fatto")`,                                 color: '#64748b' },
      { label: '⏰ Scaduti',     formula: `=COUNTIFS('${SH.TASK}'!H:H,"<"&TODAY(),'${SH.TASK}'!I:I,"Aperto")`, color: '#f87171' },
    ]);

    // ════════════════════════════════════════════════════════════════
    // SEZIONE 6 — Clienti nuovi ultimi 30gg
    // ════════════════════════════════════════════════════════════════
    curRow = _sectionTitle(sh, curRow, '🆕 NUOVI CLIENTI');
    curRow = _kpiGrid(sh, curRow, [
      { label: 'Ultimi 7 giorni',  formula: `=COUNTIFS('${SH.CLIENTI}'!K:K,">="&TODAY()-7)`,   color: '#60a5fa' },
      { label: 'Ultimi 30 giorni', formula: `=COUNTIFS('${SH.CLIENTI}'!K:K,">="&TODAY()-30)`,  color: '#a78bfa' },
      { label: 'Questo mese',      formula: `=COUNTIFS('${SH.CLIENTI}'!K:K,">="&DATE(YEAR(TODAY()),MONTH(TODAY()),1))`, color: '#34d399' },
      { label: 'In attesa SPID',   formula: `=COUNTIF('${SH.CLIENTI}'!I:I,"No")`,              color: '#fbbf24' },
      { label: 'Senza accettaz.',  formula: `=COUNTIFS('${SH.CLIENTI}'!Z:Z,"<>Accettato",'${SH.CLIENTI}'!A:A,"MBBET*")`, color: '#fca5a5' },
      { label: 'Con collab',       formula: `=COUNTIFS('${SH.CLIENTI}'!X:X,"<>",'${SH.CLIENTI}'!A:A,"MBBET*")`,         color: '#38bdf8' },
    ]);

    // Timestamp
    curRow++;
    sh.setRowHeight(curRow, 24);
    sh.getRange(curRow, 2, 1, 7).merge()
      .setFormula(`="Costruita il: "&TEXT(NOW(),"dd/mm/yyyy hh:mm")`)
      .setFontSize(10).setFontColor('#334155').setHorizontalAlignment('right');

    sh.setFrozenRows(3);
    SpreadsheetApp.flush();
  }

  // ══════════════════════════════════════════════════════════════════
  // HELPERS — costruttori di sezioni
  // ══════════════════════════════════════════════════════════════════

  function _sectionHeader(sh, row, text, size, fg, bg) {
    sh.setRowHeight(row, size === 28 ? 52 : 40);
    sh.getRange(row, 2, 1, 7).merge()
      .setValue(text)
      .setFontSize(size).setFontWeight('bold').setFontColor(fg)
      .setBackground(bg).setVerticalAlignment('middle')
      .setHorizontalAlignment('center');
    return row + 1;
  }

  function _sectionTitle(sh, row, text) {
    sh.setRowHeight(row, 8);
    sh.getRange(row, 2, 1, 7).setBackground('#0f172a');
    row++;
    sh.setRowHeight(row, 34);
    sh.getRange(row, 2, 1, 7).merge()
      .setValue(text)
      .setFontSize(14).setFontWeight('bold').setFontColor(C.GOLD)
      .setBackground('#1e293b').setVerticalAlignment('middle')
      .setBorder(false, false, true, false, false, false, C.GOLD, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
    return row + 1;
  }

  function _kpiGrid(sh, row, items) {
    // 3 colonne per riga
    const cols  = [2, 3, 4, 5, 6, 7];
    const perRow = 3;
    let col = 0;
    let maxRow = row;

    items.forEach((item, i) => {
      const c = cols[col % cols.length];
      const r = row + Math.floor(col / perRow) * 3;
      maxRow = Math.max(maxRow, r + 2);

      sh.setRowHeight(r,     14);
      sh.setRowHeight(r + 1, 36);
      sh.setRowHeight(r + 2, 22);

      sh.getRange(r, c).setBackground('#1e293b');
      sh.getRange(r + 1, c)
        .setFormula(item.formula)
        .setFontSize(22).setFontWeight('bold').setFontColor(item.color)
        .setBackground('#1e293b').setHorizontalAlignment('center')
        .setVerticalAlignment('middle')
        .setNumberFormat(item.fmt || '#,##0');
      sh.getRange(r + 2, c)
        .setValue(item.label)
        .setFontSize(10).setFontColor('#94a3b8')
        .setBackground('#1e293b').setHorizontalAlignment('center');

      col++;
    });

    return maxRow + 1;
  }

  function _tableHeader(sh, row, cols) {
    sh.setRowHeight(row, 30);
    cols.forEach((c, i) => {
      sh.getRange(row, i + 2)
        .setValue(c).setFontSize(11).setFontWeight('bold')
        .setFontColor(C.GOLD).setBackground('#1e293b')
        .setHorizontalAlignment('center').setVerticalAlignment('middle');
    });
    return row + 1;
  }

  function _opRow(sh, row, op) {
    sh.setRowHeight(row, 28);
    const cells = [
      [op,
       `=COUNTIF('${SH.CLIENTI}'!F:F,"${op}")`,
       `=COUNTIFS('${SH.BONUS}'!G:G,"${op}",'${SH.BONUS}'!F:F,"FATTO")`,
       `=IFERROR(SUMIF('${SH.CLIENTI}'!F:F,"${op}",'${SH.CLIENTI}'!N:N),0)`,
       `=COUNTIFS('${SH.TASK}'!G:G,"${op}",'${SH.TASK}'!I:I,"Aperto")`,
       `=COUNTIFS('${SH.PENALI}'!D:D,"${op}",'${SH.PENALI}'!L:L,"In Calcolo")`,
       `=IFERROR(SUMIFS('${SH.CLIENTI}'!P:P,'${SH.CLIENTI}'!F:F,"${op}")/MAX(1,SUMIFS('${SH.CLIENTI}'!N:N,'${SH.CLIENTI}'!F:F,"${op}")),"—")`,
      ]
    ];
    cells[0].forEach((val, i) => {
      const cell = sh.getRange(row, i + 2);
      if (typeof val === 'string' && val.startsWith('=')) {
        cell.setFormula(val);
      } else {
        cell.setValue(val);
      }
      cell.setFontSize(11).setFontWeight(i === 0 ? 'bold' : 'normal')
        .setFontColor(i === 0 ? '#f8fafc' : '#94a3b8')
        .setBackground(row % 2 === 0 ? '#1e293b' : '#0f172a')
        .setHorizontalAlignment('center').setVerticalAlignment('middle');
      if (i === 3) cell.setNumberFormat(FMT.EURO);
      if (i === 6) cell.setNumberFormat('0.0%');
    });
    return row + 1;
  }

  function _bkTable(sh, row) {
    // Usa QUERY per ordinare i bookmaker per ricavo
    sh.setRowHeight(row, 28);
    sh.getRange(row, 2).setValue('Bookmaker').setFontWeight('bold').setFontColor(C.GOLD).setBackground('#1e293b');
    sh.getRange(row, 3).setValue('N° Clienti').setFontWeight('bold').setFontColor(C.GOLD).setBackground('#1e293b').setHorizontalAlignment('center');
    sh.getRange(row, 4).setValue('Ricavo Totale').setFontWeight('bold').setFontColor(C.GOLD).setBackground('#1e293b').setHorizontalAlignment('center');
    sh.getRange(row, 5).setValue('Media per Cliente').setFontWeight('bold').setFontColor(C.GOLD).setBackground('#1e293b').setHorizontalAlignment('center');
    sh.getRange(row, 6).setValue('Bonus Fatti').setFontWeight('bold').setFontColor(C.GOLD).setBackground('#1e293b').setHorizontalAlignment('center');
    row++;

    // Leggi dati bonus per costruire riepilogo per BK
    const bnsData = DB.read(SH.BONUS);
    const bkMap   = {};
    bnsData.forEach(b => {
      const bk = b[COL.BNS.BK];
      if (!bk) return;
      if (!bkMap[bk]) bkMap[bk] = { nCli:0, ricavo:0, fatti:0 };
      bkMap[bk].nCli++;
      bkMap[bk].ricavo += parseFloat(b[COL.BNS.RIC_REAL]) || 0;
      if (b[COL.BNS.STATO] === 'FATTO') bkMap[bk].fatti++;
    });

    const sorted = Object.entries(bkMap)
      .sort(([,a],[,b]) => b.ricavo - a.ricavo)
      .slice(0, 15);

    sorted.forEach(([bk, data], i) => {
      sh.setRowHeight(row, 24);
      const bg = i % 2 === 0 ? '#1e293b' : '#0f172a';
      sh.getRange(row, 2).setValue(bk).setFontSize(11).setFontColor('#e2e8f0').setBackground(bg);
      sh.getRange(row, 3).setValue(data.nCli).setFontSize(11).setFontColor('#94a3b8').setBackground(bg).setHorizontalAlignment('center');
      sh.getRange(row, 4).setValue(data.ricavo).setFontSize(11).setFontColor('#f59e0b').setBackground(bg).setHorizontalAlignment('center').setNumberFormat(FMT.EURO);
      sh.getRange(row, 5).setValue(data.nCli > 0 ? data.ricavo / data.nCli : 0)
        .setFontSize(11).setFontColor('#94a3b8').setBackground(bg).setHorizontalAlignment('center').setNumberFormat(FMT.EURO);
      sh.getRange(row, 6).setValue(data.fatti).setFontSize(11).setFontColor('#34d399').setBackground(bg).setHorizontalAlignment('center');
      row++;
    });

    return row;
  }

  // ══════════════════════════════════════════════════════════════════
  // REBUILD COLLAB — sezione collab (chiamata anche separatamente)
  // ══════════════════════════════════════════════════════════════════

  function rebuildCollab() {
    const cliData  = DB.read(SH.CLIENTI);
    const collData = DB.read(SH.COLLAB);

    const shD = DB.ss().getSheetByName(SH.DASHBOARD);
    if (!shD) return;

    // Scriviamo in fondo alla dashboard esistente
    let row = shD.getLastRow() + 2;
    row = _sectionTitle(shD, row, '🤝 COLLABORATORI');
    row = _tableHeader(shD, row, ['ID', 'Nome', 'Tipo', 'Clienti Portati', 'Ricavo Generato', '% Comp.', 'Stato']);

    collData.forEach((c, i) => {
      if (!c[COL.CLB.ID]) return;
      shD.setRowHeight(row, 26);
      const bg  = i % 2 === 0 ? '#1e293b' : '#0f172a';
      const cli = cliData.filter(r => (r[COL.CLI.COLLAB] || '') === c[COL.CLB.NOME]).length;
      const vals = [
        c[COL.CLB.ID], c[COL.CLB.NOME], c[COL.CLB.TIPO],
        cli, 0, // ricavo generato verr calcolato da formula
        `${c[COL.CLB.PERC] || 0}%`,
        c[COL.CLB.STATO] || '—',
      ];
      vals.forEach((v, j) => {
        shD.getRange(row, j + 2).setValue(v)
          .setFontSize(10).setFontColor('#94a3b8').setBackground(bg)
          .setHorizontalAlignment('center').setVerticalAlignment('middle');
      });
      row++;
    });

    SpreadsheetApp.flush();
  }

  // ── EXPOSE ────────────────────────────────────────────────────────
  return { rebuild, rebuildCollab };

})();
