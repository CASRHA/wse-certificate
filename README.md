# CASRHA Foundation — Certificate Generator

A production-ready, front-end-only web app that lets participants of the
**Wholesome Sex Education** online training instantly generate, preview,
and download their **Certificate of Completion** (PDF or JPEG) — while every
submission is logged to a **Google Sheet** via Google Apps Script.

No server required. It runs as static files (great for cPanel, Netlify,
GitHub Pages, etc.). Google Apps Script is the only "backend".

---

## Files

| File | Purpose |
|------|---------|
| `index.html`     | The portal page (form + live preview). |
| `style.css`      | CASRHA branding (navy + magenta), responsive layout. |
| `script.js`      | Canvas rendering, PDF/JPEG export, Sheets logging. **Edit the CONFIG block here.** |
| `apps_script.gs` | Google Apps Script backend that stores rows in the Sheet. |
| `certificate.jpg`| The certificate background image (your template). |
| `README.md`      | This guide. |

---

## Quick start (local test)

Because the app loads an image onto a canvas and exports it, browsers
require it to be served over **http://**, not opened as a `file://` path.

From this folder, run any static server, e.g.:

```bash
# Python 3
python -m http.server 8000
```

Then open <http://localhost:8000> in your browser and try it.

> Tip: Downloads work locally, but **Sheet logging** only works once you set
> `GOOGLE_SCRIPT_URL` (see below).

---

## 1. Create the Google Sheet

1. Go to <https://sheets.google.com> and create a **new blank spreadsheet**.
2. Name it e.g. `CASRHA Certificate Log`.
3. Leave the default tab as **Sheet1** (or note its name for step 2 below).
   Headers are created automatically on first submission:

   | Timestamp | Full Name | End of Training Day | Certificate Generated | Browser | Device |
   |-----------|-----------|---------------------|-----------------------|---------|--------|

---

## 2. Deploy the Google Apps Script

1. In the Sheet, open **Extensions → Apps Script**.
2. Delete any starter code, then paste the entire contents of **`apps_script.gs`**.
3. If your tab isn't named `Sheet1`, change the `SHEET_NAME` constant at the top.
4. Click **Deploy → New deployment**.
5. Click the gear ⚙ next to "Select type" → choose **Web app**.
6. Set:
   - **Description:** `CASRHA certificate logger`
   - **Execute as:** **Me**
   - **Who has access:** **Anyone**
7. Click **Deploy**, then **Authorize access** and approve the permissions
   (you may need to click "Advanced → Go to project (unsafe)" — this is normal
   for your own scripts).
8. Copy the **Web app URL** — it ends in `/exec`. That's your
   `GOOGLE_SCRIPT_URL`.

To confirm it's live, paste the `/exec` URL into a browser. You should see:

```json
{"status":"success","message":"CASRHA certificate logger is running."}
```

---

## 3. Connect the front end

Open **`script.js`** and edit only the CONFIG block at the very top:

```javascript
const CERTIFICATE_IMAGE = "certificate.jpg";
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycb.../exec"; // ← paste yours
const ORGANIZATION      = "CASRHA Foundation";
```

Save. That's the only wiring needed.

---

## 4. Deploy on cPanel

1. Log in to cPanel → **File Manager**.
2. Go to `public_html` (or the sub-folder for the path
   `/certificate-request`, e.g. `public_html/certificate-request`).
3. Click **Upload** and add all of these files:
   - `index.html`
   - `style.css`
   - `script.js`
   - `certificate.jpg`
4. Make sure `index.html` sits at the folder root so the URL loads it directly.
5. Visit your URL, e.g.
   `https://wse.casrhafoundation.org/certificate-request`.

> If you place the app in a sub-folder, the relative paths (`style.css`,
> `script.js`, `certificate.jpg`) still work because they're all in the same
> folder. No changes needed.

---

## 5. Replace / update the certificate image

- Swap the file named **`certificate.jpg`** with your own, keeping the **same
  file name** — or update `CERTIFICATE_IMAGE` in `script.js` to the new name.
- Use a **high-resolution** export (the supplied template is 2560×1809). The
  canvas automatically matches the image's native resolution for crisp output.

---

## 6. Customize text positions

Positions live in the `TEXT_LAYOUT` object in `script.js`. They are
**fractions of the image** (0–1), so they scale to any resolution.

```javascript
const TEXT_LAYOUT = {
  name: { x: 0.50,  y: 0.577, maxWidthFrac: 0.62, fontSize: 0.052, ... },
  date: { x: 0.792, y: 0.878, maxWidthFrac: 0.24, fontSize: 0.026, ... }
};
```

- `x` — horizontal **centre** (0 = left edge, 1 = right edge).
- `y` — vertical **baseline** of the text (0 = top, 1 = bottom).
- `maxWidthFrac` — text auto-shrinks to stay within this fraction of the width.
- `fontSize` — size as a fraction of image **height**.

**How to fine-tune:** generate a test certificate, and if the name/date is a
little high/low or left/right, nudge the `x`/`y` values by `0.005` at a time
and regenerate.

---

## 7. How to test

1. Open the portal.
2. Enter a **Full Name** and pick an **End of Training Day**.
3. Click **Generate Certificate**.
   - The preview appears with the name and date overlaid.
   - **Download PDF** and **Download JPEG** buttons appear.
4. Check your **Google Sheet** — a new row should appear with the timestamp,
   name, date, "YES", browser, and device.

### Troubleshooting

| Symptom | Fix |
|---------|-----|
| Preview never appears | Confirm `certificate.jpg` is in the same folder and the name matches `CERTIFICATE_IMAGE`. |
| Nothing logged to Sheet | Check `GOOGLE_SCRIPT_URL` is set and ends in `/exec`; re-deploy the Apps Script with access = **Anyone**. |
| Name/date positioned wrong | Adjust `TEXT_LAYOUT` (see section 6). |
| PDF looks blurry | Use a higher-resolution `certificate.jpg`. |

---

## Notes on behaviour

- **Auto-capitalises** names (title case) and strips extra spaces.
- **Blocks duplicate** submissions of the same name+date within 60 seconds.
- Shows **today's date** in Nigerian (DD Month YYYY) format.
- Logging failures never block certificate generation — the participant always
  gets their certificate.

---

## Optional next step — verification (recommended)

Right now anyone can type any name and get a certificate. If you want to only
issue certificates to **approved participants**, add a lookup step:

1. Keep an "Approved" tab in the Sheet with, e.g., participant **email** or
   **ID**.
2. Add that field to the form.
3. Extend `apps_script.gs` with a `doGet`/`doPost` that checks the value
   against the approved list and returns `{ "approved": true/false }`.
4. In `script.js`, call that endpoint **before** rendering, and only render
   when `approved` is true.

Ask and this can be wired up as a follow-up.
