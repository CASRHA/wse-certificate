/* =====================================================================
   CASRHA FOUNDATION — Certificate Generator
   script.js
   Pure front-end. Google Apps Script acts as the backend for logging.
   ===================================================================== */

/* =====================================================================
   CONFIGURATION  —  edit only these values
   ===================================================================== */
const CERTIFICATE_IMAGE = "CERTIFICATE.jpg";           // background image file (case-sensitive on servers)
const ORGANIZATION      = "CASRHA Foundation";

/*
  GOOGLE FORM LOGGING
  -------------------
  Submissions are logged by POSTing to a Google Form's /formResponse endpoint.
  Responses land automatically in the Form's linked Google Sheet — no Apps
  Script or deployment needed. To point at a different form, replace the form
  ID in GOOGLE_FORM_ACTION and update the entry.* IDs below to match its fields.
  (Get entry IDs by loading the form and inspecting FB_PUBLIC_LOAD_DATA_.)
*/
const GOOGLE_FORM_ACTION =
  "https://docs.google.com/forms/d/e/1FAIpQLSfghYtBslN9kUSKazVKvcMu_05Nv_AeF_ursfE9I5rMUKzPwA/formResponse";

// Maps our field keys -> the form's entry.* field IDs.
const FORM_ENTRIES = {
  fullName:      "entry.1476380765",
  phone:         "entry.484879707",
  batch:         "entry.127157678",
  outreachType:  "entry.555933105",
  audience:      "entry.2123919395",
  participants:  "entry.168519932",
  outreachDates: "entry.1524782173",
  venue:         "entry.466149395",
  report:        "entry.873739832",
  trainingDate:  "entry.1522668198",
  declaration:   "entry.2130958736",
  telegramUpload: "entry.1177266440"
};

/*
  TEXT POSITIONS
  --------------
  Positions are expressed as FRACTIONS (0..1) of the certificate image,
  so they scale correctly at any resolution. Tune these if your template
  differs. x = horizontal centre, y = vertical baseline.

  Values below were measured against the supplied WSE certificate
  (2560 x 1809). See README "How to customize text positions".
*/
const TEXT_LAYOUT = {
  name: {
    x: 0.50,          // horizontal centre of the name line
    y: 0.582,         // sits just above the underline
    maxWidthFrac: 0.62, // name is shrunk to fit within this fraction of width
    fontSize: 0.052,  // font size as a fraction of image height
    weight: "bold",
    color: "#111111",
    font: "Georgia, 'Times New Roman', serif"
  },
  date: {
    x: 0.773,         // centred on the date underline (right side)
    y: 0.788,         // sits just above the underline; "DATE" is printed below it
    maxWidthFrac: 0.20,
    fontSize: 0.026,
    weight: "normal",
    color: "#111111",
    font: "Georgia, 'Times New Roman', serif"
  }
};

/* =====================================================================
   STATE
   ===================================================================== */
let certImage = null;          // preloaded Image object
let certImageReady = false;    // becomes true once the background loads
let lastSubmitKey = "";        // for duplicate-submission guard
let lastSubmitTime = 0;

/* =====================================================================
   DOM SHORTCUTS
   ===================================================================== */
const $ = (id) => document.getElementById(id);
const form            = $("certForm");
const fullNameInput   = $("fullName");
const phoneInput      = $("phone");
const batchInput      = $("batch");
const outreachTypeInp = $("outreachType");
const audienceInput   = $("audience");
const participantsInp = $("participants");
const outreachDatesInp = $("outreachDates");
const venueInput      = $("venue");
const reportInput     = $("report");
const telegramUploadInp = $("telegramUpload");
const trainingDateInp = $("trainingDate");
const declarationInp  = $("declaration");
const generateBtn     = $("generateBtn");
const btnSpinner      = $("btnSpinner");
const canvas          = $("certCanvas");
const ctx             = canvas.getContext("2d");
const previewWrapper  = $("previewWrapper");
const previewPlaceholder = $("previewPlaceholder");
const downloadRow     = $("downloadRow");

/* =====================================================================
   INITIALISATION
   ===================================================================== */
document.addEventListener("DOMContentLoaded", () => {
  $("footerYear").textContent = new Date().getFullYear();
  showTodayNigerian();
  preloadCertificate();

  form.addEventListener("submit", handleSubmit);
  fullNameInput.addEventListener("blur", () => {
    fullNameInput.value = cleanName(fullNameInput.value);
  });

  $("downloadPdf").addEventListener("click", downloadPDF);
  $("downloadJpeg").addEventListener("click", downloadJPEG);
});

/* =====================================================================
   Preload the certificate background image
   ===================================================================== */
function preloadCertificate() {
  certImage = new Image();
  // Allow the image to be used on a canvas we later export from.
  certImage.crossOrigin = "anonymous";
  certImage.onload = () => {
    certImageReady = true;
    // Size the canvas to the image's native resolution for crisp output.
    canvas.width = certImage.naturalWidth;
    canvas.height = certImage.naturalHeight;
  };
  certImage.onerror = () => {
    showToast("error", "Image error", "Could not load the certificate template. Check that '" + CERTIFICATE_IMAGE + "' is present.");
  };
  certImage.src = CERTIFICATE_IMAGE;
}

/* =====================================================================
   Display today's date in Nigerian format (DD/MM/YYYY)
   ===================================================================== */
function showTodayNigerian() {
  const now = new Date();
  const opts = { day: "2-digit", month: "long", year: "numeric" };
  // e.g. "08 July 2026"
  $("todayDate").textContent = now.toLocaleDateString("en-GB", opts);
}

/* =====================================================================
   Helpers: clean & format input
   ===================================================================== */

// Trim, collapse inner spaces, and Title-Case each word.
function cleanName(raw) {
  return raw
    .replace(/\s+/g, " ")        // collapse multiple spaces
    .trim()
    .toLowerCase()
    .replace(/\b\p{L}/gu, (ch) => ch.toUpperCase()); // capitalise first letter of each word
}

// Convert a yyyy-mm-dd (from <input type=date>) into "8th July, 2026".
function formatCertificateDate(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dateObj = new Date(y, m - 1, d);
  const monthName = dateObj.toLocaleDateString("en-GB", { month: "long" });
  const day = d;
  const suffix = ordinalSuffix(day);
  return `${day}${suffix} ${monthName}, ${y}`;
}

function ordinalSuffix(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

/* =====================================================================
   FORM SUBMISSION
   ===================================================================== */
async function handleSubmit(event) {
  event.preventDefault();
  form.classList.remove("was-validated");

  // ---- Collect ----
  const name = cleanName(fullNameInput.value);
  fullNameInput.value = name; // reflect cleaned value

  const fields = {
    phone:         phoneInput.value.trim(),
    batch:         batchInput.value.trim(),
    outreachType:  outreachTypeInp.value,
    audience:      audienceInput.value,
    participants:  participantsInp.value.trim(),
    outreachDates: outreachDatesInp.value.trim(),
    venue:         venueInput.value.trim(),
    report:        reportInput.value.trim(),
    // Optional — no validation; defaults to a friendly note when left blank.
    telegramUpload: telegramUploadInp.value || "Not answered"
  };
  const isoDate = trainingDateInp.value;

  // ---- Validate ----
  let valid = true;
  const setInvalid = (el, bad) => {
    el.classList.toggle("is-invalid", bad);
    if (bad) valid = false;
  };

  setInvalid(fullNameInput, !name || name.length < 2);
  setInvalid(phoneInput, fields.phone.length < 6);
  setInvalid(batchInput, !fields.batch);
  setInvalid(outreachTypeInp, !fields.outreachType);
  setInvalid(audienceInput, !fields.audience);
  setInvalid(participantsInp, !(Number(fields.participants) >= 1));
  setInvalid(outreachDatesInp, !fields.outreachDates);
  setInvalid(venueInput, !fields.venue);
  setInvalid(reportInput, !fields.report);
  setInvalid(trainingDateInp, !isoDate);

  // Declaration checkbox (styled separately).
  const declarationOk = declarationInp.checked;
  declarationInp.classList.toggle("is-invalid", !declarationOk);
  document.querySelector(".declaration-error").classList.toggle("d-none", declarationOk);
  if (!declarationOk) valid = false;

  if (!valid) {
    showToast("error", "Missing details", "Please complete all required fields and confirm the declaration.");
    // Scroll to the first invalid field for convenience.
    const firstBad = form.querySelector(".is-invalid");
    if (firstBad) firstBad.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  // ---- Duplicate-submission guard (same name+date within 60s) ----
  const key = (name + "|" + isoDate).toLowerCase();
  const now = Date.now();
  if (key === lastSubmitKey && now - lastSubmitTime < 60000) {
    showToast("info", "Already generated", "You just generated this certificate. Please wait a minute before resubmitting.");
    return;
  }

  if (!certImageReady) {
    showToast("error", "Please wait", "The certificate template is still loading. Try again in a moment.");
    return;
  }

  // ---- Loading state ----
  setLoading(true);

  const certDate = formatCertificateDate(isoDate);

  try {
    // 1) Log the submission to Google Sheets (non-blocking failure).
    await logToSheet({ fullName: name, trainingDate: isoDate, ...fields });

    // 2) Render the certificate onto the canvas.
    renderCertificate(name, certDate);

    // 3) Reveal preview + downloads.
    previewPlaceholder.classList.add("d-none");
    previewWrapper.classList.remove("d-none");
    downloadRow.classList.remove("d-none");

    // 4) Remember for duplicate guard.
    lastSubmitKey = key;
    lastSubmitTime = now;

    showToast("success", "Certificate ready", "Your certificate has been generated. You can download it below.");
  } catch (err) {
    console.error(err);
    showToast("error", "Something went wrong", "We couldn't generate your certificate. Please try again.");
  } finally {
    setLoading(false);
  }
}

function setLoading(isLoading) {
  generateBtn.disabled = isLoading;
  btnSpinner.classList.toggle("d-none", !isLoading);
  generateBtn.querySelector(".btn-label").textContent =
    isLoading ? "Generating..." : "Generate Certificate";
}

/* =====================================================================
   CERTIFICATE RENDERING (HTML5 Canvas)
   ===================================================================== */
function renderCertificate(name, dateText) {
  const W = canvas.width;
  const H = canvas.height;

  // Draw the background at full resolution.
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(certImage, 0, 0, W, H);

  // ---- Draw the NAME ----
  drawFittedText(name.toUpperCase(), TEXT_LAYOUT.name, W, H);

  // ---- Draw the DATE ----
  drawFittedText(dateText, TEXT_LAYOUT.date, W, H);
}

/*
  Draw centred text at a fractional position, shrinking the font if the
  text would exceed its allotted width.
*/
function drawFittedText(text, layout, W, H) {
  let fontPx = Math.round(layout.fontSize * H);
  const maxWidth = layout.maxWidthFrac * W;

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = layout.color;

  // Shrink font until the text fits the allowed width.
  do {
    ctx.font = `${layout.weight} ${fontPx}px ${layout.font}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    fontPx -= 2;
  } while (fontPx > 10);

  ctx.fillText(text, layout.x * W, layout.y * H);
}

/* =====================================================================
   DOWNLOADS
   ===================================================================== */

// Build a safe file name from the participant's name.
function safeFileName(ext) {
  const base = (fullNameInput.value || "certificate")
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "");
  return `CASRHA_Certificate_${base || "participant"}.${ext}`;
}

// JPEG at maximum quality.
function downloadJPEG() {
  try {
    const dataUrl = canvas.toDataURL("image/jpeg", 1.0);
    triggerDownload(dataUrl, safeFileName("jpg"));
    showToast("success", "JPEG downloaded", "Your certificate image has been saved.");
  } catch (err) {
    console.error(err);
    showToast("error", "Download failed", "Could not export JPEG.");
  }
}

// PDF via jsPDF — A4 landscape, image fitted to the page.
function downloadPDF() {
  try {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

    const pageW = pdf.internal.pageSize.getWidth();   // 297mm
    const pageH = pdf.internal.pageSize.getHeight();  // 210mm

    // Fit the certificate (preserving aspect ratio) centred on the page.
    const imgRatio = canvas.width / canvas.height;
    const pageRatio = pageW / pageH;

    let drawW, drawH;
    if (imgRatio > pageRatio) {
      drawW = pageW;
      drawH = pageW / imgRatio;
    } else {
      drawH = pageH;
      drawW = pageH * imgRatio;
    }
    const offsetX = (pageW - drawW) / 2;
    const offsetY = (pageH - drawH) / 2;

    // Use JPEG data at full quality to keep the PDF crisp but reasonably sized.
    const imgData = canvas.toDataURL("image/jpeg", 1.0);
    pdf.addImage(imgData, "JPEG", offsetX, offsetY, drawW, drawH, undefined, "FAST");
    pdf.save(safeFileName("pdf"));

    showToast("success", "PDF downloaded", "Your certificate PDF has been saved.");
  } catch (err) {
    console.error(err);
    showToast("error", "Download failed", "Could not export PDF.");
  }
}

function triggerDownload(dataUrl, filename) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/* =====================================================================
   GOOGLE SHEETS LOGGING (via Google Form)
   ===================================================================== */
async function logToSheet({ fullName, trainingDate, phone, batch, outreachType, audience, participants, outreachDates, venue, report, telegramUpload }) {
  // If the form endpoint isn't configured, skip silently so the app still works.
  if (!GOOGLE_FORM_ACTION || !GOOGLE_FORM_ACTION.includes("/formResponse")) {
    console.warn("GOOGLE_FORM_ACTION is not configured — submission not logged.");
    return;
  }

  const values = {
    fullName:      fullName,
    phone:         phone,
    batch:         batch,
    outreachType:  outreachType,
    audience:      audience,
    participants:  participants,
    outreachDates: outreachDates,
    venue:         venue,
    report:        report,
    telegramUpload: telegramUpload,
    trainingDate:  trainingDate,
    declaration:   "YES"
  };

  // Build application/x-www-form-urlencoded body keyed by the form's entry IDs.
  // Fields with an empty entry ID (not yet on the Google Form) are skipped.
  const body = new URLSearchParams();
  for (const key in FORM_ENTRIES) {
    if (FORM_ENTRIES[key] && values[key] !== undefined) body.append(FORM_ENTRIES[key], values[key]);
  }

  try {
    // 'no-cors' lets us POST to the Google Form without CORS errors.
    // The response is opaque, so we cannot read it — we just fire the log.
    await fetch(GOOGLE_FORM_ACTION, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString()
    });
  } catch (err) {
    // Logging failure should not block certificate generation.
    console.warn("Sheet logging failed:", err);
  }
}

/* =====================================================================
   Lightweight browser / device detection (best effort)
   ===================================================================== */
function getBrowser() {
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\//.test(ua) || /Opera/.test(ua)) return "Opera";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Safari\//.test(ua)) return "Safari";
  return "Unknown";
}

function getDevice() {
  const ua = navigator.userAgent;
  if (/Mobi|Android|iPhone|iPad|iPod/i.test(ua)) {
    if (/iPad|Tablet/i.test(ua)) return "Tablet";
    return "Mobile";
  }
  return "Desktop";
}

/* =====================================================================
   TOAST NOTIFICATIONS
   ===================================================================== */
function showToast(type, title, message) {
  const stack = $("toastStack");
  const toast = document.createElement("div");
  toast.className = `app-toast ${type}`;
  toast.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(message)}</span>`;
  stack.appendChild(toast);

  // Auto-dismiss.
  setTimeout(() => {
    toast.style.transition = "opacity .3s ease, transform .3s ease";
    toast.style.opacity = "0";
    toast.style.transform = "translateX(20px)";
    setTimeout(() => toast.remove(), 300);
  }, 4200);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
