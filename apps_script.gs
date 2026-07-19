/* =====================================================================
   CASRHA FOUNDATION — Certificate Generator
   apps_script.gs   (Google Apps Script backend)

   PURPOSE
   -------
   Receives POST requests from the certificate portal and appends each
   submission as a new row in a Google Sheet.

   SETUP (summary — see README.md for full steps)
   ----------------------------------------------
   1. Create a Google Sheet.
   2. Extensions > Apps Script. Paste this file.
   3. Set SHEET_NAME below if your tab isn't called "Sheet1".
   4. Deploy > New deployment > Web app.
        - Execute as: Me
        - Who has access: Anyone
   5. Copy the /exec URL into GOOGLE_SCRIPT_URL in script.js.
   ===================================================================== */

// Name of the sheet tab that stores submissions.
const SHEET_NAME = "Sheet1";

// Column headers, written automatically on first run.
const HEADERS = [
  "Timestamp",
  "Full Name",
  "Phone Number",
  "Training Batch",
  "Type of Outreach",
  "Target Audience",
  "Participants Reached",
  "Date(s) of Outreach",
  "Venue / Location",
  "Brief Report",
  "End of Training Day",
  "Declaration Confirmed",
  "Certificate Generated",
  "Browser",
  "Device"
];

/**
 * Handle POST requests from the portal.
 */
function doPost(e) {
  try {
    // Parse the JSON body sent by the front end.
    const data = JSON.parse(e.postData.contents);

    const sheet = getSheet_();

    // Build the row in the same order as HEADERS.
    const row = [
      new Date(),                                    // Timestamp
      sanitize_(data.fullName),                      // Full Name
      sanitize_(data.phone),                         // Phone Number
      sanitize_(data.batch),                         // Training Batch
      sanitize_(data.outreachType),                  // Type of Outreach
      sanitize_(data.audience),                      // Target Audience
      sanitize_(data.participants),                  // Participants Reached
      sanitize_(data.outreachDates),                 // Date(s) of Outreach
      sanitize_(data.venue),                         // Venue / Location
      sanitize_(data.report),                        // Brief Report
      sanitize_(data.trainingDate),                  // End of Training Day
      sanitize_(data.declaration) || "YES",          // Declaration Confirmed
      sanitize_(data.certificateGenerated) || "YES", // Certificate Generated
      sanitize_(data.browser),                       // Browser
      sanitize_(data.device)                         // Device
    ];

    sheet.appendRow(row);

    return jsonResponse_({ status: "success" });
  } catch (err) {
    return jsonResponse_({ status: "error", message: String(err) });
  }
}

/**
 * Optional: a GET handler so visiting the URL in a browser confirms it's live.
 */
function doGet() {
  return jsonResponse_({ status: "success", message: "CASRHA certificate logger is running." });
}

/**
 * Get the target sheet, creating it (with headers) if needed.
 */
function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }

  // Write headers if the first row is empty.
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }

  return sheet;
}

/**
 * Basic sanitisation: coerce to string, trim, and strip leading
 * characters that spreadsheets treat as formulas (=, +, -, @).
 */
function sanitize_(value) {
  if (value === undefined || value === null) return "";
  let s = String(value).trim();
  if (/^[=+\-@]/.test(s)) {
    s = "'" + s; // prefix with apostrophe to neutralise formula injection
  }
  return s;
}

/**
 * Return a JSON response with the right MIME type.
 */
function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
