# Part 6: Utkal Cashew Processors (edge case, Google Form, wrong document)

The vendor **attached the wrong file in the PAN card field** (the GST certificate again, in a file called `Utkal_Scan_0719.pdf`). VendorIQ notices, asks for the right one, and **approves once the vendor uploads the correct PAN card**.

**Where:** the live Google Form (link on the Become a supplier page and in `../README.md`).

> **Important: start from a blank form, not an old pre-filled link.** A link built for an earlier vendor still carries that vendor's address and contact details. If the address state does not match the GSTIN state (Odisha here), the system correctly holds the application for a person instead of approving it. Type every value from the table below, or build a fresh pre-filled link with the `prefilledLinkUtkal` helper in the Apps Script (see `../README.md`).

Choose *Private Limited Company*, *MSME registered: No*, *MSME category: Not applicable*. Use **your own email** as the contact email.

## Step 1: submit the form with these files
- Certificate of Incorporation: `Utkal_Certificate_of_Incorporation.pdf`
- GST Registration Certificate: `Utkal_GST_REG-06.pdf`
- **PAN Card (the mistake):** `Utkal_Scan_0719.pdf`  (this is really a second copy of the GST certificate)
- Cancelled cheque or bank letter: `Utkal_Cancelled_Cheque.png`

## Step 2: what happens (about a minute)
The application appears with a *Google Form* tag and the status **Waiting for vendor**. The check reads *"The file in this slot is a GST certificate, not a PAN card"*. The vendor is emailed (to you) with a link, and the same request appears in the supplier portal under Notifications.

## Step 3: fix it (open the link in that email)
Upload `send-later/Utkal_PAN_Card.png` as the PAN card and submit. Only the PAN checks re-run; unchanged documents are not re-read.

## Expected result
**Waiting for vendor**, then **Approved** after step 3, with the *confirm bank ownership before the first payment* condition.

## Form values (contact email: use your own)
| Field | Value |
|---|---|
| Legal name of business | `Utkal Cashew Processors Pvt Ltd` |
| Entity type | `Private Limited Company` |
| Proprietor / authorised signatory | `Subhashree Mohanty` |
| PAN | `AAGCU6027N` |
| GSTIN | `21AAGCU6027N1Z6` |
| CIN | `U15319OR2017PTC021788` |
| Registered address | `Plot 5, Mancheswar Industrial Estate` |
| City | `Bhubaneswar` |
| State | `Odisha` |
| PIN code | `751010` |
| Contact person | `Subhashree Mohanty` |
| Contact email | `accounts@utkalcashew.in` |
| Phone | `+91 94370 61842` |
| What you supply | `Cashew processing and packaging` |
| Account holder name | `Utkal Cashew Processors Pvt Ltd` |
| Account number | `7712038459` |
| IFSC | `KKBK0000721` |
| Bank name | `Kotak Mahindra Bank` |
| MSME (Udyam) registered? | `No` |
