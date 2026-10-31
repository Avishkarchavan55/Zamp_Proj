# X5 · Email intake (no portal)

**Vendor:** Sahyadri Castings Private Limited  
**Channel:** Email

## What it tests
Same as X4, but the vendor sends the cheque by **replying to our email** instead of using the link.

## How to run it
1. Email the **4 files** in this folder to the onboarding inbox, subject `Vendor registration - Sahyadri Castings`.
2. When the *Action needed* email arrives, **reply to it** (keep the subject: it contains the `[VEN-…]` reference) and attach `reply/Sahyadri_Cancelled_Cheque.png`.
3. The next email asks only to confirm the details: open the link and press **Confirm**.

Variation: send the cheque as a **new** email (no reference) from the same address - it still joins the same application.

## Expected result
**Waiting for vendor** → reply with cheque → **Waiting** (confirm only) → **Approved**.

## What to look at
Only one email per step, no duplicates; the reminder loop stops as soon as the vendor replies.

## Files
- `Sahyadri_Certificate_of_Incorporation.pdf`
- `Sahyadri_GST_Certificate.pdf`
- `Sahyadri_PAN.png`
- `Sahyadri_Udyam.pdf`
- `reply/Sahyadri_Cancelled_Cheque.png` (send later)
