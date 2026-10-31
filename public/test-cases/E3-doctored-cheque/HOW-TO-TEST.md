# E3 · Doctored cheque

**Vendor:** Lakshmi Engineering Works Pvt Ltd  
**Channel:** Vendor portal

## What it tests
Tampering: the cheque prints HDFC Bank, but its IFSC belongs to ICICI Bank, and the image was saved from Photoshop.

## How to run it
**Submit on the vendor portal** (`/apply`).

- **Quick way:** open *Demo: fill this form with a test vendor* → pick **Doctored cheque**. It fills every field and attaches the documents. Then press **Submit application**.
- **By hand:** type the values below and attach the files in this folder.

## Expected result
**Needs attention**: *Cheque bank ≠ IFSC bank* and *Document edited in image software*.

## What to look at
The live IFSC lookup names the real bank; the file's metadata names the editing software.

## Files
- Certificate of Incorporation → `Lakshmi_Certificate_of_Incorporation.pdf`
- GST Registration Certificate → `Lakshmi_GST_REG-06.pdf`
- PAN Card → `Lakshmi_PAN_Card.png`
- Cancelled cheque or bank letter → `Lakshmi_Cancelled_Cheque.png`

## Form values
| Field | Value |
|---|---|
| Legal name of business | `Lakshmi Engineering Works Pvt Ltd` |
| Entity type | `Private Limited Company` |
| Proprietor / authorised signatory | `Ravi Kulkarni` |
| PAN | `AAECL6624P` |
| GSTIN | `27AAECL6624P1ZY` |
| CIN | `U29100MH2018PTC309982` |
| Registered address | `Plot C-12, MIDC Satpur` |
| City | `Nashik` |
| State | `Maharashtra` |
| PIN code | `422007` |
| Contact person | `Ravi Kulkarni` |
| Contact email | `accounts@lakshmiengg.in` |
| Phone | `+91 98230 55871` |
| What you supply | `Hydraulic fittings` |
| Account holder name | `Lakshmi Engineering Works Pvt Ltd` |
| Account number | `50100388412907` |
| IFSC | `ICIC0000027` |
| Bank name | `Hdfc Bank` |
| MSME (Udyam) registered? | `No` |
