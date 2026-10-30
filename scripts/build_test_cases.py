"""
Builds public/test-cases/: one folder per test case with its documents and a HOW-TO-TEST.md, plus an index.
Reads public/demo/scenarios.json, so run it after generate_fixtures.py.

Run:  python scripts/build_test_cases.py
"""

import json
import os
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEMO = os.path.join(ROOT, "public", "demo")
OUT = os.path.join(ROOT, "public", "test-cases")

ENTITY = {"private_limited": "Private Limited Company", "public_limited": "Public Limited Company",
          "llp": "Limited Liability Partnership", "partnership": "Partnership Firm", "proprietorship": "Sole Proprietorship"}
SLOT = {"incorporation": "Certificate of Incorporation", "gst": "GST Registration Certificate", "pan": "PAN Card",
        "bank_proof": "Cancelled cheque or bank letter", "udyam": "Udyam certificate"}
FIELDS = [("legal_name", "Legal name of business"), ("entity_type", "Entity type"), ("owner_name", "Proprietor / authorised signatory"),
          ("pan", "PAN"), ("gstin", "GSTIN"), ("cin", "CIN"), ("address", "Registered address"), ("city", "City"),
          ("state", "State"), ("pincode", "PIN code"), ("contact_name", "Contact person"), ("contact_email", "Contact email"),
          ("contact_phone", "Phone"), ("category", "What you supply"), ("bank_account_holder", "Account holder name"),
          ("bank_account_number", "Account number"), ("bank_ifsc", "IFSC"), ("bank_name", "Bank name"),
          ("msme_registered", "MSME (Udyam) registered?"), ("udyam_number", "Udyam number"), ("msme_category", "MSME category")]

PORTAL = ("**Submit on the vendor portal** (`/apply`).\n\n"
          "- **Quick way:** open *Demo: fill this form with a test vendor* → pick **{title}**. It fills every field and attaches the documents. Then press **Submit application**.\n"
          "- **By hand:** type the values below and attach the files in this folder.")

# (folder, scenario id, kind, channel, what it proves, what to do, expected, what to look at)
CASES = [
    ("E1-shared-bank-account", "meridian", "edge", "portal",
     "Payment-diversion fraud: the bank account already belongs to a different, approved company (Apex Facility Services).",
     None, "**Rejected** automatically: *Bank account used by another vendor*.",
     "Open the vendor → the red check shows the other company, its PAN and vendor ID. No email is sent: rejections go through a person."),
    ("E2-sister-company-gst", "northstar", "edge", "portal",
     "Every field is valid on its own, but the GST certificate belongs to a sister company with a near-identical name (Solutions vs Supplies) and a different PAN.",
     None, "**Needs your decision**: *GSTIN belongs to another company* and *Company name doesn't match documents*.",
     "The review page shows the form value next to what the GST certificate says, with the document highlighted."),
    ("E3-doctored-cheque", "lakshmi", "edge", "portal",
     "Tampering: the cheque prints HDFC Bank, but its IFSC belongs to ICICI Bank, and the image was saved from Photoshop.",
     None, "**Needs your decision**: *Cheque bank ≠ IFSC bank* and *Document edited in image software*.",
     "The live IFSC lookup names the real bank; the file's metadata names the editing software."),
    ("E4-wrong-document", "kaveri", "edge", "portal",
     "The vendor put their GST certificate in the bank-proof slot. AI recognises the document type and asks for the right one.",
     "After the run, open the link in the request email (or the vendor's page) and upload `resubmission/Kaveri_Cancelled_Cheque.png` from this folder as the bank proof.",
     "**Waiting for vendor** → after you upload the cheque → **Approved**.",
     "Watch the journey tracker on the vendor's page: request sent → resubmitted → re-checked → approved."),
    ("E5-vendor-never-replies", "bluewave", "edge", "portal",
     "The PAN card is missing and the vendor ignores every email. n8n sends reminders, then escalates.",
     "Do nothing after submitting. Reminders arrive every 2 minutes (demo timing).",
     "**Waiting for vendor** → reminder 1 (~2 min) → reminder 2 (~4 min) → flagged **No reply** (~6 min).",
     "*Emails to vendors* lists the request and both reminders; the vendor gets a red *no reply* tag on the overview."),
    ("E6-msme-category-mismatch", "pragati", "edge", "portal",
     "The vendor declares *Micro* enterprise (which legally requires payment within 45 days), but the Udyam certificate says *Medium*.",
     None, "**Needs your decision**: *MSME category doesn't match certificate* (it decides the payment terms).",
     "The review page explains why it matters: MSMED Act s.15 and Income-tax s.43B(h)."),
    ("X1-clean-company-msme", "shreeji", "example", "portal",
     "A complete, consistent private limited company that is a registered Micro enterprise.",
     None, "**Approved**, with the conditions *confirm bank ownership before first payment* and *pay within 45 days (MSME)*.",
     "Open the vendor → *ERP vendor record* shows the vendor code, payment terms 45 days and the MSME tag."),
    ("X2-proprietor", "anjali", "example", "portal",
     "A sole proprietor: the GST certificate's legal name is the owner (Anjali Rao), the trade name is the business. No incorporation certificate is needed.",
     None, "**Approved** under proprietorship rules.",
     "The checks show the proprietor rules: PAN 4th letter *P*, 5th letter = surname initial, owner name matches the PAN card."),
    ("X3-partnership-google-form", "riverside", "example", "google_form",
     "A partnership firm applying through the Google Form. No incorporation certificate is needed for a firm.",
     None, "**Approved**, with a *Google Form* tag on the vendor.",
     "*All vendors* shows the Google Form tag; the checks are exactly the same as on the portal."),
]

EMAIL_CASES = [
    ("X4-email-then-confirm", "email-lokseva", "lokseva",
     "A vendor who only emails documents (no cheque). The app reads the attachments, builds the application, then the vendor confirms the details and adds the cheque through a link.",
     "1. From any email account, send **one email** to the onboarding inbox (acmevendoronboarding@gmail.com) with subject `Vendor registration - Lokseva Pashukhadya` and attach the **4 files** in this folder (not the `reply` folder). A short message like *\"We are a registered MSME (Small). Sandeep Gaikwad, +91 98221 40576\"* helps.\n"
     "2. Within ~1 minute you get *Action needed* email. Open its link.\n"
     "3. Check the pre-filled details, upload `reply/Lokseva_Cancelled_Cheque.png` as the bank proof, and press **Confirm**.",
     "**Waiting for vendor** (confirm + cheque) → after step 3 → **Approved**.",
     "The vendor's *Email* tag; the activity shows *Details filled in from documents* (bank details taken from the cheque)."),
    ("X5-email-reply-with-cheque", "email-sahyadri", "sahyadri",
     "Same as X4, but the vendor sends the cheque by **replying to our email** instead of using the link.",
     "1. Email the **4 files** in this folder to the onboarding inbox, subject `Vendor registration - Sahyadri Castings`.\n"
     "2. When the *Action needed* email arrives, **reply to it** (keep the subject: it contains the `[VEN-…]` reference) and attach `reply/Sahyadri_Cancelled_Cheque.png`.\n"
     "3. The next email asks only to confirm the details: open the link and press **Confirm**.\n\n"
     "Variation: send the cheque as a **new** email (no reference) from the same address — it still joins the same application.",
     "**Waiting for vendor** → reply with cheque → **Waiting** (confirm only) → **Approved**.",
     "Only one email per step, no duplicates; the reminder loop stops as soon as the vendor replies."),
]


def table(form):
    rows = []
    for key, label in FIELDS:
        v = form.get(key, "")
        if key == "entity_type":
            v = ENTITY.get(v, v)
        if key == "msme_registered":
            v = {"yes": "Yes", "no": "No"}.get(v, v or "No")
        if not v:
            continue
        rows.append(f"| {label} | `{v}` |")
    return "| Field | Value |\n|---|---|\n" + "\n".join(rows)


def copy_tree(src, dst):
    for root, _dirs, files in os.walk(src):
        rel = os.path.relpath(root, src)
        os.makedirs(os.path.join(dst, rel), exist_ok=True)
        for f in files:
            if f != "EMAIL.txt":
                shutil.copy2(os.path.join(root, f), os.path.join(dst, rel, f))


def main():
    scenarios = {s["id"]: s for s in json.load(open(os.path.join(DEMO, "scenarios.json"), encoding="utf8"))}
    if os.path.isdir(OUT):
        for root, _dirs, names in os.walk(OUT):
            for n in names:
                os.remove(os.path.join(root, n))
    os.makedirs(OUT, exist_ok=True)
    index = []

    for folder, sid, kind, channel, proves, todo, expected, look in CASES:
        s = scenarios[sid]
        dst = os.path.join(OUT, folder)
        copy_tree(os.path.join(DEMO, sid), dst)
        files = "\n".join(f"- {SLOT[slot]} → `{name}`" for slot, name in s["files"].items())
        if channel == "portal":
            how = PORTAL.format(title=s["title"])
        else:
            how = ("**Submit through the Google Form** (link on the *Become a supplier* page, `/supplier`). "
                   "Choose *Partnership Firm*, *MSME registered: No*, *MSME category: Not applicable*, type the values below and upload the files.")
        md = (f"# {folder.split('-', 1)[0]} · {s['title']}\n\n**Vendor:** {s['vendor']}  \n**Channel:** {'Vendor portal' if channel == 'portal' else 'Google Form'}\n\n"
              f"## What it tests\n{proves}\n\n## How to run it\n{how}\n\n"
              + (f"**Then:** {todo}\n\n" if todo else "")
              + f"## Expected result\n{expected}\n\n## What to look at\n{look}\n\n## Files\n{files}\n\n## Form values\n{table(s['form'])}\n")
        open(os.path.join(dst, "HOW-TO-TEST.md"), "w", encoding="utf8").write(md)
        index.append((folder, kind, s["vendor"], "Portal" if channel == "portal" else "Google Form", expected))

    for folder, sid, vendor_key, proves, steps, expected, look in EMAIL_CASES:
        s = scenarios[sid]
        dst = os.path.join(OUT, folder)
        copy_tree(os.path.join(DEMO, sid), dst)
        md = (f"# {folder.split('-', 1)[0]} · {s['title']}\n\n**Vendor:** {s['vendor']}  \n**Channel:** Email\n\n"
              f"## What it tests\n{proves}\n\n## How to run it\n{steps}\n\n## Expected result\n{expected}\n\n## What to look at\n{look}\n\n"
              f"## Files\n" + "\n".join(f"- `{f}`" for f in s.get("email_files", [])) + f"\n- `{s['resubmission']['reply']}` (send later)\n")
        open(os.path.join(dst, "HOW-TO-TEST.md"), "w", encoding="utf8").write(md)
        index.append((folder, "example", s["vendor"], "Email", expected))

    rows = lambda k: "\n".join(f"| [{f}](./{f}/HOW-TO-TEST.md) | {v} | {c} | {e} |" for f, kind, v, c, e in index if kind == k)
    readme = f"""# VendorIQ test cases

Each folder holds the documents for one vendor and a **HOW-TO-TEST.md** with the steps, the values to type and the expected result.
All companies, IDs and account numbers are fictional; IFSC and PIN codes are real so the live lookups work.

**Before you start**
- **Use your own email address as the contact email** (on the portal: *Send the vendor emails to*, in the Google Form: *Contact email*; for email cases you send from your own account anyway). Emails go to the address on the application, and the fictional addresses in these files may belong to real domains.
- Run each vendor **once**. Submitting the same vendor again is caught as *May already be a vendor* — a valid test of duplicate detection, but not the result described here.
- Reminders come every 2 minutes (demo timing; 1–2 days in real use).

## Edge cases — things that must be caught

| Case | Vendor | Channel | Expected |
|---|---|---|---|
{rows("edge")}

## Examples to try — normal vendors, every channel

| Case | Vendor | Channel | Expected |
|---|---|---|---|
{rows("example")}

## Already in the system (for context)
Apex Facility Services, Sai Krupa Fabricators, Deccan Agro Equipments and Murugan Electricals (approved), Orion (rejected: cancelled GST)
and Vertex Packaging (waiting: GSTIN typo) are loaded as history. E1 depends on Apex being approved.

To rebuild this folder after changing the fixtures: `python scripts/generate_fixtures.py && python scripts/build_test_cases.py`
"""
    open(os.path.join(OUT, "README.md"), "w", encoding="utf8").write(readme)
    print(f"built {len(index)} test cases in {OUT}")


if __name__ == "__main__":
    main()
