# T04: Hindi and English documents with different layouts (Dataset B), by portal

**Channel:** Supplier portal. **Tests:** multiple languages, different document layouts.

| Document | Variation |
|---|---|
| PAN card | Hindi and English labels (आयकर विभाग, नाम, निगमन की तारीख) |
| GST certificate | image-only scan with every label in Hindi and English (पंजीकरण प्रमाण पत्र, कानूनी नाम) |
| Certificate of incorporation | plain letter with a details table (not the usual certificate layout) |
| Cancelled cheque | standard |

## How to test
1. Sign in to the company portal in your browser (open `https://zamp-prep.vercel.app/go`), then open the supplier portal: **Become a supplier**, then **Apply**.
2. Type the values from the table below (use **your own email** as the contact email) and attach the files listed.
3. Press **Submit application** and watch the run page.
4. Open the vendor under **All vendors** and read the **Checks** tab.

## Form values
| Field | Value |
|---|---|
| Legal name of business | `Varanasi Silk Weavers Private Limited` |
| Entity type | `Private Limited Company` |
| Proprietor / authorised signatory | `Anita Pandey` |
| PAN | `AAHCV6418M` |
| GSTIN | `09AAHCV6418M1ZP` |
| CIN | `U17119UP2015PTC070447` |
| Registered address | `D 33/12, Lallapura Road` |
| City | `Varanasi` |
| State | `Uttar Pradesh` |
| PIN code | `221001` |
| Contact person | `Anita Pandey` |
| Contact email | `your own email address` |
| Phone | `+91 94150 38264` |
| What you supply | `Silk fabrics and sarees` |
| Account holder name | `Varanasi Silk Weavers Pvt Ltd` |
| Account number | `004905612387` |
| IFSC | `ICIC0000027` |
| Bank name | `ICICI Bank` |
| MSME (Udyam) registered? | `No` |

## Files
- `Varanasi_Incorporation_letter_layout.pdf`
- `Varanasi_GST_Hindi_English_scan.pdf`
- `Varanasi_PAN_Hindi_English.png`
- `Varanasi_Cancelled_Cheque.png`

## Expected result
**Approved** (bank ownership condition). The readings come from the English values next to the Hindi labels: names, PAN, GSTIN and CIN match the form, and the document types are identified correctly (PAN card, GST certificate, certificate of incorporation).

## Fails if
A document is called "other" or the wrong type, the Hindi text is copied into a field (for example the legal name read as कानूनी नाम), or a value that is plainly on the page is reported as missing.
