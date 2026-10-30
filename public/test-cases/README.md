# VendorIQ test cases

Each folder holds the documents for one vendor and a **HOW-TO-TEST.md** with the steps, the values to type and the expected result.
All companies, IDs and account numbers are fictional; IFSC and PIN codes are real so the live lookups work.

**Before you start**
- **Use your own email address as the contact email** (on the portal: *Send the vendor emails to*, in the Google Form: *Contact email*; for email cases you send from your own account anyway). Emails go to the address on the application, and the fictional addresses in these files may belong to real domains.
- Run each vendor **once**. Submitting the same vendor again is caught as *May already be a vendor* — a valid test of duplicate detection, but not the result described here.
- Reminders come every 2 minutes (demo timing; 1–2 days in real use).

## Edge cases — things that must be caught

| Case | Vendor | Channel | Expected |
|---|---|---|---|
| [E1-shared-bank-account](./E1-shared-bank-account/HOW-TO-TEST.md) | Meridian Office Solutions Pvt Ltd | Portal | **Rejected** automatically: *Bank account used by another vendor*. |
| [E2-sister-company-gst](./E2-sister-company-gst/HOW-TO-TEST.md) | Northstar Industrial Supplies Pvt Ltd | Portal | **Needs your decision**: *GSTIN belongs to another company* and *Company name doesn't match documents*. |
| [E3-doctored-cheque](./E3-doctored-cheque/HOW-TO-TEST.md) | Lakshmi Engineering Works Pvt Ltd | Portal | **Needs your decision**: *Cheque bank ≠ IFSC bank* and *Document edited in image software*. |
| [E4-wrong-document](./E4-wrong-document/HOW-TO-TEST.md) | Kaveri Freight and Logistics Pvt Ltd | Portal | **Waiting for vendor** → after you upload the cheque → **Approved**. |
| [E5-vendor-never-replies](./E5-vendor-never-replies/HOW-TO-TEST.md) | Bluewave Technologies Pvt Ltd | Portal | **Waiting for vendor** → reminder 1 (~2 min) → reminder 2 (~4 min) → flagged **No reply** (~6 min). |
| [E6-msme-category-mismatch](./E6-msme-category-mismatch/HOW-TO-TEST.md) | Pragati Polymers Pvt Ltd | Portal | **Needs your decision**: *MSME category doesn't match certificate* (it decides the payment terms). |

## Examples to try — normal vendors, every channel

| Case | Vendor | Channel | Expected |
|---|---|---|---|
| [X1-clean-company-msme](./X1-clean-company-msme/HOW-TO-TEST.md) | Shreeji Precision Components Pvt. Ltd. | Portal | **Approved**, with the conditions *confirm bank ownership before first payment* and *pay within 45 days (MSME)*. |
| [X2-proprietor](./X2-proprietor/HOW-TO-TEST.md) | Anjali Print Solutions | Portal | **Approved** under proprietorship rules. |
| [X3-partnership-google-form](./X3-partnership-google-form/HOW-TO-TEST.md) | Riverside Traders | Google Form | **Approved**, with a *Google Form* tag on the vendor. |
| [X4-email-then-confirm](./X4-email-then-confirm/HOW-TO-TEST.md) | Lokseva Pashukhadya Private Limited | Email | **Waiting for vendor** (confirm + cheque) → after step 3 → **Approved**. |
| [X5-email-reply-with-cheque](./X5-email-reply-with-cheque/HOW-TO-TEST.md) | Sahyadri Castings Private Limited | Email | **Waiting for vendor** → reply with cheque → **Waiting** (confirm only) → **Approved**. |

## Already in the system (for context)
Apex Facility Services, Sai Krupa Fabricators, Deccan Agro Equipments and Murugan Electricals (approved), Orion (rejected: cancelled GST)
and Vertex Packaging (waiting: GSTIN typo) are loaded as history. E1 depends on Apex being approved.

To rebuild this folder after changing the fixtures: `python scripts/generate_fixtures.py && python scripts/build_test_cases.py`
