# T01: Complete, consistent vendor (Dataset A, happy path), by email

**Channel:** Email (Gmail). **Tests:** complete details, correct documents, matching identifiers, valid bank information, consistent company details. A registered Small MSME.

## How to test
1. Open Gmail and write a new email **to `acmevendoronboarding@gmail.com`** from your own account.
2. Use the subject and body below and attach all the files listed.
3. Send. The inbox is checked every minute, so the vendor appears in **All vendors** with an *Email* tag within about a minute.
4. Open the vendor and read the **Checks** tab. An email application always asks the vendor to **confirm the details read from the documents** first: open the link in the request email, check the pre-filled values and press **Confirm**. The full checks then run again.

## Email
Subject: `Vendor registration - Chambal Valley Agro Industries`

```
Hello Acme team,

We supply agricultural inputs and seeds from Gwalior and would like to register as your supplier. Our five documents are attached. We are a registered MSME (Small).

Regards,
Pooja Tomar
Chambal Valley Agro Industries Pvt Ltd
+91 94250 71836
```

## Files to attach (all five)
- `Chambal_Certificate_of_Incorporation.pdf`
- `Chambal_GST_Certificate.pdf`
- `Chambal_PAN.png`
- `Chambal_Cancelled_Cheque.png`
- `Chambal_Udyam_Certificate.pdf`

## Expected result
1. **Waiting for vendor** first: *Confirm your details* (the details were read from the documents).
2. After you confirm: **Approved**, with two conditions: *confirm bank ownership before the first payment* and *pay within 45 days (MSME Small)*. An ERP vendor record appears.
3. Every identifier check is green: PAN, GSTIN with checksum, CIN, IFSC, pincode against state, names across all five documents.

## Fails if
It is rejected or sent to Needs attention, or a check is red or reports a mismatch. Nothing in this case is wrong.
