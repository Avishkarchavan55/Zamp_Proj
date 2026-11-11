# T08: Edited files and handwritten annotations (Dataset C, adversarial), by portal

**Channel:** Supplier portal. **Tests:** modified document metadata, handwritten annotations.

| Document | Variation |
|---|---|
| GST certificate | the PDF's producer says **Canva** (a design tool, not how the GST portal issues certificates) |
| Cancelled cheque | the image file says it was saved by **Adobe Photoshop 25.0** |
| PAN card | pen marks on top: a hand-drawn circle around the PAN, a tick and notes ("checked OK - R.S. 4/11", "orig. to be verified?") |
| Certificate of incorporation | clean |

All the *content* is correct and consistent with the form.

## How to test
1. Sign in to the company portal in your browser (open `https://zamp-prep.vercel.app/go`), then open the supplier portal: **Become a supplier**, then **Apply**.
2. Type the values from the table below (use **your own email** as the contact email) and attach the files listed.
3. Press **Submit application** and watch the run page.
4. Open the vendor under **All vendors** and read the **Checks** tab.

## Form values
| Field | Value |
|---|---|
| Legal name of business | `Aravali Brass Handicrafts Private Limited` |
| Entity type | `Private Limited Company` |
| Proprietor / authorised signatory | `Imran Khan` |
| PAN | `AAFCA9024H` |
| GSTIN | `09AAFCA9024H1ZN` |
| CIN | `U36999UP2016PTC081530` |
| Registered address | `Plot 21, Majhola Industrial Area` |
| City | `Moradabad` |
| State | `Uttar Pradesh` |
| PIN code | `244001` |
| Contact person | `Imran Khan` |
| Contact email | `your own email address` |
| Phone | `+91 94120 77385` |
| What you supply | `Brass handicrafts` |
| Account holder name | `Aravali Brass Handicrafts Pvt Ltd` |
| Account number | `50200177630452` |
| IFSC | `HDFC0000103` |
| Bank name | `HDFC Bank` |
| MSME (Udyam) registered? | `No` |

## Files
- `Aravali_Certificate_of_Incorporation.pdf`
- `Aravali_GST_Certificate.pdf`
- `Aravali_PAN_annotated.png`
- `Aravali_Cancelled_Cheque.png`

## Expected result
**Needs attention** with two file-origin flags: *GST registration certificate: file origin (Canva)* and *Bank proof: file origin (Adobe Photoshop 25.0)*. They are warnings for a person to compare against the originals, never a rejection on their own.
The pen marks on the PAN card must **not** disturb the reading: the PAN number is still read as `AAFCA9024H` and the PAN checks pass.

## Fails if
The edited files are approved without a flag, the vendor is auto-rejected for the metadata alone, or the handwriting is read as part of the PAN number or name.
