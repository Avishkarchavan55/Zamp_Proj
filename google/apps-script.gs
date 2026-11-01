/**
 * VendorIQ - Google Form intake (Apps Script, free, runs inside Google).
 *
 * 1. Open https://script.google.com → New project → paste this file.
 * 2. Set VENDORIQ_URL and SECRET below (SECRET = the app's INTAKE_SHARED_SECRET).
 * 3. Run createVendorForm() once. It builds the form with all text questions and format validations,
 *    and installs the on-submit trigger. Apps Script cannot create file-upload questions, so add the
 *    five upload questions by hand (titles must match FILE_MAP exactly) - see google/README.md.
 * 4. Each submission is posted to VendorIQ with its files; the files are read straight from Drive here,
 *    so VendorIQ never needs access to your Drive.
 */

const VENDORIQ_URL = "https://REPLACE-WITH-YOUR-APP.vercel.app/api/intake/form";
const SECRET = "REPLACE_WITH_INTAKE_SHARED_SECRET";

const FIELD_MAP = {
  "Legal name of business": "legal_name",
  "Entity type": "entity_type",
  "Proprietor / authorised signatory": "owner_name",
  "PAN": "pan",
  "GSTIN": "gstin",
  "CIN (companies only)": "cin",
  "Registered address": "address",
  "City": "city",
  "State": "state",
  "PIN code": "pincode",
  "Contact person": "contact_name",
  "Contact email": "contact_email",
  "Phone": "contact_phone",
  "What will you supply?": "category",
  "Account holder name": "bank_account_holder",
  "Account number": "bank_account_number",
  "IFSC": "bank_ifsc",
  "Bank name": "bank_name",
  "MSME (Udyam) registered?": "msme_registered",
  "Udyam registration number": "udyam_number",
  "MSME category": "msme_category",
};

const FILE_MAP = {
  "Certificate of Incorporation": "incorporation",
  "GST Registration Certificate": "gst",
  "PAN Card": "pan",
  "Cancelled cheque or bank letter": "bank_proof",
  "Udyam certificate (if MSME)": "udyam",
};

const ENTITY_MAP = {
  "Private Limited Company": "private_limited",
  "Public Limited Company": "public_limited",
  "Limited Liability Partnership": "llp",
  "Partnership Firm": "partnership",
  "Sole Proprietorship": "proprietorship",
};

/**
 * Runs on every submission. Reads the answers and files, posts them to VendorIQ, and retries on trouble.
 * A submission that still fails is remembered and resent by retryFailed() every 5 minutes, so nothing is lost.
 */
function onFormSubmit(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    deliver(e.response);
  } finally {
    lock.releaseLock();
  }
}

function deliver(response) {
  const props = PropertiesService.getScriptProperties();
  const id = response.getId();
  if (props.getProperty("done_" + id)) return console.log("Already delivered " + id);
  const t0 = Date.now();
  const fields = {};
  const files = [];
  response.getItemResponses().forEach(function (r) {
    const title = r.getItem().getTitle();
    const answer = r.getResponse();
    if (FILE_MAP[title]) {
      (Array.isArray(answer) ? answer : [answer]).forEach(function (fileId) {
        const file = DriveApp.getFileById(fileId);
        const blob = file.getBlob();
        files.push({ slot: FILE_MAP[title], name: file.getName(), mime: blob.getContentType(), b64: Utilities.base64Encode(blob.getBytes()) });
      });
    } else if (FIELD_MAP[title]) {
      let value = String(answer || "").trim();
      if (title === "Entity type") value = ENTITY_MAP[value] || value;
      if (title === "MSME (Udyam) registered?") value = value === "Yes" ? "yes" : "no";
      if (title === "MSME category" && value === "Not applicable") value = "";
      fields[FIELD_MAP[title]] = value;
    }
  });
  const payload = JSON.stringify({ fields: fields, files: files, response_id: id, respondent_email: response.getRespondentEmail() });
  const read = Date.now() - t0;

  let code = 0;
  let text = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = UrlFetchApp.fetch(VENDORIQ_URL, {
        method: "post",
        contentType: "application/json",
        headers: { "x-vendoriq-secret": SECRET },
        payload: payload,
        muteHttpExceptions: true,
      });
      code = res.getResponseCode();
      text = res.getContentText();
      if (code < 300) break;
      if (code < 500 && code !== 429) break; // our data is wrong: retrying will not help
    } catch (err) {
      code = 0;
      text = String(err);
    }
    Utilities.sleep(attempt * 2000);
  }
  console.log("VendorIQ responded " + code + " in " + (Date.now() - t0) + " ms (reading files " + read + " ms): " + text);

  const failed = JSON.parse(props.getProperty("failed") || "[]").filter(function (x) { return x !== id; });
  if (code > 0 && code < 300) {
    props.setProperty("done_" + id, "1");
  } else if (code === 0 || code >= 500 || code === 429) {
    failed.push(id);
    console.error("Delivery failed, will retry: " + id);
  }
  props.setProperty("failed", JSON.stringify(failed));
}

/** Resends submissions that failed (server asleep, network). Installed by createVendorForm() and installRetryTrigger(). */
function retryFailed() {
  const props = PropertiesService.getScriptProperties();
  const failed = JSON.parse(props.getProperty("failed") || "[]");
  if (!failed.length) return;
  const form = FormApp.openById(props.getProperty("FORM_ID"));
  failed.forEach(function (id) {
    const response = form.getResponse(id);
    if (response) deliver(response);
  });
}

function installRetryTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === "retryFailed") ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger("retryFailed").timeBased().everyMinutes(5).create();
}

/** Run this once after pasting the script: checks the URL and the secret, and lists the triggers. */
function testConnection() {
  const res = UrlFetchApp.fetch(VENDORIQ_URL, {
    method: "post", contentType: "application/json", headers: { "x-vendoriq-secret": SECRET },
    payload: JSON.stringify({ fields: {} }), muteHttpExceptions: true,
  });
  const code = res.getResponseCode();
  console.log(code === 400 ? "OK: VendorIQ answered and accepted the secret." : code === 401 ? "WRONG SECRET: copy INTAKE_SHARED_SECRET from Vercel." : "Unexpected answer " + code + ": " + res.getContentText());
  console.log("Triggers: " + ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction() + " (" + t.getEventType() + ")"; }).join(", "));
}

/** One-off: builds the form with validations and installs the submit trigger. */
function createVendorForm() {
  const form = FormApp.create("Acme Manufacturing - Supplier registration");
  form.setDescription("Register as a supplier. Your documents are verified automatically; we'll email you if anything is missing.");
  form.setCollectEmail(true);
  const text = function (title, required, pattern, help) {
    const item = form.addTextItem().setTitle(title).setRequired(!!required);
    if (pattern) item.setValidation(FormApp.createTextValidation().requireTextMatchesPattern(pattern).setHelpText(help).build());
    return item;
  };
  text("Legal name of business", true);
  form.addListItem().setTitle("Entity type").setChoiceValues(Object.keys(ENTITY_MAP)).setRequired(true);
  text("Proprietor / authorised signatory", false);
  text("PAN", true, "^[A-Za-z]{5}[0-9]{4}[A-Za-z]$", "PAN looks like AAAAA9999A");
  text("GSTIN", true, "^[0-9]{2}[A-Za-z]{5}[0-9]{4}[A-Za-z][1-9A-Za-z][Zz][0-9A-Za-z]$", "GSTIN is 15 characters, e.g. 27AAAAA9999A1Z5");
  text("CIN (companies only)", false, "^[UuLl][0-9]{5}[A-Za-z]{2}[0-9]{4}[A-Za-z]{3}[0-9]{6}$", "CIN is 21 characters, e.g. U12345MH2019PTC123456");
  text("Registered address", true);
  text("City", true);
  text("State", true);
  text("PIN code", true, "^[1-9][0-9]{5}$", "6-digit PIN code");
  text("Contact person", true);
  text("Contact email", true);
  text("Phone", false);
  text("What will you supply?", false);
  text("Account holder name", true);
  text("Account number", true, "^[0-9 ]{9,20}$", "Digits only");
  text("IFSC", true, "^[A-Za-z]{4}0[A-Za-z0-9]{6}$", "IFSC looks like HDFC0001234");
  text("Bank name", false);
  form.addMultipleChoiceItem().setTitle("MSME (Udyam) registered?").setChoiceValues(["Yes", "No"]).setRequired(true);
  text("Udyam registration number", false, "^UDYAM-[A-Za-z]{2}-[0-9]{2}-[0-9]{7}$", "Format UDYAM-XX-00-0000000");
  form.addListItem().setTitle("MSME category").setChoiceValues(["Micro", "Small", "Medium", "Not applicable"]);
  ScriptApp.newTrigger("onFormSubmit").forForm(form).onFormSubmit().create();
  PropertiesService.getScriptProperties().setProperty("FORM_ID", form.getId());
  installRetryTrigger();
  console.log("Form created: " + form.getEditUrl());
  console.log("Now add these file-upload questions by hand: " + Object.keys(FILE_MAP).join(" | "));
}

/** Testing aid: sends the form's most recent response to VendorIQ again (no need to refill the form). */
function resendLatestResponse() {
  const form = FormApp.openById(PropertiesService.getScriptProperties().getProperty("FORM_ID"));
  const responses = form.getResponses();
  if (!responses.length) return console.log("No responses yet");
  const last = responses[responses.length - 1];
  PropertiesService.getScriptProperties().deleteProperty("done_" + last.getId());
  deliver(last);
}
