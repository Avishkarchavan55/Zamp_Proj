# Part 5: Himalaya Herbal Extracts (edge case, email)

A company that emails its documents and **forgets the cheque**.

**Where:** Gmail, to `acmevendoronboarding@gmail.com`. Send from **your own email account**; the reply goes back to the address you send from.

## Step 1: send this email (attach the four files in this folder, NOT the cheque)
Subject: `Vendor registration - Himalaya Herbal Extracts`

```
Hello Acme team,

We make herbal extracts and supplements and would like to register as your supplier.
Our company documents are attached. We are a registered MSME (Micro).

Regards,
Neha Rawat
Himalaya Herbal Extracts Pvt Ltd
+91 94120 66318
```

Attach:
- `Himalaya_Certificate_of_Incorporation.pdf`
- `Himalaya_GST_Certificate.pdf`
- `Himalaya_PAN.png`
- `Himalaya_Udyam.pdf`

## Step 2: what happens (about a minute)
The inbox picks it up, sorts each attachment into its document type, builds the application from the documents and marks it **Waiting for vendor**. An email goes to you asking for (1) the cancelled cheque and (2) confirmation of the details it read. The same request appears in the supplier portal under Notifications.

## Step 3: the reply (open the link in that email)
Check the pre-filled details, upload `send-later/Himalaya_Cancelled_Cheque.png` as the bank proof, press **Confirm**.

## Expected result
**Waiting for vendor** (cheque + confirm), then **Approved** after step 3, with the *pay within 45 days (MSME)* condition. The vendor shows an *Email* tag.
