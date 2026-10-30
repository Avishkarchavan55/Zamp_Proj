# E1 · Bank account already on file

**Vendor:** Meridian Office Solutions Pvt Ltd  
**Channel:** Vendor portal

## What it tests
Payment-diversion fraud: the bank account already belongs to a different, approved company (Apex Facility Services).

## How to run it
**Submit on the vendor portal** (`/apply`).

- **Quick way:** open *Demo: fill this form with a test vendor* → pick **Bank account already on file**. It fills every field and attaches the documents. Then press **Submit application**.
- **By hand:** type the values below and attach the files in this folder.

## Expected result
**Rejected** automatically: *Bank account used by another vendor*.

## What to look at
Open the vendor → the red check shows the other company, its PAN and vendor ID. No email is sent: rejections go through a person.

## Files
- Certificate of Incorporation → `Meridian_Certificate_of_Incorporation.pdf`
- GST Registration Certificate → `Meridian_GST_REG-06.pdf`
- PAN Card → `Meridian_PAN_Card.png`
- Cancelled cheque or bank letter → `Meridian_Cancelled_Cheque.png`

## Form values
| Field | Value |
|---|---|
| Legal name of business | `Meridian Office Solutions Pvt Ltd` |
| Entity type | `Private Limited Company` |
| Proprietor / authorised signatory | `Sameer Reddy` |
| PAN | `AAJCM6390Q` |
| GSTIN | `36AAJCM6390Q1ZK` |
| CIN | `U74999TG2020PTC141207` |
| Registered address | `Unit 304, Cyber Pearl, HITEC City` |
| City | `Hyderabad` |
| State | `Telangana` |
| PIN code | `500081` |
| Contact person | `Sameer Reddy` |
| Contact email | `meridian.office.sol@gmail.com` |
| Phone | `+91 90004 81726` |
| What you supply | `Office supplies & facility consumables` |
| Account holder name | `Meridian Office Solutions Pvt Ltd` |
| Account number | `38291045672` |
| IFSC | `SBIN0000847` |
| Bank name | `State Bank Of India` |
| MSME (Udyam) registered? | `No` |
