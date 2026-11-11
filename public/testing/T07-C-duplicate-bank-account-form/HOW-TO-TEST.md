# T07: Duplicate bank account (Dataset C, adversarial), by Google Form

**Channel:** Google Form. **Tests:** duplicate records, a payment-diversion pattern. Everything is consistent, but the bank account `002705018342` at `ICIC0000027` already belongs to **Sai Krupa Fabricators**, an approved vendor with a different PAN.

## How to test
1. Open the live Google Form: https://docs.google.com/forms/d/e/1FAIpQLScKSR6gw7gLbEeBdnJIfayYgipGbyclKOuP7RKfSfRN9_4M8g/viewform
2. Type the values from the table below exactly as shown (use **your own email**), choose *Private Limited Company*, and attach the files listed.
3. Submit. The application appears in **All vendors** with a *Google Form* tag within about a minute.
4. Open the vendor and read the **Checks** tab.

## Form values
| Field | Value |
|---|---|
| Legal name of business | `Rann Salt Traders Private Limited` |
| Entity type | `Private Limited Company` |
| Proprietor / authorised signatory | `Bharat Solanki` |
| PAN | `AAHCR1273G` |
| GSTIN | `24AAHCR1273G1ZJ` |
| CIN | `U51909GJ2019PTC108833` |
| Registered address | `Plot 6, Sector 8, Gandhidham` |
| City | `Gandhidham` |
| State | `Gujarat` |
| PIN code | `370201` |
| Contact person | `Bharat Solanki` |
| Contact email | `your own email address` |
| Phone | `+91 98790 41256` |
| What you supply | `Industrial salt trading` |
| Account holder name | `Rann Salt Traders Pvt Ltd` |
| Account number | `002705018342` |
| IFSC | `ICIC0000027` |
| Bank name | `ICICI Bank` |
| MSME (Udyam) registered? | `No` |

## Files
- `Rann_Certificate_of_Incorporation.pdf`
- `Rann_GST_Certificate.pdf`
- `Rann_PAN.png`
- `Rann_Cancelled_Cheque.png`

## Expected result
**Rejected** automatically. The red check *Bank account not used by another vendor* names Sai Krupa Fabricators (its vendor reference and status) as the existing owner of the account. No email is sent to the vendor: rejections are handled by a person.

## Fails if
It is approved or only sent to Needs attention, or the check does not say which vendor owns the account.

> Needs the sample vendor **Sai Krupa Fabricators** to be on the website (it is in the standard history). If Overview does not list it, this case cannot trigger.
