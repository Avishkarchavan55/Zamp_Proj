# T09: Transposed identifier digits (Dataset C, adversarial), by Google Form

**Channel:** Google Form. **Tests:** transposed identifier digits, conflicting information. The documents are all correct. The vendor **types the PAN with two digits swapped**: `AAHCT7519E` instead of `AAHCT5719E`.

## How to test
1. Open the live Google Form: https://docs.google.com/forms/d/e/1FAIpQLScKSR6gw7gLbEeBdnJIfayYgipGbyclKOuP7RKfSfRN9_4M8g/viewform
2. Type the values from the table below exactly as shown (use **your own email**), choose *Private Limited Company*, and attach the files listed.
3. Submit. The application appears in **All vendors** with a *Google Form* tag within about a minute.
4. Open the vendor and read the **Checks** tab.
Type this wrong value (everything else as in the table):

| Field | Type this | Correct value (on the documents) |
|---|---|---|
| PAN | `AAHCT7519E` | `AAHCT5719E` |

## Form values
| Field | Value |
|---|---|
| Legal name of business | `Teesta Valley Tea Traders Private Limited` |
| Entity type | `Private Limited Company` |
| Proprietor / authorised signatory | `Sourav Ghosh` |
| PAN | `AAHCT7519E` |
| GSTIN | `19AAHCT5719E1Z5` |
| CIN | `U15500WB2018PTC226470` |
| Registered address | `Hill Cart Road, Sevoke More` |
| City | `Siliguri` |
| State | `West Bengal` |
| PIN code | `734001` |
| Contact person | `Sourav Ghosh` |
| Contact email | `your own email address` |
| Phone | `+91 98320 45167` |
| What you supply | `Tea trading and blending` |
| Account holder name | `Teesta Valley Tea Traders Pvt Ltd` |
| Account number | `006105412966` |
| IFSC | `ICIC0000027` |
| Bank name | `ICICI Bank` |
| MSME (Udyam) registered? | `No` |

## Files
- `Teesta_Certificate_of_Incorporation.pdf`
- `Teesta_GST_Certificate.pdf`
- `Teesta_PAN.png`
- `Teesta_Cancelled_Cheque.png`

## Expected result
**Needs attention** with the conflict shown with evidence, all pointing at the PAN:
- *PAN matches PAN card*: form `AAHCT7519E`, document `AAHCT5719E`;
- *PAN matches incorporation certificate*: same difference;
- *GSTIN belongs to this PAN*: the PAN inside the GSTIN is `AAHCT5719E`, not the typed one.

The documents agree with each other and the GSTIN, so a reviewer can see at a glance that the typing is the odd one out.

## Variation (optional, a second run needs a fresh vendor, so only try it after this one is deleted)
Type the **GSTIN** with two digits swapped (`19AAHCT5791E1Z5` instead of `19AAHCT5719E1Z5`). A transposed GSTIN fails its **check digit**, so the system answers differently: **Waiting for vendor** with the corrected value suggested (`19AAHCT5719E1Z5`) and a link to fix it.

## Fails if
The mistyped PAN is accepted silently, or the vendor is rejected for a typing error.
