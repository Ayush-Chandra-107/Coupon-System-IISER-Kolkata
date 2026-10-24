// Contact the owner of this GitHub account for any assistance regarding this code
// Scan sheet columns: A = ID, B = scanned (no/yes), C = food pref, D = name, E = scanned at, F = batch
//
// IMPORTANT: in 2026, newly created Apps Script web-app deployments block camera access
// ("Permissions policy violation: camera is not allowed in this document"); a 2025 deployment
// kept working when tested. See https://discuss.google.dev/t/camera-permission-in-web-app/333827
// So the scanner page is hosted OUTSIDE Apps Script (e.g. GitHub Pages), permanently, and talks
// to THIS script as a small JSON API instead of using google.script.run.
//
// Each year: change API_KEY below to a fresh secret, deploy this project, then give volunteers
// this link (fill in your hosted page's URL and this deployment's /exec URL):
//   https://<your-hosted-page>/?api=<this-deployment's-exec-URL>&key=<API_KEY-below>
// scanner.html itself never needs editing — it reads api/key from that link once and remembers
// them on each device after that.
var API_KEY = 'change-me-agomoni-2026';

function doGet(e) {
  if (e && e.parameter && e.parameter.action) return api_(e);
  // The scanner UI is hosted outside Apps Script now (see the note above); this URL is only
  // ever meant to be hit with ?action=... params by that page. A bare visit just gets a note.
  return ContentService.createTextOutput('Agomoni QR backend is running. The scanner page is hosted separately.');
}

function api_(e) {
  var out = function (obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); };
  if (e.parameter.key !== API_KEY) return out({ status: 'error', msg: 'Bad key' });
  switch (e.parameter.action) {
    case 'counts': return out(getCounts());
    case 'verify': return out(verifyCoupon(e.parameter.code));
    case 'undo': return out(undoScan(e.parameter.code));
    default: return out({ status: 'error', msg: 'Unknown action' });
  }
}

function scanRows_() {
  var sh = scanSheet_();                       // created automatically if missing (defined in qr_generate_mail.gs)
  var n = sh.getLastRow() - 1;
  return { sh: sh, data: n > 0 ? sh.getRange(2, 1, n, 6).getValues() : [] };
}

function countsOf_(data) {
  var total = 0, scanned = 0;
  data.forEach(function (r) { if (r[0] !== '') { total++; if (r[1] === 'yes') scanned++; } });
  return { total: total, scanned: scanned };
}

// What the volunteer's screen should show for this coupon. Controlled by CFG.VEG_SPLIT (qr_generate_mail.gs).
function kindOf_(pref) {
  if (!CFG.VEG_SPLIT) return 'food';
  return String(pref).toLowerCase().indexOf('non') === -1 ? 'veg' : 'nonveg';
}

function getCounts() { return countsOf_(scanRows_().data); }

function verifyCoupon(code) {
  code = String(code || '').trim();
  var lock = LockService.getScriptLock();
  try { lock.waitLock(5000); } catch (e) { return { status: 'busy', msg: 'Server is busy with another scan right now.' }; }
  try {
    var s = scanRows_(), i = -1;
    for (var k = 0; k < s.data.length; k++) if (String(s.data[k][0]) === code) { i = k; break; }
    if (i === -1) return { status: 'unknown', msg: 'No such coupon. Check the ID or ask the organisers.', counts: countsOf_(s.data) };

    var r = s.data[i], row = i + 2, info = { name: r[3], batch: r[5] };
    if (r[1] === 'yes') {
      var when = r[4] instanceof Date ? Utilities.formatDate(r[4], Session.getScriptTimeZone(), 'hh:mm a') : '';
      return Object.assign(info, { status: 'used', kind: kindOf_(r[2]), msg: when ? 'Scanned at ' + when : 'Scanned earlier', counts: countsOf_(s.data) });
    }
    s.sh.getRange(row, 2).setValue('yes');
    s.sh.getRange(row, 5).setValue(new Date());
    s.data[i][1] = 'yes';
    return Object.assign(info, { status: 'ok', kind: kindOf_(r[2]), msg: r[2], counts: countsOf_(s.data) });
  } finally { lock.releaseLock(); }
}

function undoScan(code) {                     // for accidental scans
  var lock = LockService.getScriptLock();
  try { lock.waitLock(5000); } catch (e) { return { status: 'busy', msg: 'Server is busy right now.' }; }
  try {
    var s = scanRows_();
    for (var k = 0; k < s.data.length; k++) if (String(s.data[k][0]) === String(code).trim()) {
      s.sh.getRange(k + 2, 2).setValue('no'); s.sh.getRange(k + 2, 5).clearContent(); s.data[k][1] = 'no'; break;
    }
    return { counts: countsOf_(s.data) };
  } finally { lock.releaseLock(); }
}
