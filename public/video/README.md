# Video kit

Everything needed to record the 5-minute video. Script: [VIDEO-SCRIPT.md](./VIDEO-SCRIPT.md).

| Folder | Used in | Channel | Expected result |
|---|---|---|---|
| `1-happy-path-portal-sutlej` | Part 4 | Supplier portal (Apply) | **Approved**, one condition: bank ownership check |
| `2-edge-case-email-vidarbha` | Part 5 | Email | **Rejected**: bank account already belongs to Apex Facility Services (fraud pattern) |
| `3-edge-case-google-form-utkal` | Part 6 | Google Form | **Waiting for vendor** (GST certificate uploaded in the PAN field), then **Approved** after the PAN card is resubmitted |

Folders already used on the website are in `used/` (they would be caught as existing vendors). Each folder has a `VALUES.md` with the exact text to type. All names, IDs and account numbers are fictional. Each vendor can be run **once**; a second run is caught as "may already be a vendor".

## Before you record (once)
1. Press **Wake up** (top right of Overview). It checks the database, n8n, the Gmail inbox, the Google Form, the AI readers and any stuck emails or runs, and fixes what it can.
2. **Reconnect Gmail in n8n** if it is more than 7 days since you last did (Testing mode expires every 7 days). Wake up reports it if the inbox cannot be read.
3. In Vercel, **delete `EMAIL_OVERRIDE_TO`** and redeploy, so emails go to the contact email on each application.
4. **Use your own email as the contact email** in every case.
5. **Sign in to the Company portal first** in the browser you record with, then open the supplier portal. The "fill this form with a sample vendor" tool on the Apply page only shows to a signed-in company user.
6. Hard-refresh (Ctrl+Shift+R). Browser zoom 100%, light mode, close other tabs.

## Prepare these before pressing record
- **Gmail draft (Part 5):** a new draft to `acmevendoronboarding@gmail.com` with the subject and body from `2-edge-case-email-vidarbha/EMAIL.txt` and the **four** files attached.
- **Google Form (Part 6):** open the live form, fill the text fields using `3-edge-case-google-form-utkal/VALUES.md`, then in the form's three-dot menu choose **Get pre-filled link**, fill the text fields there, copy the link and open it for recording. Uploads cannot be pre-filled, so you attach the four files on camera (or trim the wait in editing). Start from a blank form or a freshly built link, never an old pre-filled one (it carries the previous vendor's address and sends the application to Needs attention). Easiest: run `prefilledLinkUtkal` in the Apps Script and open the link it prints. Remember the PAN field gets `Utkal_Scan_0719.pdf`.
  Live form: https://docs.google.com/forms/d/e/1FAIpQLScKSR6gw7gLbEeBdnJIfayYgipGbyclKOuP7RKfSfRN9_4M8g/viewform
- **Tabs, in order:** Login page, Gmail draft, pre-filled Google Form.

## Tips
- Record in short takes (one per part) and join them. Parts 5 and 6 contain waits, so cut those.
- Speed up the run page (stages ticking) by 1.2x if it feels slow; keep the result screens at normal speed.
- If something goes wrong live, the activity log (All vendors, Activity log tab) shows what actually happened.
