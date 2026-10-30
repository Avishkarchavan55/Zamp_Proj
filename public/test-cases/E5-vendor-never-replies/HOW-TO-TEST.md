# E5 · Vendor never replies

**Vendor:** Bluewave Technologies Pvt Ltd  
**Channel:** Vendor portal

## What it tests
The PAN card is missing and the vendor ignores every email. n8n sends reminders, then escalates.

## How to run it
**Submit on the vendor portal** (`/apply`).

- **Quick way:** open *Demo: fill this form with a test vendor* → pick **Vendor never replies**. It fills every field and attaches the documents. Then press **Submit application**.
- **By hand:** type the values below and attach the files in this folder.

**Then:** Do nothing after submitting. Reminders arrive every 2 minutes (demo timing).

## Expected result
**Waiting for vendor** → reminder 1 (~2 min) → reminder 2 (~4 min) → flagged **No reply** (~6 min).

## What to look at
*Emails to vendors* lists the request and both reminders; the vendor gets a red *no reply* tag on the overview.

## Files
- Certificate of Incorporation → `Bluewave_Certificate_of_Incorporation.pdf`
- GST Registration Certificate → `Bluewave_GST_REG-06.pdf`
- Cancelled cheque or bank letter → `Bluewave_Cancelled_Cheque.png`

## Form values
| Field | Value |
|---|---|
| Legal name of business | `Bluewave Technologies Pvt Ltd` |
| Entity type | `Private Limited Company` |
| Proprietor / authorised signatory | `Rahul Menon` |
| PAN | `AAJCB3326H` |
| GSTIN | `29AAJCB3326H1ZN` |
| CIN | `U72900KA2019PTC127745` |
| Registered address | `3rd Floor, 80 Feet Road, Indiranagar` |
| City | `Bengaluru` |
| State | `Karnataka` |
| PIN code | `560038` |
| Contact person | `Ananya Krishnan` |
| Contact email | `vendor-ops@bluewavetech.in` |
| Phone | `+91 99001 77432` |
| What you supply | `IT services & AMC` |
| Account holder name | `Bluewave Technologies Pvt Ltd` |
| Account number | `4612098735` |
| IFSC | `KKBK0000431` |
| Bank name | `Kotak Mahindra Bank` |
| MSME (Udyam) registered? | `No` |
