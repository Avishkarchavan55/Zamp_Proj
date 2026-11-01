# Extra email edge case: Rajputana Textiles (doctored cheque)

A complete email, but the **cheque looks tampered**: it prints HDFC Bank while its IFSC belongs to ICICI, and the image was saved from Photoshop.

**Where:** Gmail, to `acmevendoronboarding@gmail.com`. Send from **your own email account**; the reply goes back to the address you send from.

## Step 1: send this email (attach all four files in this folder)
Subject: `New vendor registration - Rajputana Textiles`

```
Hello Acme team,

We supply block-printed fabrics from Jaipur and would like to register as your supplier.
All four documents, including our cancelled cheque, are attached.

Regards,
Vikram Shekhawat
Rajputana Textiles Pvt Ltd
+91 98290 31472
```

Attach:
- `Rajputana_Certificate_of_Incorporation.pdf`
- `Rajputana_GST_Certificate.pdf`
- `Rajputana_PAN.png`
- `Rajputana_Cancelled_Cheque.png`

## Step 2: what happens (about a minute)
The inbox picks it up and builds the application from the documents. Because the details were read from documents and not typed by the vendor, it first asks the vendor to **confirm them** (**Waiting for vendor**). An email goes to you with a link.

## Step 3: confirm (open the link in that email)
Check the pre-filled details and press **Confirm**. The full checks run.

## Expected result
**Needs attention**, with two flags: *the cheque's bank does not match its IFSC* (HDFC printed, ICICI IFSC) and *the cheque image carries Photoshop metadata*. It is never auto-approved and never auto-rejected: a person decides, with the evidence beside it. The vendor shows an *Email* tag.
