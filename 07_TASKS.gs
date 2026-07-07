// ═══════════════════════════════════════════════════════════════════════
//   CRM MBBET · 07_TASKS.gs
//   Task Module — Creazione e gestione task operatori
//   v3.0
// ═══════════════════════════════════════════════════════════════════════

const Task = (() => {

  // ── Priorità → colore ─────────────────────────────────────────────────
  const _PRIO_STYLE = {
    'URGENTE': {bg:'#450a0a', fg:'#fca5a5'},
    'ALTA':    {bg: C.RED_BG, fg: C.RED_T},
    'MEDIA':   {bg: C.YELLOW_BG, fg: C.YELLOW_T},
    'BASSA':   {bg: C.GREEN_BG, fg: C.GREEN_T},
  };

  // ── CREATE ────────────────────────────────────────────────────────────
  //    opts: {tipo, prio, idCli, nomeCli, operatore, desc, scadenza, note}

  function create(opts) {
    const shT = DB.ss().getSheetByName(SH.TASK);
    if (!shT) return null;

    const idTask = DB.nextId(SH.TASK, PFX.TSK, 5);
    const row = new Array(COL.TSK._N).fill('');

    row[COL.TSK.ID]       = idTask;
    row[COL.TSK.PRIO]     = opts.prio    || 'MEDIA';
    row[COL.TSK.TIPO]     = opts.tipo    || 'ALTRO';
    row[COL.TSK.ID_CLI]   = opts.idCli   || '';
    row[COL.TSK.NOME_CLI] = opts.nomeCli || '';
    row[COL.TSK.OPERATORE]= opts.operatore || '';
    row[COL.TSK.DESC]     = opts.desc    || '';
    row[COL.TSK.SCADENZA] = opts.scadenza || _defaultScadenza(opts.prio);
    row[COL.TSK.STATO]    = 'Aperto';
    row[COL.TSK.DATA_CR]  = new Date();
    row[COL.TSK.NOTE]     = opts.note    || '';

    const rigaTask = shT.getLastRow() + 1;
    shT.getRange(rigaTask, 1, 1, row.length).setValues([row]);

    // Colora riga per priorità
    const style = _PRIO_STYLE[row[COL.TSK.PRIO]] || _PRIO_STYLE['MEDIA'];
    shT.getRange(rigaTask, COL.TSK.PRIO + 1)
      .setBackground(style.bg).setFontColor(style.fg).setFontWeight('bold');

    // Formatta data scadenza
    if (row[COL.TSK.SCADENZA] instanceof Date) {
      shT.getRange(rigaTask, COL.TSK.SCADENZA + 1).setNumberFormat(FMT.ORARIO);
    }

    DB.invalidate(SH.TASK);
    return idTask;
  }

  // ── DEFAULT SCADENZA per priorità ────────────────────────────────────

  function _defaultScadenza(prio) {
    const ora = new Date();
    const gg = prio === 'URGENTE' ? 0 : prio === 'ALTA' ? 1 : prio === 'MEDIA' ? 3 : 7;
    ora.setDate(ora.getDate() + gg);
    return ora;
  }

  // ── CLOSE ─────────────────────────────────────────────────────────────

  function close(idTask, note) {
    const found = DB.findById(SH.TASK, idTask);
    if (!found) return false;
    DB.update(SH.TASK, found.sheetRow, {
      [COL.TSK.STATO]: 'Fatto',
      [COL.TSK.NOTE]:  (found.row[COL.TSK.NOTE] ? found.row[COL.TSK.NOTE] + ' | ' : '') + (note || 'Completato'),
    });
    const shT = DB.ss().getSheetByName(SH.TASK);
    shT.getRange(found.sheetRow, COL.TSK.STATO + 1)
      .setBackground(C.GREEN_BG).setFontColor(C.GREEN_T);
    return true;
  }

  // ── GET OPEN PER OPERATORE ────────────────────────────────────────────

  function getOpenByOperator(operName) {
    return DB.find(SH.TASK, r =>
      r[COL.TSK.STATO] === 'Aperto' &&
      (r[COL.TSK.OPERATORE] || '').toLowerCase() === operName.toLowerCase()
    ).sort((a, b) => {
      const ord = {URGENTE:0, ALTA:1, MEDIA:2, BASSA:3};
      return (ord[a[COL.TSK.PRIO]] || 2) - (ord[b[COL.TSK.PRIO]] || 2);
    });
  }

  // ── GET SCADUTI ───────────────────────────────────────────────────────

  function getOverdue() {
    const ora = new Date();
    return DB.find(SH.TASK, r => {
      if (r[COL.TSK.STATO] !== 'Aperto') return false;
      const scad = r[COL.TSK.SCADENZA];
      return scad instanceof Date && scad < ora;
    });
  }

  // ── GENERA TASK GIORNALIERI (chiamata dall'agente) ────────────────────

  function generateDaily() {
    const ss  = DB.ss();
    const ora = new Date();
    const cliData = DB.read(SH.CLIENTI);
    const bnsData = DB.read(SH.BONUS);
    let creati = 0;

    cliData.forEach(r => {
      if (!r[COL.CLI.ID] || r[COL.CLI.STATO] !== 'ATTIVO') return;
      const idC   = r[COL.CLI.ID];
      const nomeC = r[COL.CLI.NOME];
      const op    = r[COL.CLI.OPERATORE];

      const bonusCliente = bnsData.filter(b => b[COL.BNS.ID_CLI] === idC);

      // 1. Nessun bonus IN CORSO → suggerisci prossimo bookmaker
      const inCorso  = bonusCliente.filter(b => b[COL.BNS.STATO] === 'IN CORSO');
      const liberi   = bonusCliente.filter(b => b[COL.BNS.STATO] === 'LIBERO');

      if (inCorso.length === 0 && liberi.length > 0) {
        // Ordina per priorità/tier e suggerisci il primo
        const prossimo = liberi.sort((a,b) => {
          const tierOrd = {'S+':0,'S':1,'A':2,'B':3,'C':4,'Standby':5};
          return (tierOrd[a[COL.BNS.TIER]]||5)-(tierOrd[b[COL.BNS.TIER]]||5);
        })[0];

        // Evita task duplicati aperti dello stesso tipo per lo stesso cliente
        const taskEsist = DB.findFirst(SH.TASK, t =>
          t[COL.TSK.ID_CLI] === idC &&
          t[COL.TSK.TIPO] === 'AVVIA PROSSIMO BONUS' &&
          t[COL.TSK.STATO] === 'Aperto'
        );
        if (!taskEsist) {
          create({
            tipo:      'AVVIA PROSSIMO BONUS',
            prio:      liberi.length > 10 ? 'ALTA' : 'MEDIA',
            idCli:     idC,
            nomeCli:   nomeC,
            operatore: op,
            desc:      `${nomeC} non ha bonus IN CORSO. Prossimo consigliato: ${prossimo[COL.BNS.BK]} (${prossimo[COL.BNS.TIER]}). ` +
                       `Bookmaker liberi rimasti: ${liberi.length}`,
            scadenza:  _defaultScadenza('MEDIA'),
          });
          creati++;
        }
      }

      // 2. IN CORSO senza prossima azione → promemoria
      inCorso.forEach(b => {
        if (!(b[COL.BNS.PROSS_AZ] || '').trim()) {
          const esistente = DB.findFirst(SH.TASK, t =>
            t[COL.TSK.ID_CLI] === idC &&
            t[COL.TSK.TIPO] === 'IMPOSTA PROSSIMA AZIONE' &&
            t[COL.TSK.STATO] === 'Aperto'
          );
          if (!esistente) {
            create({
              tipo:      'IMPOSTA PROSSIMA AZIONE',
              prio:      'MEDIA',
              idCli:     idC,
              nomeCli:   nomeC,
              operatore: op,
              desc:      `${nomeC} ha "${b[COL.BNS.BK]}" IN CORSO ma nessuna prossima azione impostata.`,
              scadenza:  _defaultScadenza('MEDIA'),
            });
            creati++;
          }
        }
      });

      // 3. Accettazione > 36h senza prima operazione → URGENTE
      if (r[COL.CLI.STATO_ACC] === 'Accettato') {
        const dataAcc = r[COL.CLI.DATA_ACC];
        if (dataAcc instanceof Date) {
          const orePassate = (ora - dataAcc) / (1000 * 60 * 60);
          const haIniz = bonusCliente.some(b =>
            b[COL.BNS.STATO] === 'IN CORSO' || b[COL.BNS.STATO] === 'FATTO'
          );
          if (!haIniz && orePassate >= 36 && orePassate < 72) {
            const esistente = DB.findFirst(SH.TASK, t =>
              t[COL.TSK.ID_CLI] === idC &&
              t[COL.TSK.TIPO] === 'CLIENTE NON HA INIZIATO' &&
              t[COL.TSK.STATO] === 'Aperto'
            );
            if (!esistente) {
              const scad48 = new Date(dataAcc.getTime() + 48 * 3600 * 1000);
              const urgente = orePassate >= 44;
              create({
                tipo:      'CLIENTE NON HA INIZIATO',
                prio:      urgente ? 'URGENTE' : 'ALTA',
                idCli:     idC,
                nomeCli:   nomeC,
                operatore: op,
                desc:      `${nomeC} ha accettato ${Math.floor(orePassate)}h fa ma non ha ancora iniziato. ` +
                           `Scadenza 48h: ${fmtDateTime(scad48)}. ${urgente ? '⛔ ULTIMA ORA!' : '⚠️ Contattare subito.'}`,
                scadenza:  scad48,
              });
              creati++;
            }
          }
        }
      }
    });

    return creati;
  }

  // ── EXPOSE ────────────────────────────────────────────────────────────

  return {create, close, getOpenByOperator, getOverdue, generateDaily};

})();
