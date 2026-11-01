# Video kit

Everything needed to record the 5-minute video. Script: [VIDEO-SCRIPT.md](./VIDEO-SCRIPT.md).

| Folder | Used in | Channel | Expected result |
|---|---|---|---|
| `1-happy-path-portal-sundaram` | Part 4 | Supplier portal (Apply) | **Approved**, conditions: bank ownership check, 45-day payment (MSME Small) |
| `2-edge-case-email-himalaya` | Part 5 | Email | **Waiting for vendor** (cheque + confirm details), then **Approved** after the reply |
| `3-edge-case-google-form-bhavani` | Part 6 | Google Form | **Rejected**: GST registration cancelled |
| `5-edge-case-google-form-malabar` | Spare / extra edge | Google Form | **Waiting for vendor** (GST certificate uploaded in the PAN field), then **Approved** after the PAN card is resubmitted |
| `4-edge-case-email-rajputana` | Spare / extra edge | Email | **Waiting for vendor** (confirm details), then **Needs attention**: cheque bank does not match IFSC, edited in Photoshop |

Each folder has a `VALUES.md` with the exact text to type. All names, IDs and account numbers are fictional. These five vendors have never been submitted, so each runs fresh once.

## Before you record (once)
1. Press **Wake up** (top right of Overview). It checks the database, n8n, the Gmail inbox, the Google Form, the AI readers and any stuck emails or runs, and fixes what it can.
2. **Reconnect Gmail in n8n** if it is more than 7 days since you last did (Testing mode expires every 7 days). Wake up reports it if the inbox cannot be read.
3. In Vercel, **delete `EMAIL_OVERRIDE_TO`** and redeploy, so emails go to the contact email on each application.
4. **Use your own email as the contact email** in every case.
5. Each vendor can be run **only once**; a second run is caught as "may already be a vendor". To rehearse, use other vendors from `public/test-cases`.
6. **Sign in to the Company portal first** in the browser you record with, then open the supplier portal. The "fill this form with a sample vendor" tool on the Apply page only shows to a signed-in company user.
7. Hard-refresh (Ctrl+Shift+R). Browser zoom 100%, light mode, close other tabs.

## Prepare these before pressing record
- **Gmail draft (Part 5):** a new draft to `acmevendoronboarding@gmail.com` with the subject and body from `2-edge-case-email-himalaya/EMAIL.txt` and the **four** files attached (not the one in `send-later`). Keep the cheque ready for the reply step.
- **Google Form (Part 6):** open the live form, fill the text fields using `3-edge-case-google-form-bhavani/VALUES.md`, then in the form's three-dot menu choose **Get pre-filled link**, fill the text fields there, copy the link and open it for recording. Uploads cannot be pre-filled, so you attach the four files on camera (or trim the wait in editing).
  Live form: https://docs.google.com/forms/d/e/1FAIpQLScKSR6gw7gLbEeBdnJIfayYgipGbyclKOuP7RKfSfRN9_4M8g/viewform
- **Tabs, in order:** Login page, Gmail draft, pre-filled Google Form.

## Tips
- Record in short takes (one per part) and join them. Parts 5 and 6 contain waits, so cut those.
- Speed up the run page (stages ticking) by 1.2x if it feels slow; keep the result screens at normal speed.
- If something goes wrong live, the activity log (All vendors, Activity log tab) shows what actually happened.
