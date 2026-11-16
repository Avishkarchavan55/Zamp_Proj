# T11: Complete, consistent vendor (Dataset A, happy path), by portal

**Channel:** Supplier portal. **Tests:** complete details, correct documents, matching identifiers, valid bank information, consistent company details, with the vendor typing the form itself. Not an MSME, so there is no payment-terms condition.

## How to test
1. Sign in to the company portal in your browser (open `https://zamp-prep.vercel.app/go`), then open the supplier portal: **Become a supplier**, then **Apply**.
2. Type the values from the table below (use **your own email** as the contact email) and attach the files listed.
3. Press **Submit application** and watch the run page.
4. Open the vendor under **All vendors** and read the **Checks** tab.

## Form values
| Field | Value |
|---|---|
| Legal name of business | `Pushpagiri Coffee Estates Private Limited` |
| Entity type | `Private Limited Company` |
| Proprietor / authorised signatory | `Kavitha Ponnappa` |
| PAN | `AAHCP7184L` |
| GSTIN | `29AAHCP7184L1ZM` |
| CIN | `U01132KA2017PTC103518` |
| Registered address | `Estate Office, Mysore Road` |
| City | `Madikeri` |
| State | `Karnataka` |
| PIN code | `571201` |
| Contact person | `Kavitha Ponnappa` |
| Contact email | `your own email address` |
| Phone | `+91 98450 62173` |
| What you supply | `Coffee growing and curing` |
| Account holder name | `Pushpagiri Coffee Estates Pvt Ltd` |
| Account number | `50100418329076` |
| IFSC | `HDFC0000053` |
| Bank name | `HDFC Bank` |
| MSME (Udyam) registered? | `No` |

## Files
- `Pushpagiri_Certificate_of_Incorporation.pdf`
- `Pushpagiri_GST_REG-06.pdf`
- `Pushpagiri_PAN_Card.png`
- `Pushpagiri_Cancelled_Cheque.png`

## Expected result
**Approved** in about a minute with no human involved, with one condition: *confirm bank ownership before the first payment* (a cheque cannot prove who owns the account). An **ERP vendor record** appears on the vendor page, and the supplier receives an approval email and a notification in the supplier portal.
Every check is green: PAN, GSTIN with its check digit, CIN, IFSC against the live directory, pincode against the state, and the names across the form and all four documents.

## Fails if
It is rejected, held for the vendor or sent to Needs attention, or any check is red. Nothing in this case is wrong.
