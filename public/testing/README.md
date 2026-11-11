# Testing kit: ten cases for all three channels

Datasets: **A** happy path, **B** realistic variations (robustness), **C** adversarial and edge cases. Every name, ID and account number is fictional. Each folder has its documents and a `HOW-TO-TEST.md` with the exact steps, the values to type, the expected result and what counts as a failure.

| Case | Dataset | Channel | What it tests | Expected |
|---|---|---|---|---|
| [T01](./T01-A-happy-path-email/HOW-TO-TEST.md) | A: Happy path | Email | Complete, consistent vendor with MSME certificate | Waiting (confirm) → Approved, 45-day condition |
| [T02](./T02-B-skewed-lowres-poor-light-portal/HOW-TO-TEST.md) | B: Realistic variations | Portal | Skewed scans, low resolution, poor lighting | Approved with low-confidence notes, or Needs attention naming the unclear field |
| [T03](./T03-B-formatting-layouts-form/HOW-TO-TEST.md) | B: Realistic variations | Google Form | Capitalisation, formatting, other layouts, missing optional fields | Approved (all variations normalised) |
| [T04](./T04-B-hindi-english-layouts-portal/HOW-TO-TEST.md) | B: Realistic variations | Portal | Hindi and English documents, different layouts | Approved (bank ownership condition) |
| [T05](./T05-C-wrong-document-portal/HOW-TO-TEST.md) | C: Adversarial | Portal | Wrong document uploaded (PAN card in the GST slot) | Waiting for vendor (GST certificate) → Approved after resubmission |
| [T06](./T06-C-sister-company-gstin-email/HOW-TO-TEST.md) | C: Adversarial | Email | Sister-company GSTIN with a near-identical name | Waiting (confirm) → Needs attention (GSTIN belongs to another PAN) |
| [T07](./T07-C-duplicate-bank-account-form/HOW-TO-TEST.md) | C: Adversarial | Google Form | Bank account already registered to another vendor | Rejected (account belongs to Sai Krupa Fabricators) |
| [T08](./T08-C-edited-files-annotations-portal/HOW-TO-TEST.md) | C: Adversarial | Portal | Edited-file metadata and handwritten annotations | Needs attention (two file-origin flags); annotations do not break the reading |
| [T09](./T09-C-transposed-digits-form/HOW-TO-TEST.md) | C: Adversarial | Google Form | Transposed digits in a typed identifier | Needs attention (PAN conflict with evidence) |
| [T10](./T10-C-conflicting-names-email/HOW-TO-TEST.md) | C: Adversarial | Email | Company name differs across documents | Waiting (confirm) → Needs attention (name conflicts) |

Coverage of the list you asked for:

| Test | Case |
|---|---|
| Complete details, correct documents, matching identifiers, valid bank information, consistent company details | T01 |
| Different PDF layouts, different document layouts | T03, T04 |
| Low-resolution images, skewed scans, poor lighting | T02 |
| Different capitalisation, minor formatting variations, missing optional fields | T03 |
| Multiple languages | T04 |
| Wrong document uploaded | T05 |
| Sister-company GSTIN | T06 |
| Duplicate bank account, duplicate records | T07 (and the replay test below) |
| Modified document metadata, handwritten annotations | T08 |
| Transposed identifier digits | T09 |
| Mismatched company names, conflicting information | T06, T10 |
| Missing fields | T03 (optional fields), T05 (a document that must be resent) |

## Before you test
1. Press **Wake up** on Overview (top right) and wait until every row is green.
2. Use **your own email** as the contact email, so the system's emails reach you.
3. Each vendor can be run **once**. A second run is caught as an existing vendor, which is itself a test (see the replay test below).
4. Where to read the result: **All vendors**, open the vendor, then the **Checks** tab (each check shows the evidence) and the **Emails to vendors** page for what was sent.

## Replay test: duplicate records
After T01 has been **Approved**, submit the **same documents again**, this time through the **portal** (use T01's PAN and GSTIN, and a different contact email).
**Expected:** **Needs attention**, with the check *Not an existing vendor*: a vendor with the same PAN or GSTIN is already approved, so a person decides whether it is a duplicate or a change request.
(An email application first asks for confirmation; the portal gives the result directly.)

## Rules of thumb for reading results
- An **email** application always passes through *Waiting for vendor (confirm details)* first; the flags that need the confirmed values appear after you confirm.
- **Needs attention** means a person must decide: it is the expected outcome for ambiguous or suspicious cases, never a failure of the system.
- **Rejected** appears only for disqualifying facts (a bank account registered to another company, a cancelled GST registration).
