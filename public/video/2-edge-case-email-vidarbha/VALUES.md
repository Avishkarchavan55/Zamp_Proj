# Part 5: Vidarbha Office Traders (edge case, email, fraud)

A complete, tidy email, but the **cheque's bank account already belongs to another company**: Apex Facility Services, an existing approved vendor. This is the classic payment-diversion pattern.

**Where:** Gmail, to `acmevendoronboarding@gmail.com`. Send from **your own email account**.

## Step 1: send this email (attach all four files in this folder)
Subject: `Vendor registration - Vidarbha Office Traders`

```
Hello Acme team,

We supply office stationery and consumables from Nagpur and would like to register as your supplier.
All four documents, including our cancelled cheque, are attached.

Regards,
Rohan Deshpande
Vidarbha Office Traders Pvt Ltd
+91 98230 60418
```

Attach:
- `Vidarbha_Certificate_of_Incorporation.pdf`
- `Vidarbha_GST_Certificate.pdf`
- `Vidarbha_PAN.png`
- `Vidarbha_Cancelled_Cheque.png`

## Step 2: what happens (about a minute)
The inbox picks it up, sorts each attachment into its document type and builds the application from the documents.

## Expected result
**Rejected** automatically, with the red check *Bank account not used by another vendor*: the account `38291045672` at `SBIN0000847` is already registered to **Apex Facility Services**, a different legal entity (different PAN). The vendor shows an *Email* tag. No email goes to the vendor: rejections are communicated by a person, and the case is flagged for the Finance Controller.
