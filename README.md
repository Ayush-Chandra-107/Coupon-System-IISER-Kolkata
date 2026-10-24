# Agomoni Coupon System: QR coupons with Google Forms, Sheets & Apps Script

A serverless system for event coupons at IISER Kolkata (built for the **Agomoni** cultural events). Attendees register through a Google Form, receive an emailed QR coupon automatically, and volunteers verify those coupons at the venue with an Android phone camera.

Everything runs on free Google tooling plus one static web page. There is no server to maintain.

> **v2 in one line:** the scanner page now lives on GitHub Pages (not inside Apps Script), because newly created Apps Script web apps block the camera. Apps Script remains the backend and talks to the page as a small JSON API. See [Design notes](#design-notes-and-known-limitations) for why.

---

## Table of contents

1. [What it does](#what-it-does)
2. [How the pieces fit together](#how-the-pieces-fit-together)
3. [Repository contents](#repository-contents)
4. [How a coupon ID works](#how-a-coupon-id-works)
5. [Sheet layouts](#sheet-layouts)
6. [First-time setup](#first-time-setup)
7. [Running the event](#running-the-event)
8. [Reference](#reference)
9. [Every-year checklist](#every-year-checklist)
10. [Troubleshooting](#troubleshooting)
11. [Design notes and known limitations](#design-notes-and-known-limitations)
12. [Security notes](#security-notes)
13. [Customising](#customising)
14. [Upgrading from v1](#upgrading-from-v1)
15. [Acknowledgements and license](#acknowledgements-and-license)

---

## What it does

**Registration side (runs by itself):**

- Collects registrations through a Google Form.
- Validates every response (empty fields, malformed or wrong-domain email, malformed UTR, non-positive amount).
- Emails each valid attendee an HTML coupon containing a unique QR code.
- Records **why** a row failed, in colour-coded `QR Status` / `QR Detail` columns, and emails the organiser on every failure.
- Copies each response into a per-batch sheet (for example `22MS`), created automatically.
- Provides an **Agomoni** menu in the sheet to resend, retry failures, summarise statuses and detect bounced emails.

**Event side (volunteers' Android phones):**

- A mobile-first scanner page: big camera view, full-screen colour-coded results, torch, scan log and a live `scanned / total` counter.
- Start/Stop camera button, an **Undo last scan** button, an **Undo scan** button on every success popup, and a **Type ID** fallback for damaged QR codes.
- A "Verifying…" screen as soon as a QR is read, so volunteers can lower the phone while the server works.
- Safe with several phones at once: a server-side lock means two phones can never both succeed on the same coupon.

---

## How the pieces fit together

```
 Volunteers
    │ fills in
    ▼
 Google Form ───────▶ Sheet "Form Responses 1"
                              │  installable trigger: onFormSubmit
                              ▼
                  qr_generate_mail.gs   (Apps Script bound to the sheet)
        validate ▶ send HTML mail with QR ▶ write row in "Scan" ▶ copy to batch sheet
                              │
                              ▼
                        Sheet "Scan"  ◀──────────────┐
                                                     │ reads/writes
                                       qr_code_scan.gs  (same Apps Script project,
                                       deployed as a web app = JSON API)
                                                     ▲
                                                     │ HTTPS GET  ?action=verify&code=…&key=…
                                                     │
                       scanner.html  (hosted on GitHub Pages, runs in the volunteer's
                       Android Chrome, owns the camera)
```

The two Apps Script files live in **one** project (they share the `CFG` settings object). `scanner.html` is **not** added to Apps Script; it is served by GitHub Pages.

---

## Repository contents

| File | Where it runs | Purpose |
|---|---|---|
| `qr_generate_mail.gs` | Apps Script (bound to the response sheet) | Validation, QR email, `Scan` sheet rows, batch sheets, **Agomoni** menu, bounce scanner |
| `qr_code_scan.gs` | Same Apps Script project | The scanner backend: JSON API with `verify`, `undo` and `counts` actions |
| `scanner.html` | GitHub Pages (static hosting) | The volunteer-facing scanner UI |
| `index.html` | GitHub Pages | Forwards the site root to `scanner.html`, keeping the `?api=…&key=…` part |
| `README.md` | n/a | This document |
| `LICENSE.txt` | n/a | MIT license |

---

## How a coupon ID works

Every coupon has an ID of the form:

```
<UTR>no.<row>        example: 5511no.2
```

`<row>` is the row number of the response in `Form Responses 1`. The ID is what the QR code encodes and what the scanner looks up.

Why include the row number?

- **It is always unique**, even if two people type the same UTR, so two coupons can never collide.
- **The `Scan` sheet row equals the response row**, which makes lookups and resends simple.

Consequences you should know about:

- **Never delete, insert or sort rows** in `Form Responses 1` after coupons are sent. Row numbers are part of issued IDs. To remove someone, clear their cells or set their food preference to `No food`. Hiding rows or using a filter view is fine.
- A duplicate UTR is **not flagged or blocked**. Only an *already issued ID* stops a send (this protects against the trigger firing twice for the same row).

---

## Sheet layouts

### `Form Responses 1` (created by Google Forms)

The script reads these **column numbers**. They must match your form (see [Customising](#customising) if they do not):

| Col | Field | Used for |
|---|---|---|
| A | Timestamp | matching the row in batch sheets |
| B | Email Address (Google-collected) | not used |
| C | Name | greeting in the email |
| D | Batch | batch sheet name, e.g. `22MS` |
| E | IISER-K email id | **recipient of the coupon** |
| F | Amount | printed on the coupon |
| G | UTR No. | part of the coupon ID |
| H | Food Preference | `Veg` / `Non-veg` / `No food` (or just `Food` / `No food`, see [Food options](#food-options-vegnon-veg-or-just-food)) |
| I | Volunteer name | not used |
| J, K, L | `QR Status`, `QR Detail`, `QR Updated` | **added automatically** the first time the script runs |

The value matching `CFG.NO_FOOD` (default `No food`, case-insensitive) means **no coupon**. For every other value, the scanner shows Veg or Non-veg (any value containing "non" is non-veg) when `CFG.VEG_SPLIT` is `true`, or a single **FOOD** screen when it is `false`. See [Food options](#food-options-vegnon-veg-or-just-food).

### `Scan` (created automatically)

| Col | Content | Written by |
|---|---|---|
| A | Coupon ID | mail script |
| B | `no` / `yes` (scanned?) | mail script (`no`), scanner (`yes`) |
| C | Food preference | mail script |
| D | Name | mail script |
| E | Time scanned | scanner |
| F | Batch | mail script |

Row 1 is ignored by the code, so use it for headers. Data starts at row 2, aligned with the response rows.

### Batch sheets (created automatically)

One sheet per distinct value in the Batch column, holding a copy of each response. Resending a response updates its existing row instead of adding a duplicate.

---

## First-time setup

You will need: a Google account to own the Form/Sheet/script, and a GitHub account for hosting. The instructions assume the repository `Ayush-Chandra-107/Coupon-System-IISER-Kolkata`; adapt the URLs if you fork it.

### Step 1: Create the Google Form

1. Create a Form and add the fields: **Name, Batch, IISER-K email id, Amount, UTR No., Food Preference** (multiple choice: `Veg`, `Non-veg`, `No food`, or just `Food` and `No food`; see [Food options](#food-options-vegnon-veg-or-just-food)).
2. Responses tab → **Link to Sheets** → create a new spreadsheet.
3. Check the column order against the [table above](#form-responses-1-created-by-google-forms). The first sheet must be named `Form Responses 1` (the default).

### Step 2: The `Scan` sheet (nothing to do)

The script creates a sheet named **`Scan`** (with a bold, frozen header row) the first time it is needed: on the first coupon email, or the first scanner request. You can create it yourself beforehand if you prefer; just keep the name and column order from the [table above](#scan-created-automatically).

### Step 3: Add the two Apps Script files

1. In the spreadsheet: **Extensions → Apps Script**.
2. Create two script files and paste in this repo's code:
   - `qr_generate_mail` ← contents of `qr_generate_mail.gs`
   - `qr_code_scan` ← contents of `qr_code_scan.gs`
3. **Do not** add `scanner.html` to this project.

### Step 4: Edit the settings

At the top of `qr_generate_mail.gs`:

```js
var CFG = {
  RESP: 'Form Responses 1',
  SCAN: 'Scan',
  COL: { NAME: 3, BATCH: 4, EMAIL: 5, AMT: 6, UTR: 7, PREF: 8 },
  DOMAIN: 'iiserkol.ac.in',      // '' accepts any email domain
  UTR_RE: /^[A-Za-z0-9]{4,22}$/, // what counts as a valid UTR
  ORGANISER: 'you@example.com',  // receives failure + bounce emails; '' turns this off
  VEG_SPLIT: true,               // true: Veg / Non-veg screens; false: one FOOD screen
  NO_FOOD: 'No food',            // the form option that means "no coupon"
  SUBJECT: "Your coupon subject line"
};
```

Also edit the event text, dates and image links inside `mailBody_()` at the bottom of the file.

At the top of `qr_code_scan.gs`, set a secret of your own:

```js
var API_KEY = 'a-long-random-string';
```

> The repository is public. **Never commit your real `API_KEY`.** Keep the placeholder in the repo and put the real value only in your Apps Script project.

### Step 5: Add the form-submit trigger

1. Apps Script editor → **Triggers** (clock icon) → **Add Trigger**.
2. Function: `onFormSubmit`. Event source: **From spreadsheet**. Event type: **On form submit**. Save and grant permissions.

`onOpen` (which builds the **Agomoni** menu) runs automatically and needs no trigger. Reload the spreadsheet once to see the menu.

### Step 6: Deploy the backend

1. **Deploy → New deployment → Web app**.
2. **Execute as:** *Me*.
3. **Who has access:** **Anyone**.
4. Deploy and copy the **`/exec` URL**.

"Anyone" is required. The page on GitHub Pages calls this URL with `fetch()`; an "Anyone within the organisation" setting makes Google redirect the request to a sign-in page, which the browser blocks. The `API_KEY` is what protects the endpoint, and "Anyone" does not expose your spreadsheet.

Quick test: open `YOUR_EXEC_URL?action=counts&key=YOUR_API_KEY` in a browser. You should see JSON such as `{"total":0,"scanned":0}`. `{"status":"error","msg":"Bad key"}` means the key does not match.

**Whenever you change the script**, update the existing deployment: **Deploy → Manage deployments → pencil → Version: New version → Deploy**. This keeps the same `/exec` URL.

### Step 7: Host the scanner on GitHub Pages

1. Put `scanner.html` and `index.html` in the root of this repository (already done if you use this repo).
2. **Settings → Pages → Build and deployment → Source: Deploy from a branch → `main` / `/ (root)` → Save.**
3. After a minute the page is live at:

   ```
   https://ayush-chandra-107.github.io/Coupon-System-IISER-Kolkata/scanner.html
   ```

The site root (`https://ayush-chandra-107.github.io/Coupon-System-IISER-Kolkata/`) forwards to `scanner.html` via `index.html` and keeps any `?api=…&key=…` part, so either link works. Without `index.html`, GitHub Pages would show this README at the root instead.

The page contains no secrets. The per-year URL and key are supplied through the link you give volunteers.

### Step 8: Build the volunteer link

```
https://ayush-chandra-107.github.io/Coupon-System-IISER-Kolkata/scanner.html?api=<EXEC_URL>&key=<API_KEY>
```

Example (placeholders):

```
https://ayush-chandra-107.github.io/Coupon-System-IISER-Kolkata/scanner.html?api=https://script.google.com/a/macros/iiserkol.ac.in/s/AKfycb.../exec&key=a-long-random-string
```

The first time a phone opens this link, the page saves both values in that browser's local storage and removes them from the address bar. Later visits to the plain page URL keep working. A phone that opens the page without the link is shown a setup form instead, where both values can be pasted. The ⚙ button in the header reopens it at any time.

Tip: turn the link into a QR code and print it for the volunteers' table, or share it in a private group.

### Step 9: Test end to end

1. Submit the Form with your own details.
2. Check the email and the `QR Status` column (should say `SENT`).
3. On an Android phone, open the volunteer link in **Chrome**, tap **Start camera**, allow the camera and scan the QR from the email.
4. You should see a green (Veg or Food) or orange (Non-veg) screen. Scan again: you should see a red **ALREADY USED**.
5. Tap **Undo last scan** to reset that coupon for the next test.

---

## Running the event

### Volunteers: using the scanner

| What you see | Meaning | What to do |
|---|---|---|
| Header counter `37 / 120` | coupons scanned / issued | nothing |
| **Start camera** | camera is off | tap it; allow camera access the first time |
| Grey spinner **Verifying…** | QR was read, server is checking | you may lower the phone; wait |
| Green **VEG** or **FOOD** (auto-closes after 2.5 s) | valid coupon, vegetarian (or any food when the event has no veg/non-veg split) | serve food |
| Orange **NON-VEG** (auto-closes after 2.5 s) | valid coupon, non-vegetarian | serve non-veg |
| Red **ALREADY USED** (shows the time) | coupon was scanned before | do not serve; tap **Next** |
| Grey **NOT FOUND** | ID unknown | check the ID or ask an organiser; tap **Next** |
| Grey **SERVER BUSY** | another scan held the lock too long | scan again; tap **Next** |
| Grey **TRY AGAIN** | server did not answer after two tries | scan again; tap **Next** |

Buttons:

- **Start camera / Stop camera**: toggle the camera. Stopping releases the camera and saves battery between rush periods.
- **Undo last scan**: reverses the most recent *successful* scan, even after its popup closed.
- **Undo scan** (on the green/orange popup): reverses the scan being shown.
- **Torch**: appears if the phone supports it.
- **Type ID**: enter an ID by hand, for example `5511no.2`.
- **⚙**: change the event configuration.

While any full-screen result or the "Verifying…" screen is showing, **no new scan is accepted**. Success popups close themselves; every other result stays until **Next** is tapped, so problems are never missed.

**Tip: If you see  any kind of error on the first try to scan, and see "already scanned" on the next try on the same coupon, let the person pass through**


### Organisers: the Agomoni menu

In the response sheet, **Agomoni** provides:

| Item | What it does |
|---|---|
| Resend selected rows | Re-processes the selected rows even if already sent. Fix the bad cell first. |
| Retry all failed rows | Re-processes every row whose status is a failure. Skips `SENT`, `NO_FOOD` and `BOUNCED` (fix a bounced email, then use *Resend selected rows*). |
| Status summary | Counts of each status. |
| Check for bounced mails now | Scans Gmail for bounce notices and marks the matching rows `BOUNCED`. |
| Turn on automatic bounce check | Runs the bounce scan every 15 minutes. |

**Fixing a row:** correct the cell (email, UTR…), select the row, then **Agomoni → Resend selected rows**.

- If the **UTR is unchanged**, the coupon ID is unchanged: the same QR is re-sent and its scanned state is kept.
- If the **UTR changed**, the ID changes: the old QR stops working (it becomes NOT FOUND) and the new one starts unscanned.

---

## Reference

### Mail statuses (`QR Status` column)

| Status | Meaning | Typical fix |
|---|---|---|
| `SENT` | Email sent, `Scan` row written | none |
| `NO_FOOD` | Food preference is `No food`; no coupon needed | none |
| `MISSING_FIELD` | A required cell is empty (detail lists which) | fill it, resend |
| `INVALID_EMAIL` | Not a valid address, or not in `CFG.DOMAIN` | correct it, resend |
| `INVALID_UTR` | UTR fails `CFG.UTR_RE` | correct it, resend |
| `INVALID_AMOUNT` | Amount is not a positive number | correct it, resend |
| `QUOTA_EXCEEDED` | Daily Apps Script mail quota used up | wait for reset, then *Retry all failed rows* |
| `MAIL_FAILED` | `MailApp` raised an error (detail has the message) | read the detail, resend |
| `BOUNCED` | A bounce notice arrived for this address | correct the email, *Resend selected rows* |

When the automatic trigger sees that the coupon ID was already issued, it skips the row silently (no mail, nothing written). Manual resends bypass that check.

### Scanner API

All calls are `GET` requests to the deployed `/exec` URL with query parameters:

| Parameter | Used by | Meaning |
|---|---|---|
| `action` | all | `verify`, `undo` or `counts` |
| `key` | all | must equal `API_KEY` |
| `code` | `verify`, `undo` | the coupon ID |

Responses are JSON:

```jsonc
// action=counts
{ "total": 120, "scanned": 37 }

// action=verify, first valid scan
{ "status": "ok", "kind": "veg", "name": "…", "batch": "22MS", "msg": "Veg", "counts": { "total": 120, "scanned": 38 } }

// action=verify, already scanned
{ "status": "used", "kind": "veg", "name": "…", "batch": "22MS", "msg": "Scanned at 01:12 PM", "counts": { … } }

// `kind` is "veg" or "nonveg" when CFG.VEG_SPLIT is true, otherwise always "food"

// other statuses
{ "status": "unknown", "msg": "No such coupon…", "counts": { … } }
{ "status": "busy",    "msg": "Server is busy with another scan right now." }
{ "status": "error",   "msg": "Bad key" }            // or "Unknown action"

// action=undo
{ "counts": { "total": 120, "scanned": 37 } }
```

### Timings (in `scanner.html` and `qr_code_scan.gs`)

| Value | Where |
|---|---|
| Same QR ignored for 4 s after a scan | `onScan()` in `scanner.html` |
| Success popup auto-closes after 2.5 s | `show()` in `scanner.html` |
| Request timeout 15 s | `apiOnce()` in `scanner.html` |
| Lock wait 5 s | `verifyCoupon()` / `undoScan()` in `qr_code_scan.gs` |
| Scan log keeps the last 25 entries | `addLog()` in `scanner.html` |

---

## Every-year checklist

The scanner page itself **never changes**. Each year:

1. Create a new Form and linked spreadsheet (or copy last year's).
2. *(The `Scan` sheet creates itself.)*
3. Add the two `.gs` files; update `CFG` (organiser email, subject, domain, columns if needed) and the email text in `mailBody_()`.
4. Set a **fresh `API_KEY`**.
5. Add the `onFormSubmit` trigger.
6. Deploy as a web app (*Execute as: Me*, *Anyone*) and copy the new `/exec` URL.
7. Build the new volunteer link with the new URL and key.
8. Test end to end with a few dummy registrations, then delete those test rows from **`Form Responses 1`, `Scan` and the batch sheets** *before* opening the Form to the public (row numbers are part of coupon IDs, so never delete rows once real coupons exist).
9. Optionally run **Agomoni → Turn on automatic bounce check**.
10. On the day, share the link; after the event, turn off the bounce trigger if you wish.

---

## Troubleshooting

### Scanner

| Symptom | Likely cause | Fix |
|---|---|---|
| Black camera area, no permission prompt | Page opened inside another app's browser (Gmail, WhatsApp…) | Open the link in **Chrome** |
| `NotAllowedError: Permission denied` | Camera blocked for the site, or Chrome has no camera permission | Chrome lock icon → Permissions → Camera → Allow; also Android Settings → Apps → Chrome → Permissions → Camera. Reload. |
| `Permissions policy violation: camera is not allowed in this document` | The page is being served by Apps Script | Use the GitHub Pages URL, not the `/exec` URL |
| Setup form appears | No saved config on this phone | Open the volunteer link, or paste URL + key |
| `Bad key` | Key in the link ≠ `API_KEY` in the script | Rebuild the link; redeploy the script as a **new version** after editing the key |
| Setup says "server didn't respond correctly" | Wrong URL, or deployment access is not **Anyone** | Check Step 6; test `…/exec?action=counts&key=…` in a browser |
| **SERVER BUSY** | Another request (often a bulk resend) held the lock for over 5 s | Scan again; avoid bulk menu actions during the event |
| **TRY AGAIN** after a scan | Phone lost connection | Scan again; if the sheet already shows `yes`, see the note below |
| Old behaviour after an update | Cached copy of the page | Hard-refresh or open in a private tab |

If a response is lost after the server already recorded a scan, the page re-checks once. If the recheck says "used", it shows **success** (see [design notes](#design-notes-and-known-limitations)).

### Mailing

| Symptom | Cause | Fix |
|---|---|---|
| No email and the `QR Status` column is empty | Trigger missing or not authorised | Re-create the `onFormSubmit` trigger; run once manually to authorise |
| `QR Status` columns not present | Script has not run yet | Submit a response or run **Agomoni → Status summary** |
| Menu **Agomoni** missing | Spreadsheet not reloaded after adding the script | Reload the sheet |
| Email arrives but QR image is blank | The QR image is loaded from `quickchart.io` when the email is opened | Check connectivity; see limitations |
| A "sent" email never arrived | Mistyped address that bounced late | Run **Check for bounced mails now** |

---

## Design notes and known limitations

**Why the scanner is hosted outside Apps Script.** Apps Script always serves web-app pages inside Google's own frame. In 2026, newly created deployments began blocking camera access there, raising `Permissions policy violation: camera is not allowed in this document` in the browser console. In our testing a 2025 deployment kept working, but relying on that is fragile; a [Google developer forum thread](https://discuss.google.dev/t/camera-permission-in-web-app/333827) describes the same problem. Serving the page from GitHub Pages sidesteps the restriction entirely, and as a bonus the page never has to be copied between Apps Script projects.

**One lock for all scans.** `verifyCoupon` and `undoScan` take Apps Script's script-wide lock. This is what guarantees two phones cannot both accept the same coupon, and it also means scans from all phones are processed one at a time. If the lock cannot be obtained within 5 seconds the scan returns `busy` instead of failing. The mail functions use the same lock, so **do not run bulk "Resend/Retry" actions while volunteers are scanning**.

**Retry-after-failure shows success.** If the first `verify` request fails (timeout or network error), the page asks once more. A "used" answer on that second request almost certainly means the first request did succeed but its reply was lost, so the page presents it as a normal success. This assumes two different volunteers do not scan the *same* QR at the same moment, which is true at a physical venue. A "used" answer on a *first* attempt is always shown as **ALREADY USED**.

**Undo is unauthenticated per user.** Anyone with the link can undo a scan. This is deliberate (volunteers make mistakes) but means the link should be shared only with volunteers.

**External dependencies.** The page loads `html5-qrcode` from unpkg, and emails load their QR images from `quickchart.io` and their artwork from Google Drive / Gmail signature URLs. If any of these is unreachable or expires, the corresponding part stops working. For more resilience, copy `html5-qrcode.min.js` into the repository and reference it locally, and host email images somewhere permanent.

**Quotas.** `MailApp` has a daily recipient limit that depends on the account type. The script checks `MailApp.getRemainingDailyQuota()` before each send and records `QUOTA_EXCEEDED`. See the [Apps Script quotas page](https://developers.google.com/apps-script/guides/services/quotas) for current numbers.

**Bounce detection is best-effort.** It reads notices from `mailer-daemon` / `postmaster` in the sending account's Gmail from the last 14 days. Servers that never send a bounce, or send one very late, cannot be detected.

---

## Security notes

- The `API_KEY` is a shared secret, sent in the URL's query string. Anyone holding the `/exec` URL plus the key can verify or undo coupons and read the name and batch attached to a valid ID. Share the link only with volunteers and use a new key every year.
- The page removes `api` and `key` from the address bar after saving them, but they remain in that browser's local storage. Clear site data on shared or lost devices.
- "Who has access: Anyone" lets anyone *reach* the endpoint; without the key they only get `Bad key`. It does **not** expose the spreadsheet, because the script runs as its owner and only returns what the API returns.
- The repository is public: keep the placeholder `API_KEY` in the committed code, and do not commit spreadsheets or real links containing a key.

---

## Customising

- **Different form layout:** change the numbers in `CFG.COL` to the new column positions (1 = column A).
- **Accept any email domain:** set `CFG.DOMAIN = ''`.
- **UTR rules:** edit `CFG.UTR_RE`. For example `/^\d{4}$/` accepts exactly four digits.
- **Email wording, event name, dates, images:** edit `CFG.SUBJECT` and the HTML in `mailBody_()`.
- **Veg/non-veg or just food:** one setting, see [Food options](#food-options-vegnon-veg-or-just-food) below.
- **Other food categories:** extend `kindOf_()` in `qr_code_scan.gs` to return a new kind, and add a matching entry to the `THEME` table in `scanner.html`.
- **Scanner colours and wording:** the CSS variables at the top of `scanner.html` (`--veg`, `--nonveg`, `--used`, `--turmeric`…) and the `THEME` table in the script.
- **Timings:** see the [timings table](#timings-in-scannerhtml-and-qr_code_scangs).


### Food options: veg/non-veg or just food

The same system supports both kinds of form. Switching takes about a minute:

| | Veg / Non-veg / No food | Food / No food |
|---|---|---|
| Form options | `Veg`, `Non-veg`, `No food` | `Food`, `No food` |
| `CFG.VEG_SPLIT` | `true` | `false` |
| Scan screens | green **VEG**, orange **NON-VEG** | green **FOOD** |

To switch:

1. In `qr_generate_mail.gs`, set `VEG_SPLIT: false` (or `true`). If your "no coupon" option is not literally `No food`, set `NO_FOOD` to its exact label.
2. Deploy the script as a **new version** (**Deploy → Manage deployments → pencil → New version**).

That is all: the scanner page decides what to show from the `kind` the backend returns, so `scanner.html` and the volunteer link do not change. Coupons that were already issued follow the new setting when scanned, because the choice is made at scan time.

---

## Upgrading from v1

v1 served the scanner from Apps Script (`doGet` returning `scanner.html`) and used `google.script.run`. To upgrade an existing project:

1. Replace both `.gs` files with the versions in this repo (the mail file is now `qr_generate_mail.gs`; the old `qr_gnerate+mail.gs` is removed).
2. **Delete `scanner.html` from the Apps Script project** (the new `doGet` no longer references it).
3. Set `API_KEY` and, in `qr_generate_mail.gs`, review `CFG`.
4. Redeploy: **Manage deployments → pencil → New version**.
5. Host `scanner.html` on GitHub Pages and give volunteers the new link ([Steps 7–8](#step-7-host-the-scanner-on-github-pages)).

What changed:

| Area | v1 | v2 |
|---|---|---|
| Scanner hosting | Apps Script web app | GitHub Pages; Apps Script is a JSON API |
| Mail failures | Silent | Reasoned statuses, colours and organiser emails |
| Fixing mistakes | Manual edits | **Agomoni** menu: resend, retry, summary |
| Bounces | Not detected | Bounce scanner |
| Submitted row | Always the last row | The row that was actually submitted |
| Concurrency | None | Script lock on submit, verify and undo |
| Scanner UI | Small desktop-style layout | Full-screen results, spinner, Start/Stop, Undo, torch, counter, log |
| Yearly maintenance | Copy code, redeploy | Make a new link |

---

## Acknowledgements and license

- QR scanning in the browser uses [**html5-qrcode**](https://github.com/mebjas/html5-qrcode) by Minhaz Palasara (mebjas).
- QR images in emails are generated with [QuickChart](https://quickchart.io).
- Released under the **MIT License**; see [LICENSE.txt](LICENSE.txt).
