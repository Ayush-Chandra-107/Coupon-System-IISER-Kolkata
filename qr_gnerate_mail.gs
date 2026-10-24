// Contact the owner of this GitHub account for any assistance regarding this code
// Installable trigger: onFormSubmit (From spreadsheet -> On form submit). onOpen runs by itself.

var CFG = {
  RESP: 'Form Responses 1',
  SCAN: 'Scan',
  COL: { NAME: 3, BATCH: 4, EMAIL: 5, AMT: 6, UTR: 7, PREF: 8 },   // column numbers in the responses sheet
  DOMAIN: 'iiserkol.ac.in',                       // '' = accept any email domain
  UTR_RE: /^[A-Za-z0-9]{4,22}$/,                  // edit if your form only collects e.g. the last 4 digits
  ORGANISER: 'ac22ms107@iiserkol.ac.in',          // gets an email for every failure; '' = off
  VEG_SPLIT: true,                                // true = Veg / Non-veg scan screens; false = a single "FOOD" screen (food / no-food form)
  NO_FOOD: 'No food',                             // the form option that means "no coupon" (case-insensitive)
  SUBJECT: "Shubho Bijoya Grand Lunch 2025: Your Coupon and Event Details"
};
var STATUS_HEADERS = ['QR Status', 'QR Detail', 'QR Updated'];

// ---------- entry points ----------
function onFormSubmit(e) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CFG.RESP);
  var row = (e && e.range) ? e.range.getRow() : sh.getLastRow();   // the row that was actually submitted
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);                                            // simultaneous submissions queue up
  try { processRow_(sh, row, false, false); } finally { lock.releaseLock(); }
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Agomoni')
    .addItem('Resend selected rows', 'resendSelected')
    .addItem('Retry all failed rows', 'retryFailed')
    .addItem('Status summary', 'showSummary')
    .addSeparator()
    .addItem('Check for bounced mails now', 'checkBounces')
    .addItem('Turn on automatic bounce check', 'enableBounceCheck')
    .addToUi();
}

function resendSelected() {
  var ui = SpreadsheetApp.getUi(), sh = SpreadsheetApp.getActiveSheet();
  if (sh.getName() !== CFG.RESP) return ui.alert('Open the "' + CFG.RESP + '" sheet and select the rows to resend.');
  var set = {};
  sh.getActiveRangeList().getRanges().forEach(function (r) {
    for (var i = r.getRow(); i < r.getRow() + r.getNumRows(); i++) if (i > 1) set[i] = 1;
  });
  var rows = Object.keys(set).map(Number);
  if (!rows.length) return ui.alert('Select at least one data row.');
  if (ui.alert('Resend ' + rows.length + ' row(s)? Fix the email/UTR cells first if that was the problem.', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  runRows_(sh, rows, true);
}

function retryFailed() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CFG.RESP), c = statusCols_(sh), n = sh.getLastRow() - 1, rows = [];
  if (n > 0) sh.getRange(2, c.status, n, 1).getValues().forEach(function (r, i) {
    if (r[0] && ['SENT', 'NO_FOOD', 'BOUNCED'].indexOf(r[0]) === -1) rows.push(i + 2);
  });
  if (!rows.length) return SpreadsheetApp.getUi().alert('No failed rows.');
  runRows_(sh, rows, true);
}

function showSummary() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CFG.RESP), c = statusCols_(sh), n = sh.getLastRow() - 1, t = {};
  if (n > 0) sh.getRange(2, c.status, n, 1).getValues().forEach(function (r) { var k = r[0] || '(not processed)'; t[k] = (t[k] || 0) + 1; });
  SpreadsheetApp.getUi().alert(Object.keys(t).map(function (k) { return k + ': ' + t[k]; }).join('\n') || 'No responses yet.');
}

function runRows_(sh, rows, force) {
  var lock = LockService.getScriptLock(), tally = {};
  lock.waitLock(30000);
  try {
    rows.forEach(function (r) { var s = processRow_(sh, r, true, force).status; tally[s] = (tally[s] || 0) + 1; });
  } finally { lock.releaseLock(); }
  SpreadsheetApp.getUi().alert('Done.\n' + Object.keys(tally).map(function (k) { return k + ': ' + tally[k]; }).join('\n') +
    '\n\nSee the QR Status / QR Detail columns for reasons.');
}

// ---------- core ----------
// force = true for manual resends; automatic sends skip an ID that was already issued (e.g. trigger firing twice)
function processRow_(sh, row, quiet, force) {
  var C = CFG.COL, cols = statusCols_(sh);
  var v = sh.getRange(row, 1, 1, sh.getLastColumn()).getValues()[0];
  var g = function (c) { return String(v[c - 1]).trim(); };
  var name = g(C.NAME), batch = g(C.BATCH), email = g(C.EMAIL), amt = g(C.AMT), utr = g(C.UTR), pref = g(C.PREF);
  var done = function (s, d) { return finish_(sh, row, cols, s, d, quiet); };

  if (pref.toLowerCase() === String(CFG.NO_FOOD).toLowerCase()) return done('NO_FOOD', 'No food selected, coupon not needed');
  var missing = [['Name', name], ['Batch', batch], ['Email', email], ['Amount', amt], ['UTR', utr], ['Food preference', pref]]
    .filter(function (x) { return !x[1]; }).map(function (x) { return x[0]; });
  if (missing.length) return done('MISSING_FIELD', 'Empty: ' + missing.join(', '));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return done('INVALID_EMAIL', 'Not a valid email address: ' + email);
  if (CFG.DOMAIN && email.toLowerCase().slice(-(CFG.DOMAIN.length + 1)) !== '@' + CFG.DOMAIN)
    return done('INVALID_EMAIL', 'Not an @' + CFG.DOMAIN + ' address: ' + email);
  if (!CFG.UTR_RE.test(utr)) return done('INVALID_UTR', 'UTR format looks wrong: ' + utr);
  if (!(parseFloat(amt) > 0)) return done('INVALID_AMOUNT', 'Amount is not a positive number: ' + amt);
  var id = utr + 'no.' + row;   // same ID format as before, so already-issued QR codes stay valid
  if (!force && issued_(id)) return { status: 'SKIPPED', detail: 'ID ' + id + ' already issued, no mail sent' };
  if (MailApp.getRemainingDailyQuota() < 1) return done('QUOTA_EXCEEDED', 'Daily mail quota used up. Use "Retry all failed rows" later');

  try {
    MailApp.sendEmail({ to: email, subject: CFG.SUBJECT, htmlBody: mailBody_(name, amt, id) });
  } catch (err) { return done('MAIL_FAILED', String(err.message || err)); }

  var res = done('SENT', 'Sent to ' + email + ' (ID ' + id + ')');
  upsertScan_(row, id, pref, name, batch);
  syncBatchSheet_(sh, row, batch);
  return res;
}

// Returns the Scan sheet, creating it (with a header row) the first time it is needed.
function scanSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName(CFG.SCAN);
  if (sh) return sh;
  try {
    sh = ss.insertSheet(CFG.SCAN);
    sh.getRange(1, 1, 1, 6).setValues([['ID', 'Scanned', 'Food pref', 'Name', 'Scanned at', 'Batch']]).setFontWeight('bold');
    sh.setFrozenRows(1);
  } catch (e) {                                   // another request created it at the same moment
    sh = ss.getSheetByName(CFG.SCAN);
    if (!sh) throw e;
  }
  return sh;
}

function issued_(id) {
  var sc = scanSheet_();
  return !!sc.getRange('A:A').createTextFinder(id).matchEntireCell(true).findNext();
}

function statusCols_(sh) {
  var last = sh.getLastColumn(), h = sh.getRange(1, 1, 1, last).getValues()[0], out = [];
  STATUS_HEADERS.forEach(function (name) {
    var i = h.indexOf(name);
    if (i === -1) { last++; sh.getRange(1, last).setValue(name); i = last - 1; h[i] = name; }
    out.push(i + 1);
  });
  return { status: out[0], detail: out[1], time: out[2] };
}

function finish_(sh, row, cols, status, detail, quiet) {
  var bad = ['SENT', 'NO_FOOD'].indexOf(status) === -1;
  sh.getRange(row, cols.status, 1, 3).setValues([[status, detail, new Date()]]);
  sh.getRange(row, cols.status).setBackground(status === 'SENT' ? '#d9ead3' : status === 'NO_FOOD' ? '#eeeeee' : status === 'QUOTA_EXCEEDED' ? '#fff2cc' : '#f4cccc');
  if (bad && !quiet && CFG.ORGANISER) {
    try { MailApp.sendEmail(CFG.ORGANISER, 'Agomoni coupon FAILED: row ' + row + ' (' + status + ')',
      detail + '\n\nFix the cell in row ' + row + ', then Agomoni menu > Resend selected rows.'); } catch (e) {}
  }
  return { status: status, detail: detail };
}

// ---------- bounce scanner ----------
// Reads Gmail bounce notices (Mail Delivery Subsystem) in the sender's inbox and marks the matching row BOUNCED.
var BOUNCE_LABEL = 'agomoni-bounce-checked';

function checkBounces() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CFG.RESP), c = statusCols_(sh), n = sh.getLastRow() - 1;
  if (n < 1) return;
  var label = GmailApp.getUserLabelByName(BOUNCE_LABEL) || GmailApp.createLabel(BOUNCE_LABEL);
  var threads = GmailApp.search('from:(mailer-daemon OR postmaster) newer_than:14d -label:' + BOUNCE_LABEL, 0, 50);
  var emails = sh.getRange(2, CFG.COL.EMAIL, n, 1).getValues(), st = sh.getRange(2, c.status, n, 1).getValues(),
      tm = sh.getRange(2, c.time, n, 1).getValues(), report = [];

  threads.forEach(function (t) {
    var msg = t.getMessages()[0], raw = msg.getRawContent();
    var m = raw.match(/X-Failed-Recipients:\s*([^\s,;]+)/i) || raw.match(/delivered to\s+<?([^\s<>]+@[^\s<>]+?)>?\s/i);
    if (m) {
      var addr = m[1].toLowerCase(), best = -1, bestT = 0;
      for (var i = 0; i < n; i++) {              // latest SENT row for this address that was sent before the bounce arrived
        var when = tm[i][0] instanceof Date ? tm[i][0].getTime() : 0;
        if (st[i][0] === 'SENT' && String(emails[i][0]).trim().toLowerCase() === addr && when <= msg.getDate().getTime() && when >= bestT) { best = i; bestT = when; }
      }
      if (best > -1) {
        var why = (msg.getPlainBody().match(/because[^\n]*(\n[^\n]+)?/i) || [''])[0].replace(/\s+/g, ' ').slice(0, 200) || 'Delivery failed';
        finish_(sh, best + 2, c, 'BOUNCED', addr + ' did not receive the mail: ' + why, true);
        report.push('Row ' + (best + 2) + ': ' + addr + ' - ' + why);
        st[best][0] = 'BOUNCED';
      }
    }
    t.addLabel(label);                           // never look at this notice again
  });
  if (report.length && CFG.ORGANISER) MailApp.sendEmail(CFG.ORGANISER, 'Agomoni: ' + report.length + ' coupon mail(s) bounced',
    report.join('\n') + '\n\nCorrect the email in those rows, then Agomoni menu > Resend selected rows.');
  try { SpreadsheetApp.getActiveSpreadsheet().toast(report.length + ' bounce(s) found', 'Agomoni'); } catch (e) {}
}

function enableBounceCheck() {
  var has = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'checkBounces'; });
  if (!has) ScriptApp.newTrigger('checkBounces').timeBased().everyMinutes(15).create();
  SpreadsheetApp.getUi().alert(has ? 'Automatic bounce check is already on.' : 'Bounce check will now run every 15 minutes.');
}

function upsertScan_(row, id, pref, name, batch) {
  var sc = scanSheet_();
  if (row > sc.getMaxRows()) sc.insertRowsAfter(sc.getMaxRows(), row - sc.getMaxRows());   // a new sheet only has ~1000 rows
  if (String(sc.getRange(row, 1).getValue()) !== id) {
    sc.getRange(row, 1, 1, 6).setValues([[id, 'no', pref, name, '', batch]]);   // new/corrected ID: old QR stops working
  } else {                                                                     // plain resend: keep scanned state
    sc.getRange(row, 3, 1, 2).setValues([[pref, name]]); sc.getRange(row, 6).setValue(batch);
  }
}

function syncBatchSheet_(sh, row, batch) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), seg = ss.getSheetByName(batch);
  if (!seg) { seg = ss.insertSheet(batch); seg.getRange(1, 1, 1, sh.getLastColumn()).setValues(sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()); }
  var data = sh.getRange(row, 1, 1, sh.getLastColumn()).getValues()[0], ts = data[0] instanceof Date ? data[0].getTime() : String(data[0]);
  var n = seg.getLastRow(), col = n > 0 ? seg.getRange(1, 1, n, 1).getValues() : [], at = seg.getLastRow() + 1;
  for (var i = 1; i < col.length; i++) if ((col[i][0] instanceof Date ? col[i][0].getTime() : String(col[i][0])) === ts) { at = i + 1; break; }
  seg.getRange(at, 1, 1, data.length).setValues([data]);      // update in place when resending, no duplicate rows
}

function mailBody_(recipientName, amt, uniqueID) {
  var qrCodeUrl = "https://quickchart.io/qr?text=" + encodeURIComponent(uniqueID) + "&dark=%23000000&light=%23FCE5B1&rounded=0.4&format=png";
  var agomoni_img_url = "https://ci3.googleusercontent.com/mail-sig/AIorK4zvC38JF4FR4Hfm8xObz3MYU0fujfOfNC__sfkAWB94ed9U1Pphsio5SHgPvCq8PU1j9YvWqwqu7rwL";
  var durga_image_url = "https://drive.google.com/uc?export=view&id=1h7LC7l1ehyynCN1YKF13gig0evE8JaTo";
  return `
    <p>Hey ${recipientName},</p>
    <p>We are delighted to welcome you to join us for the <strong style="color:red;">Shubho Bijoya Grand Lunch 2025</strong> on <em style="color:red;">October 10 at the main mess</em>. Get ready for a deep dive into authentic Bengali flavours before settling in again after Pujo!</p>
    <div style="text-align:center;">
      <table style="position: relative; display:inline-block;"><tr>
        <td style="background:url('${durga_image_url}') no-repeat center; background-size:contain; width:500px; height:707px; text-align:center; vertical-align:top;">
          <div style="margin-top:270px; margin-left:45px; text-align:left;"><img src="${qrCodeUrl}" style="width:120px; height:120px;"></div>
        </td></tr></table>
    </div>
    <p>Your seat at the table is booked - do not forget to bring this coupon with you for the feast! Your tastebuds will thank you :)<br></p>
    <p style="text-align: center;">P.S. For any discrepancies, do not hesitate to write back to us via email.<br>
    <small>Amount: ${amt}</small><br><small>UTR: ${uniqueID}</small></p>
    <p>Regards,<br>Team Agomoni '25</p>
    <p>--</p>
    <table><tr style="vertical-align: baseline;">
      <td><img src="${agomoni_img_url}" style="width:100px; height:100px;"></td>
      <td style="padding-left: 10px;"><p><strong>Team Agomoni 2025</strong></p></td>
    </tr></table>
    <p>Follow us at - <a href='https://instagram.com/agomoni_iiserkol?igshid=YmMyMTA2M2Y='>Instagram</a></p>`;
}
