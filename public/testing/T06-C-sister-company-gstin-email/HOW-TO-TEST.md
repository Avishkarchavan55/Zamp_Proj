# T06: Sister-company GSTIN (Dataset C, adversarial), by email

**Channel:** Email. **Tests:** sister-company GSTIN, mismatched company names. The GST certificate belongs to **TAPTI ENGINEERING WORKS (INDIA) PRIVATE LIMITED** (a different PAN, `AAGCT8826F`); the PAN card and incorporation certificate belong to **TAPTI ENGINEERING WORKS PRIVATE LIMITED** (PAN `AAGCT8820B`). Every field is valid on its own and the names are almost identical.

## How to test
1. Open Gmail and write a new email **to `acmevendoronboarding@gmail.com`** from your own account.
2. Use the subject and body below and attach all the files listed.
3. Send. The inbox is checked every minute, so the vendor appears in **All vendors** with an *Email* tag within about a minute.
4. Open the vendor and read the **Checks** tab. An email application always asks the vendor to **confirm the details read from the documents** first: open the link in the request email, check the pre-filled values and press **Confirm**. The full checks then run again.

## Email
Subject: `Vendor registration - Tapti Engineering Works`

```
Hello Acme team,

We supply engineering components from Surat and would like to register as your supplier. Our four documents are attached.

Regards,
Jignesh Mehta
Tapti Engineering Works Pvt Ltd
+91 98250 66431
```

## Files to attach
- `Tapti_Certificate_of_Incorporation.pdf`
- `Tapti_GST_Certificate.pdf`
- `Tapti_PAN.png`
- `Tapti_Cancelled_Cheque.png`

## Expected result
1. **Waiting for vendor** (confirm the details), as for every email application.
2. After you confirm: **Needs attention** with the red check *GSTIN belongs to this PAN*: the PAN inside the GSTIN (`AAGCT8826F`) is not the company's PAN (`AAGCT8820B`). The GST legal name on the certificate also differs from the incorporation certificate by the words "(INDIA)".
3. It is **not auto-approved**, and **not auto-rejected** (near-identical names can be a sister company with a legitimate explanation): a person decides.

## Fails if
It is approved, or the near-identical name is called a perfect match without the PAN conflict being flagged.
