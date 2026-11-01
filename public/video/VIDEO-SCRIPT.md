# VendorIQ: 5-minute video script

Live site: https://zamp-prep.vercel.app
Total: 5:00. Speak at a calm pace (about 140 words a minute). Lines in **bold quotes** are what you say; lines in brackets are what is on screen.
Every case below uses the files in this folder. Prepare everything in [README.md](./README.md) before you press record.

| Time | Part | Length |
|---|---|---|
| 0:00 | 1. The problem | 0:30 |
| 0:30 | 2. The solution | 0:30 |
| 1:00 | 3. Portal walkthrough (company and supplier) | 1:00 |
| 2:00 | 4. Happy path: Sundaram, through the supplier portal | 1:00 |
| 3:00 | 5. Edge case 1: Himalaya, by email | 1:00 |
| 4:00 | 6. Edge case 2: Bhavani, by Google Form | 0:40 |
| 4:40 | 7. Close | 0:20 |

---

## 1. The problem (0:00 to 0:30)
[Screen: a plain slide or the login page. Face camera if you like.]

**"Every company that buys from many suppliers has the same problem. A new vendor sends their documents by email, a form or a portal. Someone then reads each one by hand, checks the GST number, the PAN, the bank account, and chases the vendor for whatever is missing.**
**It is slow. And it is risky, because the worst mistakes are quiet ones: a GST certificate that belongs to a sister company, or a bank account that already belongs to another vendor. That is how payments get diverted."**

## 2. The solution (0:30 to 1:00)
[Screen: the login page. Slowly point at the left panel, which lists the four outcomes.]

**"This is VendorIQ, built for Acme Manufacturing. Vendors can apply three ways: the supplier portal, a Google Form, or just an email with attachments. AI reads the documents. Written rules do the checking: the format and check digit of every ID, and whether the documents agree with each other.**
**Every application ends in one of four outcomes: approved, waiting for the vendor, needs attention from a person, or rejected, always with the reason and the evidence. The AI reads. The rules decide. People handle the unclear cases."**

## 3. Portal walkthrough (1:00 to 2:00)
[Screen: sign in. Show the two cards: Company portal and Supplier portal.]

**"There are two portals. The company portal is for Acme's procurement team."**

[Click Continue as Avishkar Chavan. Land on Overview. 8 seconds.]
**"The overview shows how many applications came in, how many wait on a vendor, how many need a person, and which channel they came from."** [Point at the donut.]

[Click All vendors. Then the Activity log tab. 8 seconds.]
**"All vendors lists everyone. The activity log shows what happened and when, down to the second, so every decision can be traced."**

[Click Needs attention. 6 seconds.]
**"Needs attention is the team's task list. It only holds work for a person, and it shrinks as they act."**

[Click Emails to vendors. Click How follow-ups work (pop-up), then Compose email. 10 seconds.]
**"Every email the system sends is here. Follow-ups and reminders go out automatically, and you can also write, edit and send his own."**

[Click Info. Scroll once. 4 seconds.]
**"And the Info page lists the rules in plain words."**

[Sign out. Pick Supplier portal, click one supplier from the list. 12 seconds. Show the sidebar: Supplier portal, Become a supplier, Notifications.]
**"The supplier portal is what a vendor sees: where their application stands, exactly what is missing, and Notifications. Every email we send also appears here as a short note."**

## 4. Happy path: Sundaram, through the supplier portal (2:00 to 3:00)
Folder: `1-happy-path-portal-sundaram`. Be signed in to the Company portal in the same browser first, so the sample-fill tool shows.

[Screen: supplier portal, Become a supplier, then Apply on the portal.]
**"First, a normal vendor. Sundaram Auto Components, a company in Coimbatore, applies through the portal."**

[Use the fill tool: Private limited, MSME Small. Fields and all five documents fill at once. Change the contact email to your own. Press Submit. 15 seconds. Cut here if it feels slow.]
**"I have pre-filled the form to save time. Normally the vendor types this and attaches four or five documents."**

[Run page opens: the stages tick through live. 20 seconds.]
**"Now the pipeline runs live. It reads each document, validates the PAN, the GSTIN and its check digit, the bank code, the pincode against the state, compares every document against the others, and applies the policy."**

[Result: Approved. Open the vendor: checks list, ERP vendor record. 15 seconds.]
**"Approved in about a minute, with no human involved. Because Sundaram is a registered Small enterprise, the system adds a condition: pay within 45 days. And because a cheque cannot prove who owns the account, it adds: confirm bank ownership before the first payment. An ERP vendor record is ready."**

[Switch to the supplier portal, Notifications. 10 seconds.]
**"And the supplier gets the approval by email and as a notification in their portal."**

## 5. Edge case 1: Himalaya, by email (3:00 to 4:00)
Folder: `2-edge-case-email-himalaya`. Have the Gmail draft ready (see README), so you only press Send.

[Screen: Gmail. The draft has four attachments and no cheque.]
**"Edge case one: a vendor who skips the form and just emails documents. Himalaya Herbal Extracts sends four files. Notice there is no bank cheque."**

[Press Send. Switch to All vendors. Wait for the new row (about a minute; cut the wait in editing). 10 seconds.]
**"Within a minute the inbox picks it up. The system sorts each attachment into the right document type, and builds the application from the documents themselves."**

[Open the vendor: Email tag, Waiting for vendor, the requested items. Then Emails to vendors. 15 seconds.]
**"It does not reject. It sees that the bank proof is missing and that the details were read from documents, not typed by the vendor. So it asks for exactly two things: send the cheque, and confirm these details. That email went out automatically, with a link."**

[Open the supplier portal as Himalaya: the Action needed card and the notification. 8 seconds.]
**"The supplier sees the same request in their portal."**

[Open the link from the email. Details are pre-filled. Upload send-later/Himalaya_Cancelled_Cheque.png. Press Confirm. Approved. 17 seconds.]
**"They confirm, attach the cheque, and the full checks run again. Approved. If they never replied, reminders go out every one to two days and the vendor is flagged as unresponsive for the team."**

## 6. Edge case 2: Bhavani, by Google Form (4:00 to 4:40)
Folder: `3-edge-case-google-form-bhavani`. Use the pre-filled Google Form link from the README.

[Screen: the Google Form, already filled except the four uploads. Upload the four files. Submit. Cut to the console. 12 seconds.]
**"Edge case two: the Google Form. Bhavani Dyes and Intermediates looks fine. The documents are consistent and the IDs are valid."**

[All vendors: the Bhavani row with the Google Form tag, status Rejected. Open it. Point at the red check. 18 seconds.]
**"But the GST registration has been cancelled. The system checks the GSTIN against the registry, not just its format, so a certificate that looks real but is no longer valid is caught. A cancelled registration means we cannot buy from them legally, so it is rejected automatically, with the reason shown."**

[Point at Emails to vendors: nothing was sent. 6 seconds.]
**"Notice nothing was emailed. Rejections never go out automatically. A person tells the vendor."**

[Optional, 4 seconds: supplier portal for Bhavani shows "With our team".]

## 7. Close (4:40 to 5:00)
[Screen: Overview, then the Info page.]

**"Three channels, one pipeline. AI for reading, written rules for deciding, people for the unclear. Everything is logged and every rejection is explained.**
**In production I would connect the government GST, PAN and bank-verification services, and add a one-time code for supplier sign-in. Thank you."**

---

## Extra edge case (spare, if you have time): Rajputana, by email, doctored cheque
Folder: `4-edge-case-email-rajputana`. It will not fit in five minutes with the other three; use it instead of Himalaya for a "risk" story, or as a second take.

[Gmail: send the email with all four attachments. Open All vendors when the row appears. Open the link in the email and press Confirm. Then Needs attention.]
**"A different kind of email edge case. This vendor sends a complete set, but look at the cheque: it prints HDFC Bank, while the IFSC code belongs to ICICI, and the file was saved from Photoshop. Neither is proof of fraud, so the system does not reject. It puts the vendor in Needs attention with both findings side by side, and a person decides."**

## Extra edge case (spare): Malabar, by Google Form, wrong document then fixed
Folder: `5-edge-case-google-form-malabar`. Use it instead of Bhavani if you prefer a "fix and approve" story over a rejection.

[Google Form: attach the four files, including `Malabar_Scan_0412.pdf` in the PAN field. Submit. Open All vendors, then the vendor: Waiting for vendor, "the file in this slot is a GST certificate, not a PAN card". Open the link from the email, upload `send-later/Malabar_PAN_Card.png`, submit. Approved.]
**"A vendor made an honest mistake: in the PAN field they attached the GST certificate again. The system reads what each file actually is, not what the slot says. It does not reject. It asks for exactly one thing, the PAN card, with a link. The vendor uploads it, only the PAN checks re-run, and the application is approved."**


## If you run long (cut in this order)
1. The Info sentence in the walkthrough.
2. The supplier portal check in the Himalaya case.
3. The optional Bhavani supplier-portal line.

## Words to avoid on camera
Say "sample vendor", not "demo". Say "Needs attention", not "Needs your decision" (the old name). Say "reminders every one to two days"; the two-minute timing is only for testing.
