# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

CASRHA Foundation **Certificate Generator** — a static, build-less front-end app
(HTML/CSS/vanilla JS) that renders a certificate onto a `<canvas>`, exports it as PDF/JPEG,
and fire-and-forget logs each submission to a Google Sheet. It runs as plain files on any
static host (cPanel, Netlify, GitHub Pages). The only "backend" is `apps_script.gs`,
deployed separately as a Google Apps Script Web App.

## Running & checking (no build system)

- **Serve over HTTP** — the canvas export requires it; opening as `file://` breaks image
  loading and export:
  ```bash
  python -m http.server 8000    # then open http://localhost:8000
  ```
- No lint or test framework. Syntax-check JS with `node --check script.js`.
- `apps_script.gs` only runs inside Google Apps Script. To syntax-check locally, copy it to
  a temp `.js` file and `node --check` that (the `.gs` extension confuses node's ESM loader).

## Architecture

- **Pure front end.** `script.js` handles everything: canvas rendering, PDF export (jsPDF,
  loaded via CDN in `index.html`), JPEG export, and logging. Bootstrap 5 is CDN-loaded too.
- **CONFIG block** at the top of `script.js`: `CERTIFICATE_IMAGE`, `GOOGLE_SCRIPT_URL`,
  `ORGANIZATION`. These are the only intended edit points for deployment.
- **`TEXT_LAYOUT`** (in `script.js`) positions the name and date using **fractional (0–1)
  coordinates** of the image, so they scale to any template resolution. The canvas is sized
  to the template image's native pixel dimensions for crisp output. Nudge `x`/`y` by ~0.005
  to fine-tune placement; `_guides.jpg` is a positioning reference.
- **The form is an Outreach Report Form.** Many fields are collected and logged to the
  Sheet, but **only `fullName` and `trainingDate` are drawn on the certificate.** The
  certificate date is `#trainingDate` ("End of Training Day"), *not* the outreach dates.
- **Logging is `fetch(GOOGLE_SCRIPT_URL, { mode: "no-cors" })`** — the response is opaque
  and intentionally unread. Logging failures never block certificate generation, and an
  empty `GOOGLE_SCRIPT_URL` skips logging silently so the app still works.
- **`apps_script.gs`** `doPost` parses the JSON body and appends a row. `HEADERS` are
  written automatically **only to an empty tab**. `sanitize_` prefixes `=+-@` values with an
  apostrophe to neutralize spreadsheet formula injection.

## The data contract (key gotcha)

The front-end payload and the backend row are a coupled contract across three files.
**Adding or changing a form field requires three edits, kept in sync:**

1. **`index.html`** — the `<input>`/`<select>` with a unique `id`.
2. **`script.js`** — a `$("id")` DOM reference, validation in `handleSubmit`, and a matching
   key in the `logToSheet` payload.
3. **`apps_script.gs`** — a `HEADERS` entry **and** a matching `sanitize_(data.key)` in the
   `row` array, in the **same column order** as `HEADERS`.

Order matters: the `row` array is positional against `HEADERS`. A mismatch silently writes
values into the wrong columns. Because `HEADERS` only auto-write to an empty tab, changing
columns on an existing Sheet needs a fresh or cleared tab.

`CERTIFICATE_IMAGE` filename is case-sensitive on real servers (works on Windows locally,
may 404 in production).

## Verifying a change

Serve locally and confirm the flow: empty submit blocks and flags fields; the declaration
checkbox must be checked to proceed; a valid submit renders the canvas preview and reveals
the PDF/JPEG download buttons. For a full regression, drive the form headless with
Playwright (the end-to-end pass covers validation, name title-casing, canvas render, and
both downloads).

## Related docs

`README.md` covers end-user setup and deployment (creating the Sheet, deploying the Apps
Script, cPanel upload, tuning text positions). Don't duplicate it here — this file is for
editing the code, the README is for operating the app.
