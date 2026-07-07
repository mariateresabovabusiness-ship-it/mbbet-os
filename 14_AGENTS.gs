// ═══════════════════════════════════════════════════════════════════════
//   CRM MBBET · 14_AGENTS.gs
//   Agente Giornaliero — Penali, Task, Email Report, Trigger
//   v3.0
//
//   TRIGGER: ogni giorno alle 08:00 → function dailyAgent()
//   EMAIL:   mariateresabova.business@gmail.com + ponzios71@gmail.com
// ═══════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════
// Entry Point globale (Apps Script trigger → deve essere funzione globale)
// ════════════════════════════════════════════════════════════════════

function dailyAgent() {
  Agent.run();
}

// ════════════════════════════════════════════════════════════════════
// Modulo Agent
// ════════════════════════════════════════════════════════════════════

const Agent = (() => {

  // ── EMAILS destinatari report ──────────────────────────────────────
  const _EMAIL_REPORT = [
    'mariateresabova.business@gmail.com',
    'ponzios71@gmail.com',
  ];

  // ══════════════════════════════════════════════════════════════════
  // RUN — Orchestratore principale (lanciato alle 08:00)
  // ══════════════════════════════════════════════════════════════════

  function run() {
    const ora   = new Date();
    const log   = [];
    let   ok    = true;

    DB.log('AGENTE', 'START', '', `Avvio giornaliero ${fmtDateTime(ora)}`, 'IN CORSO', '');
    SpreadsheetApp.getActiveSpreadsheet().toast('Agente MBBET in esecuzione…', '🤖', 10);

    // 1. Calcola penali
    try {
      const nPen = calcolaPenali();
      log.push(`⚠️  Penali calcolate/aggiornate: ${nPen}`);
    } catch (e) { log.push(`❌  Penali: ${e.message}`); ok = false; }

    // 2. Task scaduti → escala priorità
    try {
      const nEsc = _escalaTaakScaduti();
      log.push(`📋  Task escalati: ${nEsc}`);
    } catch (e) { log.push(`❌  Escalation: ${e.message}`); ok = false; }

    // 3. Genera task giornalieri
    try {
      const nTask = Task.generateDaily();
      log.push(`✅  Nuovi task generati: ${nTask}`);
    } catch (e) { log.push(`❌  Task: ${e.message}`); ok = false; }

    // 4. Clienti fermi oltre soglia → alert
    try {
      const nFermi = _checkClentiFermi();
      log.push(`🛑  Clienti fermi segnalati: ${nFermi}`);
    } catch (e) { log.push(`❌  Clienti fermi: ${e.message}`); ok = false; }

    // 5. Invia report email
    try {
      sendEmailReport(log);
      log.push('📧  Report email inviato');
    } catch (e) { log.push(`❌  Email: ${e.message}`); ok = false; }

    // 6. Aggiorna Dashboard se il modulo esiste
    try {
      if (typeof Dashboard !== 'undefined') {
        Dashboard.rebuild();
        log.push('📊  Dashboard aggiornata');
      }
    } catch (e) { log.push(`⚠️  Dashboard: ${e.message}`); }

    DB.log('AGENTE', 'END', '',
      log.join(' | '),
      ok ? 'OK' : 'PARZIALE',
      ok ? '' : 'Alcuni step falliti (vedi log)'
    );

    SpreadsheetApp.getActiveSpreadsheet().toast(
      `Completato. ${log.length} step eseguiti.`, ok ? '✅ Agente OK' : '⚠️ Agente Parziale', 6);
  }

  // ══════════════════════════════════════════════════════════════════
  // CALCOLA PENALI
  // ══════════════════════════════════════════════════════════════════
  //   Penale: € CFG.PENALE_GG/giorno se cliente accetta condizioni
  //           ma non fa la prima operazione entro CFG.ORE_PRIMA_OP ore
  //   Ogni chiamata aggiorna (non duplica) la riga di penale esistente
  //   o ne crea una nuova se non esiste.

  function calcolaPenali() {
    const ora      = new Date();
    const shP      = DB.ss().getSheetByName(SH.PENALI);
    const shC      = DB.ss().getSheetByName(SH.CLIENTI);
    if (!shP || !shC) return 0;

    const cliData  = DB.read(SH.CLIENTI);
    const penData  = DB.read(SH.PENALI);   // lettura cache
    let n = 0;

    cliData.forEach(r => {
      if (!r[COL.CLI.ID]) return;
      const statoAcc = r[COL.CLI.STATO_ACC] || '';
      if (statoAcc !== 'Accettato') return;

      const dataAcc  = r[COL.CLI.DATA_ACC];
      if (!(dataAcc instanceof Date)) return;

      const dataPrimaOp = r[COL.CLI.DATA_PRIMA_OP];
      const hasIniz     = dataPrimaOp instanceof Date;

      // Calcolo giorni ritardo
      const scadenza = new Date(dataAcc.getTime() + CFG.ORE_PRIMA_OP * 3600 * 1000);
      let ggRitardo  = 0;
      if (hasIniz) {
        ggRitardo = Math.max(0, Math.floor((dataPrimaOp - scadenza) / 86400000));
      } else {
        ggRitardo = Math.max(0, Math.floor((ora - scadenza) / 86400000));
      }

      if (ggRitardo === 0) return;

      const totPenale   = ggRitardo * CFG.PENALE_GG;
      const penaleAtt   = hasIniz ? false : true;
      const idC         = r[COL.CLI.ID];
      const nomeCliente = r[COL.CLI.NOME];
      const operatore   = r[COL.CLI.OPERATORE];

      // ── Cerca penale esistente per questo cliente ──────────────
      const penEsist = penData.find(p =>
        p[COL.PEN.ID_CLI] === idC
      );

      if (penEsist) {
        // Aggiorna riga esistente
        const rowPen = penData.indexOf(penEsist) + 2; // +2 perché header riga1 + offset
        // Conta dalla riga reale nel foglio PENALI (che ha 3 righe legale + header)
        // Data starts from row 5 — indexOf + 5
        const rigaFoglio = penData.indexOf(penEsist) + 5;

        shP.getRange(rigaFoglio, COL.PEN.GG_RIT + 1).setValue(ggRitardo);
        shP.getRange(rigaFoglio, COL.PEN.TOT_PEN + 1)
           .setValue(totPenale).setNumberFormat(FMT.EURO);
        shP.getRange(rigaFoglio, COL.PEN.STATO + 1)
           .setValue(hasIniz ? 'Chiusa' : 'In Calcolo');
        shP.getRange(rigaFoglio, COL.PEN.ULT_AGG + 1)
           .setValue(ora).setNumberFormat(FMT.ORARIO);
        if (hasIniz && !(penEsist[COL.PEN.DATA_FINE] instanceof Date)) {
          shP.getRange(rigaFoglio, COL.PEN.DATA_FINE + 1)
             .setValue(dataPrimaOp).setNumberFormat(FMT.DATA);
        }
        n++;
      } else {
        // Crea nuova riga penale
        const idPen  = DB.nextId(SH.PENALI, PFX.PEN, 4);
        const rigaNew = shP.getLastRow() + 1;
        const row     = new Array(COL.PEN._N).fill('');
        row[COL.PEN.ID]          = idPen;
        row[COL.PEN.ID_CLI]      = idC;
        row[COL.PEN.NOME_CLI]    = nomeCliente;
        row[COL.PEN.OPERATORE]   = operatore;
        row[COL.PEN.DATA_ACC]    = dataAcc;
        row[COL.PEN.SCAD_48H]    = scadenza;
        row[COL.PEN.DATA_INI]    = hasIniz ? dataPrimaOp : '';
        row[COL.PEN.DATA_FINE]   = hasIniz ? dataPrimaOp : '';
        row[COL.PEN.GG_RIT]      = ggRitardo;
        row[COL.PEN.PENALEG]     = CFG.PENALE_GG;
        row[COL.PEN.TOT_PEN]     = totPenale;
        row[COL.PEN.STATO]       = hasIniz ? 'Chiusa' : 'In Calcolo';
        row[COL.PEN.ULT_AGG]     = ora;

        shP.getRange(rigaNew, 1, 1, row.length).setValues([row]);
        // Formati
        const fmtCols = {
          [COL.PEN.DATA_ACC+1]:  FMT.DATA,
          [COL.PEN.SCAD_48H+1]:  FMT.ORARIO,
          [COL.PEN.DATA_INI+1]:  FMT.DATA,
          [COL.PEN.DATA_FINE+1]: FMT.DATA,
          [COL.PEN.TOT_PEN+1]:   FMT.EURO,
          [COL.PEN.ULT_AGG+1]:   FMT.ORARIO,
          [COL.PEN.PENALEG+1]:   FMT.EURO,
        };
        Object.entries(fmtCols).forEach(([c, f]) => {
          shP.getRange(rigaNew, parseInt(c)).setNumberFormat(f);
        });
        // Colore riga
        const bg = hasIniz ? '#134e2f' : '#450a0a';
        const fg = hasIniz ? '#86efac' : '#fca5a5';
        shP.getRange(rigaNew, 1, 1, row.length).setBackground(bg).setFontColor(fg);
        n++;
      }

      // ── Aggiorna colonne GG_RITARDO/TOT_PENALE nel foglio CLIENTI ──
      const sheetRowCli = cliData.indexOf(r) + 2; // +2 = header+1
      shC.getRange(sheetRowCli, COL.CLI.GG_RITARDO + 1).setValue(ggRitardo);
      shC.getRange(sheetRowCli, COL.CLI.TOT_PENALE + 1)
         .setValue(totPenale).setNumberFormat(FMT.EURO);
      shC.getRange(sheetRowCli, COL.CLI.PENALE_ATT + 1).setValue(penaleAtt);
    });

    DB.invalidate(SH.PENALI);
    DB.invalidate(SH.CLIENTI);
    return n;
  }

  // ══════════════════════════════════════════════════════════════════
  // ESCALATION TASK SCADUTI
  // ══════════════════════════════════════════════════════════════════

  function _escalaTaakScaduti() {
    const ora      = new Date();
    const taskData = DB.read(SH.TASK);
    const shT      = DB.ss().getSheetByName(SH.TASK);
    if (!shT) return 0;
    let n = 0;

    taskData.forEach((t, i) => {
      if (t[COL.TSK.STATO] !== 'Aperto') return;
      const scad = t[COL.TSK.SCADENZA];
      if (!(scad instanceof Date)) return;
      const oreScaduto = (ora - scad) / (1000 * 60 * 60);
      if (oreScaduto < 0) return;

      const prioCurr = t[COL.TSK.PRIO] || 'BASSA';
      const prioMap  = { BASSA:0, MEDIA:1, ALTA:2, URGENTE:3 };
      const idx      = prioMap[prioCurr] || 0;

      // Dopo 4h → +1, dopo 24h → URGENTE direttamente
      let nuovaPrio = prioCurr;
      if (oreScaduto >= 24) nuovaPrio = 'URGENTE';
      else if (oreScaduto >= 4 && idx < 3) nuovaPrio = Object.keys(prioMap)[idx + 1];

      if (nuovaPrio === prioCurr) return;

      const rigaT = i + 2; // header row 1
      shT.getRange(rigaT, COL.TSK.PRIO + 1).setValue(nuovaPrio);
      shT.getRange(rigaT, COL.TSK.NOTE + 1)
         .setValue((t[COL.TSK.NOTE] || '') + ` | ⬆️ Escalato a ${nuovaPrio} (scaduto ${Math.floor(oreScaduto)}h fa)`);

      const styleMap = {
        URGENTE: {bg:'#450a0a',fg:'#fca5a5'},
        ALTA:    {bg:'#3b0a0a',fg:'#f87171'},
        MEDIA:   {bg:'#2d1c02',fg:'#fed7aa'},
        BASSA:   {bg:'#0a1a0a',fg:'#86efac'},
      };
      const s = styleMap[nuovaPrio] || styleMap.BASSA;
      shT.getRange(rigaT, COL.TSK.PRIO + 1).setBackground(s.bg).setFontColor(s.fg).setFontWeight('bold');
      n++;
    });

    DB.invalidate(SH.TASK);
    return n;
  }

  // ══════════════════════════════════════════════════════════════════
  // CHECK CLIENTI FERMI
  // ══════════════════════════════════════════════════════════════════

  function _checkClentiFermi() {
    const ora      = new Date();
    const cliData  = DB.read(SH.CLIENTI);
    const bnsData  = DB.read(SH.BONUS);
    let n = 0;

    cliData.forEach(r => {
      if (!r[COL.CLI.ID] || r[COL.CLI.STATO] !== 'ATTIVO') return;
      const idC = r[COL.CLI.ID];

      const bonusCliente = bnsData.filter(b => b[COL.BNS.ID_CLI] === idC);
      const ultOp = bonusCliente.reduce((max, b) => {
        const d = b[COL.BNS.ULT_AZ];
        return d instanceof Date && d > max ? d : max;
      }, new Date(0));

      if (!(ultOp instanceof Date) || ultOp.getTime() === 0) return;

      const ggFermo = (ora - ultOp) / 86400000;
      const urgente = ggFermo >= CFG.GG_FERMO_URG;
      const soglia  = ggFermo >= CFG.GG_FERMO;

      if (!soglia) return;

      // Crea task solo se non esiste già uno aperto
      const taskEsist = DB.findFirst(SH.TASK, t =>
        t[COL.TSK.ID_CLI] === idC &&
        t[COL.TSK.TIPO]   === 'CLIENTE FERMO' &&
        t[COL.TSK.STATO]  === 'Aperto'
      );
      if (taskEsist) return;

      Task.create({
        tipo:      'CLIENTE FERMO',
        prio:      urgente ? 'URGENTE' : 'ALTA',
        idCli:     idC,
        nomeCli:   r[COL.CLI.NOME],
        operatore: r[COL.CLI.OPERATORE],
        desc:      `${r[COL.CLI.NOME]} non ha attività da ${Math.floor(ggFermo)} giorni (ultima: ${fmtDate(ultOp)}). ${urgente ? '🚨 URGENTE — Rischio abbandono!' : '⚠️ Contattare.'}`,
      });
      n++;
    });
    return n;
  }

  // ══════════════════════════════════════════════════════════════════
  // INVIA REPORT EMAIL
  // ══════════════════════════════════════════════════════════════════

  function sendEmailReport(agentLog) {
    const ora = new Date();

    // ── Raccogli dati KPI ──────────────────────────────────────────
    const cliData  = DB.read(SH.CLIENTI);
    const bnsData  = DB.read(SH.BONUS);
    const taskData = DB.read(SH.TASK);
    const penData  = DB.read(SH.PENALI);

    const nCliTot    = cliData.filter(r => r[COL.CLI.ID]).length;
    const nAttivi    = cliData.filter(r => r[COL.CLI.STATO] === 'ATTIVO').length;
    const nNuovi     = cliData.filter(r => {
      const d = r[COL.CLI.DATA_ING];
      if (!(d instanceof Date)) return false;
      return (ora - d) < 7 * 86400000;
    }).length;

    const ricTot     = bnsData.reduce((s,r) => s + (parseFloat(r[COL.BNS.RIC_REAL])||0), 0);
    const marTot     = cliData.reduce((s,r) => s + (parseFloat(r[COL.CLI.MARGINE])||0), 0);

    const taskUrgenti = taskData.filter(r => r[COL.TSK.STATO]==='Aperto'&&r[COL.TSK.PRIO]==='URGENTE');
    const taskAlti    = taskData.filter(r => r[COL.TSK.STATO]==='Aperto'&&r[COL.TSK.PRIO]==='ALTA');
    const taskOggi    = taskData.filter(r => {
      if (r[COL.TSK.STATO]!=='Aperto') return false;
      const s = r[COL.TSK.SCADENZA];
      return s instanceof Date && s.toDateString() === ora.toDateString();
    });
    const penAttive  = penData.filter(r => r[COL.PEN.STATO]==='In Calcolo');
    const penTot     = penAttive.reduce((s,r) => s + (parseFloat(r[COL.PEN.TOT_PEN])||0), 0);

    // ── KPI per operatore ──────────────────────────────────────────
    const ops = ['Manu', 'Sere', 'Samu', 'Mary'];
    const kpiOp = ops.map(op => {
      const cliOp   = cliData.filter(r => r[COL.CLI.OPERATORE] === op);
      const taskOp  = taskData.filter(r => r[COL.TSK.OPERATORE]===op && r[COL.TSK.STATO]==='Aperto');
      const urgOp   = taskOp.filter(r => r[COL.TSK.PRIO]==='URGENTE').length;
      const altaOp  = taskOp.filter(r => r[COL.TSK.PRIO]==='ALTA').length;
      const penOp   = penAttive.filter(r => r[COL.PEN.OPERATORE]===op);
      const penTotO = penOp.reduce((s,r) => s + (parseFloat(r[COL.PEN.TOT_PEN])||0), 0);
      return { op, nCli: cliOp.length, nTask: taskOp.length, urgOp, altaOp, penOp: penOp.length, penTotO };
    });

    // ── HTML Email ─────────────────────────────────────────────────
    const html = _buildEmailHtml({
      ora, nCliTot, nAttivi, nNuovi,
      ricTot, marTot,
      taskUrgenti, taskAlti, taskOggi,
      penAttive, penTot,
      kpiOp, agentLog: agentLog || [],
    });

    const soggetto = `🎯 MBBET · Report ${fmtDate(ora)} — ${taskUrgenti.length > 0 ? '🚨 ' + taskUrgenti.length + ' URGENTI' : '✅ OK'}`;

    // ── Invia alle email config + fallback alle hardcoded ──────────
    const emailConf1 = DB.config('Email notifiche 1');
    const emailConf2 = DB.config('Email notifiche 2');
    const destinatari = [...new Set([
      ..._EMAIL_REPORT,
      ...(emailConf1 ? [emailConf1] : []),
      ...(emailConf2 ? [emailConf2] : []),
    ])];

    destinatari.forEach(email => {
      GmailApp.sendEmail(email, soggetto, 'Apri in HTML per la versione grafica.', {
        htmlBody: html,
        name: 'MBBET CRM Agent',
        replyTo: 'mariateresabova.business@gmail.com',
      });
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // BUILDER EMAIL HTML (dark navy × gold)
  // ══════════════════════════════════════════════════════════════════

  function _buildEmailHtml(d) {
    const {
      ora, nCliTot, nAttivi, nNuovi,
      ricTot, marTot,
      taskUrgenti, taskAlti, taskOggi,
      penAttive, penTot,
      kpiOp, agentLog
    } = d;

    const alertBanner = taskUrgenti.length > 0
      ? `<div style="background:#7f1d1d;border-left:4px solid #ef4444;padding:14px 18px;border-radius:6px;margin-bottom:20px;color:#fca5a5;font-weight:700;font-size:16px;">
          🚨  ${taskUrgenti.length} TASK URGENTI — Intervento immediato richiesto!
         </div>`
      : '';

    const penBanner = penAttive.length > 0
      ? `<div style="background:#78350f;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:6px;margin-bottom:16px;color:#fde68a;font-weight:600;">
          ⚠️  ${penAttive.length} penale/i attive per un totale di ${fmtEuro(penTot)} — Clienti da contattare!
         </div>`
      : '';

    const kpiHtml = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px;">
        ${_kpiCard('👥 Clienti Totali',  nCliTot,  '')}
        ${_kpiCard('✅ Clienti Attivi',  nAttivi,  '#10b981')}
        ${_kpiCard('🆕 Nuovi 7gg',       nNuovi,   '#3b82f6')}
        ${_kpiCard('💰 Ricavo Totale',   fmtEuro(ricTot), '#f59e0b')}
        ${_kpiCard('📈 Margine Totale',  fmtEuro(marTot), marTot >= 0 ? '#10b981' : '#ef4444')}
        ${_kpiCard('🚨 Task Urgenti',    taskUrgenti.length, taskUrgenti.length > 0 ? '#ef4444' : '#10b981')}
      </div>`;

    const opsHtml = kpiOp.map(k =>
      `<tr style="border-bottom:1px solid #334155;">
        <td style="padding:10px 8px;color:#f8fafc;font-weight:600;">${k.op}</td>
        <td style="padding:10px 8px;color:#94a3b8;text-align:center;">${k.nCli}</td>
        <td style="padding:10px 8px;text-align:center;color:${k.urgOp>0?'#fca5a5':'#94a3b8'};">
          ${k.urgOp > 0 ? `🚨 ${k.urgOp} URG + ${k.altaOp} ALT` : k.nTask}
        </td>
        <td style="padding:10px 8px;text-align:center;color:${k.penOp>0?'#fde68a':'#94a3b8'};">
          ${k.penOp > 0 ? `⚠️ ${k.penOp} (${fmtEuro(k.penTotO)})` : '—'}
        </td>
       </tr>`
    ).join('');

    const urgTaskHtml = taskUrgenti.length > 0
      ? `<div style="margin-top:20px;">
           <h3 style="color:#fca5a5;margin:0 0 10px;">🚨 Task Urgenti</h3>
           ${taskUrgenti.slice(0,10).map(t =>
             `<div style="background:#3b0a0a;border-left:3px solid #ef4444;padding:10px 12px;margin-bottom:8px;border-radius:4px;">
                <span style="color:#f87171;font-weight:700;">[${t[COL.TSK.TIPO]}]</span>
                <span style="color:#fca5a5;"> ${t[COL.TSK.NOME_CLI]}</span>
                <span style="color:#94a3b8;font-size:12px;"> — ${t[COL.TSK.OPERATORE]||'?'}</span><br>
                <span style="color:#e2e8f0;font-size:13px;">${t[COL.TSK.DESC]||''}</span>
              </div>`
           ).join('')}
         </div>` : '';

    const taskOggiHtml = taskOggi.length > 0
      ? `<div style="margin-top:16px;">
           <h3 style="color:#fde68a;margin:0 0 10px;">⏰ Scadono Oggi</h3>
           ${taskOggi.slice(0,8).map(t =>
             `<div style="background:#2d1c02;border-left:3px solid #f59e0b;padding:8px 12px;margin-bottom:6px;border-radius:4px;">
                <span style="color:#fde68a;font-weight:600;">${t[COL.TSK.NOME_CLI]}</span>
                <span style="color:#94a3b8;"> — ${t[COL.TSK.TIPO]} (${t[COL.TSK.OPERATORE]||'?'})</span><br>
                <span style="color:#e2e8f0;font-size:13px;">${t[COL.TSK.DESC]||''}</span>
              </div>`
           ).join('')}
         </div>` : '';

    const penHtml = penAttive.length > 0
      ? `<div style="margin-top:16px;">
           <h3 style="color:#fde68a;margin:0 0 10px;">⚠️ Penali Attive</h3>
           ${penAttive.slice(0,10).map(p =>
             `<div style="background:#2d1c02;padding:8px 12px;margin-bottom:6px;border-radius:4px;">
                <span style="color:#fde68a;font-weight:600;">${p[COL.PEN.NOME_CLI]}</span>
                <span style="color:#94a3b8;"> — op: ${p[COL.PEN.OPERATORE]||'?'}</span>
                <span style="color:#fca5a5;float:right;font-weight:700;">${fmtEuro(p[COL.PEN.TOT_PEN]||0)} (${p[COL.PEN.GG_RIT]||0} gg)</span>
              </div>`
           ).join('')}
         </div>` : '';

    const logHtml = agentLog.length > 0
      ? `<div style="margin-top:20px;background:#0f172a;border-radius:6px;padding:12px;font-size:12px;color:#64748b;">
           <strong style="color:#475569;">Log agente:</strong><br>
           ${agentLog.map(l => `• ${l}`).join('<br>')}
         </div>` : '';

    return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:640px;margin:0 auto;padding:24px 16px;">

  <!-- HEADER -->
  <div style="background:linear-gradient(135deg,#1e293b,#0f172a);border:1px solid #f59e0b;border-radius:12px;padding:24px;margin-bottom:20px;text-align:center;">
    <div style="font-size:28px;margin-bottom:4px;">🎯</div>
    <h1 style="color:#f59e0b;margin:0 0 4px;font-size:22px;font-weight:800;letter-spacing:1px;">MBBET CRM</h1>
    <p style="color:#94a3b8;margin:0;font-size:14px;">Report giornaliero · ${fmtDate(ora)}</p>
  </div>

  ${alertBanner}
  ${penBanner}

  <!-- KPI -->
  <div style="background:#1e293b;border-radius:10px;padding:20px;margin-bottom:16px;">
    <h2 style="color:#f8fafc;margin:0 0 14px;font-size:16px;">📊 KPI del Giorno</h2>
    ${kpiHtml}
  </div>

  <!-- OPERATORI -->
  <div style="background:#1e293b;border-radius:10px;padding:20px;margin-bottom:16px;">
    <h2 style="color:#f8fafc;margin:0 0 14px;font-size:16px;">👥 Situazione Operatori</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <thead>
        <tr style="border-bottom:2px solid #f59e0b;">
          <th style="padding:8px;color:#f59e0b;text-align:left;">Operatore</th>
          <th style="padding:8px;color:#f59e0b;text-align:center;">Clienti</th>
          <th style="padding:8px;color:#f59e0b;text-align:center;">Task Aperti</th>
          <th style="padding:8px;color:#f59e0b;text-align:center;">Penali</th>
        </tr>
      </thead>
      <tbody>${opsHtml}</tbody>
    </table>
  </div>

  ${urgTaskHtml ? `<div style="background:#1e293b;border-radius:10px;padding:20px;margin-bottom:16px;">${urgTaskHtml}</div>` : ''}
  ${taskOggiHtml ? `<div style="background:#1e293b;border-radius:10px;padding:20px;margin-bottom:16px;">${taskOggiHtml}</div>` : ''}
  ${penHtml ? `<div style="background:#1e293b;border-radius:10px;padding:20px;margin-bottom:16px;">${penHtml}</div>` : ''}

  ${logHtml}

  <!-- FOOTER -->
  <div style="text-align:center;padding:16px 0;color:#475569;font-size:12px;">
    <p style="margin:0;">MBBET CRM Agent · Generato il ${fmtDateTime(ora)}</p>
    <p style="margin:4px 0 0;">Questo messaggio è stato inviato automaticamente. Non rispondere a questa email.</p>
  </div>

</div>
</body>
</html>`;
  }

  // ── Helper KPI Card HTML ──────────────────────────────────────────

  function _kpiCard(label, val, color) {
    const c = color || '#f8fafc';
    return `<div style="background:#0f172a;border:1px solid #334155;border-radius:8px;padding:14px;text-align:center;">
      <div style="color:#64748b;font-size:12px;margin-bottom:4px;">${label}</div>
      <div style="color:${c};font-size:20px;font-weight:800;">${val}</div>
    </div>`;
  }

  // ══════════════════════════════════════════════════════════════════
  // INSTALLA TRIGGER GIORNALIERO
  // ══════════════════════════════════════════════════════════════════

  function installDaily() {
    const ui = SpreadsheetApp.getUi();
    const existing = ScriptApp.getProjectTriggers()
      .filter(t => t.getHandlerFunction() === 'dailyAgent');

    if (existing.length > 0) {
      const r = ui.alert('🤖  Trigger Già Installato',
        `Il trigger "dailyAgent" è già attivo (${existing.length} istanza/e).\nVuoi eliminare quello esistente e ricrearlo alle ${CFG.AGENTE_ORA}:00?`,
        ui.ButtonSet.YES_NO);
      if (r !== ui.Button.YES) return;
      existing.forEach(t => ScriptApp.deleteTrigger(t));
    }

    ScriptApp.newTrigger('dailyAgent')
      .timeBased()
      .everyDays(1)
      .atHour(CFG.AGENTE_ORA)
      .create();

    DB.log('SETUP', 'TRIGGER_AGENTE', '', `Installato: dailyAgent ogni giorno alle ${CFG.AGENTE_ORA}:00`, 'OK', '');
    ui.alert('✅  Trigger Installato',
      `L'agente giornaliero si attiverà ogni giorno alle ${CFG.AGENTE_ORA}:00.\n\n` +
      `• Calcolerà le penali\n• Genererà task\n• Invierà report a:\n  - mariateresabova.business@gmail.com\n  - ponzios71@gmail.com`,
      ui.ButtonSet.OK);
  }

  // ══════════════════════════════════════════════════════════════════
  // EXPOSE
  // ══════════════════════════════════════════════════════════════════

  return { run, calcolaPenali, sendEmailReport, installDaily };

})();
