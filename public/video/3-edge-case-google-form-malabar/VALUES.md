# Part 6: Malabar Spice Exports (edge case, Google Form, wrong document)

The vendor **attached the wrong file in the PAN card field** (the GST certificate again, in a file called `Malabar_Scan_0412.pdf`). VendorIQ notices, asks for the right one, and approves after the vendor resubmits.

**Where:** the live Google Form (link on the Become a supplier page and in `../README.md`).
Choose *Private Limited Company*, *MSME registered: No*, *MSME category: Not applicable*, type the values below and upload the four files in this folder. Use **your own email** as the contact email.

## Step 1: submit the form with these files
- Certificate of Incorporation: `Malabar_Certificate_of_Incorporation.pdf`
- GST Registration Certificate: `Malabar_GST_REG-06.pdf`
- **PAN Card (the mistake):** `Malabar_Scan_0412.pdf`  (this is really a second copy of the GST certificate)
- Cancelled cheque or bank letter: `Malabar_Cancelled_Cheque.png`

## Step 2: what happens (about a minute)
The application appears with a *Google Form* tag and the status **Waiting for vendor**. The check reads *"The file in this slot is a GST certificate, not a PAN card"*. The vendor is emailed (to you) with a link, and the same request appears in the supplier portal under Notifications.

## Step 3: fix it (open the link in that email)
Upload `send-later/Malabar_PAN_Card.png` as the PAN card and submit. Only the PAN checks re-run; unchanged documents are not re-read.

## Expected result
**Waiting for vendor**, then **Approved** after step 3, with the *confirm bank ownership before the first payment* condition.

## Form values (contact email: use your own)
| Field | Value |
|---|---|
| Legal name of business | `Malabar Spice Exports Pvt Ltd` |
| Entity type | `Private Limited Company` |
| Proprietor / authorised signatory | `Anita Menon` |
| PAN | `AAHCM6120L` |
| GSTIN | `32AAHCM6120L1ZK` |
| CIN | `U15400KL2016PTC045512` |
| Registered address | `Door 14/221, Willingdon Island` |
| City | `Kochi` |
| State | `Kerala` |
| PIN code | `682003` |
| Contact person | `Anita Menon` |
| Contact email | `accounts@malabarspice.in` |
| Phone | `+91 94470 28163` |
| What you supply | `Spices and spice extracts` |
| Account holder name | `Malabar Spice Exports Pvt Ltd` |
| Account number | `50100274439081` |
| IFSC | `HDFC0000053` |
| Bank name | `HDFC Bank` |
| MSME (Udyam) registered? | `No` |
