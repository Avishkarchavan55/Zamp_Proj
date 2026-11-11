# T10: Conflicting company names across documents (Dataset C, adversarial), by email

**Channel:** Email. **Tests:** mismatched company names, conflicting information. The same business appears under three different names:

| Document | Name shown |
|---|---|
| Certificate of incorporation | MAHANADI PACKAGING INDUSTRIES PRIVATE LIMITED |
| PAN card | MAHANADI PACKAGING INDUSTRIES PRIVATE LIMITED |
| GST certificate | MAHANADI PACKAGING **AND LOGISTICS** PRIVATE LIMITED |
| Cancelled cheque, account holder | MAHANADI **PACKAGERS** PVT LTD |

## How to test
1. Open Gmail and write a new email **to `acmevendoronboarding@gmail.com`** from your own account.
2. Use the subject and body below and attach all the files listed.
3. Send. The inbox is checked every minute, so the vendor appears in **All vendors** with an *Email* tag within about a minute.
4. Open the vendor and read the **Checks** tab. An email application always asks the vendor to **confirm the details read from the documents** first: open the link in the request email, check the pre-filled values and press **Confirm**. The full checks then run again.

## Email
Subject: `Vendor registration - Mahanadi Packaging`

```
Hello Acme team,

We supply corrugated packaging from Cuttack and would like to register as your supplier. Our four documents are attached.

Regards,
Prasanta Das
Mahanadi Packaging Industries Pvt Ltd
+91 94370 28615
```

## Files to attach
- `Mahanadi_Certificate_of_Incorporation.pdf`
- `Mahanadi_GST_Certificate.pdf`
- `Mahanadi_PAN.png`
- `Mahanadi_Cancelled_Cheque.png`

## Expected result
1. **Waiting for vendor** (confirm the details).
2. After you confirm: **Needs attention** with name conflicts shown side by side: the GST legal name differs from the company's name, and the bank account holder is a different name. Each check quotes the text from the document it came from.
3. Not auto-approved. Not auto-rejected either: similar names can be a trading name, but a person must look.

## Fails if
Any of the three differing names is called a match, or the application is approved.
