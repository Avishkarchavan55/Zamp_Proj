# Spare email edge case: Narmada Pump Industries

Same idea as Lokseva, with a different vendor: a company that emails three documents and **no cheque**, and is **not an MSME** (no Udyam certificate).

**Where:** Gmail, to `acmevendoronboarding@gmail.com`. Send from **your own email account**; the reply goes back to the address you send from.

## Step 1: send this email (attach the three files in this folder, NOT the cheque)
Subject: `Vendor registration - Narmada Pump Industries`

```
Hello Acme team,

We manufacture industrial water pumps and would like to register as your supplier.
Our company documents are attached.

Regards,
Dhruv Mehta
Narmada Pump Industries Pvt Ltd
+91 98250 77419
```

Attach:
- `Narmada_Certificate_of_Incorporation.pdf`
- `Narmada_GST_Certificate.pdf`
- `Narmada_PAN.png`

## Step 2: what happens (about a minute)
The inbox picks it up, sorts each attachment into its document type, builds the application from the documents and marks it **Waiting for vendor**. An email goes to you asking for (1) the cancelled cheque and (2) confirmation of the details it read.

## Step 3: the reply (open the link in that email)
Check the pre-filled details, upload `send-later/Narmada_Cancelled_Cheque.png` as the bank proof, press **Confirm**.

## Expected result
**Waiting for vendor** (cheque + confirm), then **Approved** after step 3. The vendor shows an *Email* tag. No MSME condition is added.
