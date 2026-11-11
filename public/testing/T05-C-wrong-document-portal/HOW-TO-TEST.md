# T05: Wrong document uploaded (Dataset C, adversarial), by portal

**Channel:** Supplier portal. **Tests:** wrong document in a slot. `Pennar_GST_Certificate_scan.png` is really a **second copy of the PAN card**, so the *GST certificate* slot holds the wrong file.

## How to test
1. Sign in to the company portal in your browser (open `https://zamp-prep.vercel.app/go`), then open the supplier portal: **Become a supplier**, then **Apply**.
2. Type the values from the table below (use **your own email** as the contact email) and attach the files listed.
3. Press **Submit application** and watch the run page.
4. Open the vendor under **All vendors** and read the **Checks** tab.
5. Attach `Pennar_GST_Certificate_scan.png` in the **GST certificate** slot (the mistake) and `Pennar_PAN.png` in the PAN slot.
6. Wait for the request email, open its link, upload `send-later/Pennar_GST_Certificate.pdf` and submit.

## Form values
| Field | Value |
|---|---|
| Legal name of business | `Pennar Steel Fabricators Private Limited` |
| Entity type | `Private Limited Company` |
| Proprietor / authorised signatory | `Venkat Naidu` |
| PAN | `AAGCP4036D` |
| GSTIN | `37AAGCP4036D1ZM` |
| CIN | `U28999AP2016PTC102945` |
| Registered address | `Door 8-2-17, Gandhi Nagar Industrial Estate` |
| City | `Nellore` |
| State | `Andhra Pradesh` |
| PIN code | `524001` |
| Contact person | `Venkat Naidu` |
| Contact email | `your own email address` |
| Phone | `+91 94400 17352` |
| What you supply | `Structural steel fabrication` |
| Account holder name | `Pennar Steel Fabricators Pvt Ltd` |
| Account number | `6623187045` |
| IFSC | `KKBK0000721` |
| Bank name | `Kotak Mahindra Bank` |
| MSME (Udyam) registered? | `No` |

## Files
- `Pennar_Incorporation.pdf`
- `Pennar_GST_Certificate_scan.png`
- `Pennar_PAN.png`
- `Pennar_Cancelled_Cheque.png`
- `send-later/Pennar_GST_Certificate.pdf` (the correct file, for step 6)

## Expected result
1. **Waiting for vendor** with the check *"The file in this slot is a PAN card, not a GST certificate"*. The vendor is asked for exactly one thing: the GST registration certificate. It is **not rejected**.
2. After step 6 only the GST-related checks re-run (the other documents are not re-read) and the result is **Approved** (bank ownership condition).

## Fails if
The wrong file is accepted as a GST certificate, the vendor is rejected, or the request asks for more than the GST certificate.
