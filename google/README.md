# Google Form intake

Vendors who prefer a Google Form can register there; every submission flows into the same VendorIQ
pipeline (shown with a "Google Form" badge).

## Setup (about 10 minutes)

1. Go to <https://script.google.com>, create a project, paste `apps-script.gs`.
2. Set `VENDORIQ_URL` (`https://<your-app>/api/intake/form`) and `SECRET` (the app's `INTAKE_SHARED_SECRET`).
3. Run `createVendorForm` once and approve the permissions. It creates the form with every text question,
   format validations (PAN, GSTIN, CIN, IFSC, PIN code, Udyam) and the on-submit trigger.
4. Open the form's edit URL (printed in the log) and add five **File upload** questions with these exact titles:
   - `Certificate of Incorporation`
   - `GST Registration Certificate`
   - `PAN Card`
   - `Cancelled cheque or bank letter`
   - `Udyam certificate (if MSME)` (optional)

   Apps Script can't create file-upload questions, so this step is manual.
5. Submit a test response. The application appears in VendorIQ within seconds.

## Notes

- **File uploads require respondents to sign in with a Google account.** The form description should say:
  "No Google account? Email your documents to our onboarding inbox instead."
- Files are saved to the form owner's Drive. The script reads them there, so VendorIQ never needs Drive access.
- Corrections always go through VendorIQ's emailed resubmission link, whichever channel the vendor started on.
