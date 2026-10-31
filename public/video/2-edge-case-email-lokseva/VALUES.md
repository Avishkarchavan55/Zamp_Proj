# Part 5: Lokseva (edge case, email)

**Where:** Gmail, to `acmevendoronboarding@gmail.com`. Send from **your own email account**; the reply goes back to the address you send from.

## Step 1: send this email (attach the four files in this folder, NOT the cheque)
Subject: `Vendor registration - Lokseva Pashukhadya`

```
Hello Acme team,

We manufacture cattle feed and mineral mixture and would like to register as your supplier.
Our company documents are attached. We are a registered MSME (Small).

Regards,
Sandeep Gaikwad
Lokseva Pashukhadya Pvt Ltd
+91 98221 40576
```

Attach:
- `Lokseva_Certificate_of_Incorporation.pdf`
- `Lokseva_GST_Certificate.pdf`
- `Lokseva_PAN.png`
- `Lokseva_Udyam.pdf`

## Step 2: what happens (about a minute)
The inbox picks it up, sorts each attachment into its document type, builds the application from the documents and marks it **Waiting for vendor**. An email goes to you asking for (1) the cancelled cheque and (2) confirmation of the details it read. The same request appears in the supplier portal under Notifications.

## Step 3: the reply (open the link in that email)
Check the pre-filled details, upload `send-later/Lokseva_Cancelled_Cheque.png` as the bank proof, press **Confirm**.

## Expected result
**Waiting for vendor** (cheque + confirm), then **Approved** after step 3. The vendor shows an *Email* tag.

## Original text (for reference)
```
To: the onboarding inbox
Subject: Vendor registration - Lokseva Pashukhadya

Hello Acme team,

We manufacture cattle feed and mineral mixture and would like to register as your supplier.
Our company documents are attached. We are a registered MSME (Small).

Regards,
Sandeep Gaikwad
Lokseva Pashukhadya Pvt Ltd
+91 98221 40576

ATTACH (first email): Lokseva_Certificate_of_Incorporation.pdf, Lokseva_GST_Certificate.pdf, Lokseva_PAN.png, Lokseva_Udyam.pdf
Then REPLY to VendorIQ's request email and attach: reply/Lokseva_Cancelled_Cheque.png
```
