# T02: Skewed, low-resolution and poorly lit scans (Dataset B, robustness), by portal

**Channel:** Supplier portal. **Tests:** skewed scans, low-resolution images, poor lighting. The form values are correct; only the *quality of the documents* is bad.

| Document | Problem |
|---|---|
| Certificate of incorporation | image-only PDF, tilted 4 degrees, blurred, noisy, low contrast |
| GST certificate | image-only PDF, tilted the other way, blurred, noisy |
| PAN card | tiny, heavily compressed JPEG (about 425 x 268 pixels) |
| Cancelled cheque | phone photo under a lamp: shadow on the left, warm cast, tilted |

## How to test
1. Sign in to the company portal in your browser (open `https://zamp-prep.vercel.app/go`), then open the supplier portal: **Become a supplier**, then **Apply**.
2. Type the values from the table below (use **your own email** as the contact email) and attach the files listed.
3. Press **Submit application** and watch the run page.
4. Open the vendor under **All vendors** and read the **Checks** tab.

## Form values
| Field | Value |
|---|---|
| Legal name of business | `Brahmaputra Tea Machinery Private Limited` |
| Entity type | `Private Limited Company` |
| Proprietor / authorised signatory | `Dipankar Bora` |
| PAN | `AAHCB2941R` |
| GSTIN | `18AAHCB2941R1Z4` |
| CIN | `U29299AS2016PTC017352` |
| Registered address | `NH 37, Beltola Tiniali` |
| City | `Guwahati` |
| State | `Assam` |
| PIN code | `781005` |
| Contact person | `Dipankar Bora` |
| Contact email | `your own email address` |
| Phone | `+91 98640 23517` |
| What you supply | `Tea processing machinery` |
| Account holder name | `Brahmaputra Tea Machinery Pvt Ltd` |
| Account number | `917030058126470` |
| IFSC | `UTIB0000080` |
| Bank name | `Axis Bank` |
| MSME (Udyam) registered? | `No` |

## Files
- `Brahmaputra_Incorporation_skewed_scan.pdf`
- `Brahmaputra_GST_skewed_scan.pdf`
- `Brahmaputra_PAN_lowres.jpg`
- `Brahmaputra_Cheque_poor_light.jpg`

## Expected result
Either outcome is acceptable, but the system must be **honest about the quality**:
- **Approved** (bank ownership condition), with the readings marked as lower confidence; **or**
- **Needs attention** or **Waiting for vendor** because a field was too unclear to confirm, with the unclear field named.

## Fails if
A wrong value is silently accepted (for example a different account number read from the blurred cheque and still shown as passed), or the run crashes instead of finishing.
Look at **Checks** and the document viewer: low-confidence fields should say so. Compare each extracted value with the table above.
