# T03: Formatting variations, other page layouts and missing optional fields (Dataset B), by Google Form

**Channel:** Google Form. **Tests:** different capitalisation, minor formatting variations, different PDF layouts, missing optional fields.

| Variation | Where |
|---|---|
| ALL CAPS name with dots (`PVT. LTD.`) | form legal name (documents say `PRIVATE LIMITED`) |
| lowercase PAN, GSTIN, CIN, IFSC and bank name | form |
| account number with spaces (`5010 0344 7029 18`) | form |
| phone as `09414055218` (no +91, no spaces) | form |
| incorporation certificate as a plain letter with a table | document |
| GST certificate as a landscape card with boxes (label `GSTIN / UIN`) | document |
| left blank: trade name, what you supply, website | form |

## How to test
1. Open the live Google Form: https://docs.google.com/forms/d/e/1FAIpQLScKSR6gw7gLbEeBdnJIfayYgipGbyclKOuP7RKfSfRN9_4M8g/viewform
2. Type the values from the table below exactly as shown (use **your own email**), choose *Private Limited Company*, and attach the files listed.
3. Submit. The application appears in **All vendors** with a *Google Form* tag within about a minute.
4. Open the vendor and read the **Checks** tab.

## Form values (type them exactly like this, including the lowercase)
| Field | Value |
|---|---|
| Legal name of business | `MARWAR LEATHER WORKS PVT. LTD.` |
| Entity type | `Private Limited Company` |
| Proprietor / authorised signatory | *(leave blank)* |
| PAN | `aagcm7752k` |
| GSTIN | `08aagcm7752k1zy` |
| CIN | `u19201rj2018ptc060214` |
| Registered address | `E-112, Basni Industrial Area Phase 2` |
| City | `Jodhpur` |
| State | `Rajasthan` |
| PIN code | `342001` |
| Contact person | `Mahendra Rathore` |
| Contact email | your own email address |
| Phone | `09414055218` |
| What you supply | *(leave blank)* |
| Account holder name | `marwar leather works pvt ltd` |
| Account number | `5010 0344 7029 18` |
| IFSC | `hdfc0000053` |
| Bank name | `hdfc bank` |
| MSME (Udyam) registered? | `No` |

## Files
- `Marwar_Incorporation_letter_layout.pdf`
- `Marwar_GST_landscape_layout.pdf`
- `Marwar_PAN.png`
- `Marwar_Cancelled_Cheque.png`

## Expected result
**Approved** (bank ownership condition). The system normalises case, spaces and legal-form abbreviations before comparing, so none of these differences raises a flag. Blank optional fields do not trigger a request.

## Fails if
The vendor is asked to "fix" its PAN, GSTIN or account number (the values are right, only formatted differently), or the names are called a mismatch, or the landscape GST layout is not read.
