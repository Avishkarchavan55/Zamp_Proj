"""
Generates synthetic vendor onboarding documents for VendorIQ demos and tests.

Every company, PAN, GSTIN, CIN and account number here is fictional. Each document carries a
"SYNTHETIC TEST DOCUMENT" footer. IFSC codes are real branch codes so the live IFSC lookup works.

Outputs:
  public/demo/<scenario>/...        documents a vendor would upload
  public/demo/scenarios.json        form data + file list per scenario (used by "Load demo scenario")
  fixtures/truth.json               ground-truth extraction per file sha256 (EXTRACTOR=fixture test mode)
  fixtures/gst_registry.json        sandbox GST registry records

Run:  python scripts/generate_fixtures.py
"""

import hashlib
import io
import json
import os
import random
import shutil

from PIL import Image, ImageDraw, ImageFilter, ImageFont
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(ROOT, "public", "demo")
FIXTURES = os.path.join(ROOT, "fixtures")
FONT_DIR = "C:/Windows/Fonts"

random.seed(7)

# --------------------------------------------------------------------------------------------
# Identifier helpers
# --------------------------------------------------------------------------------------------

GST_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"


def gstin_checksum(first14: str) -> str:
    total = 0
    for i, ch in enumerate(first14):
        product = GST_CHARS.index(ch) * (1 if i % 2 == 0 else 2)
        total += product // 36 + product % 36
    return GST_CHARS[(36 - total % 36) % 36]


def gstin(state_code: str, pan: str, entity_no: str = "1") -> str:
    base = f"{state_code}{pan}{entity_no}Z"
    return base + gstin_checksum(base)


def font(name: str, size: int):
    return ImageFont.truetype(os.path.join(FONT_DIR, name), size)


ORDINAL_DAYS = {
    1: "First", 2: "Second", 3: "Third", 4: "Fourth", 5: "Fifth", 6: "Sixth", 7: "Seventh", 8: "Eighth",
    9: "Ninth", 10: "Tenth", 11: "Eleventh", 12: "Twelfth", 13: "Thirteenth", 14: "Fourteenth",
    15: "Fifteenth", 16: "Sixteenth", 17: "Seventeenth", 18: "Eighteenth", 19: "Nineteenth",
    20: "Twentieth", 21: "Twenty-first", 22: "Twenty-second", 23: "Twenty-third", 24: "Twenty-fourth",
    25: "Twenty-fifth", 26: "Twenty-sixth", 27: "Twenty-seventh", 28: "Twenty-eighth",
    29: "Twenty-ninth", 30: "Thirtieth", 31: "Thirty-first",
}
MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September",
          "October", "November", "December"]
YEAR_WORDS = {2014: "Two thousand fourteen", 2015: "Two thousand fifteen", 2016: "Two thousand sixteen", 2017: "Two thousand seventeen",
              2018: "Two thousand eighteen", 2019: "Two thousand nineteen", 2020: "Two thousand twenty",
              2021: "Two thousand twenty-one", 2022: "Two thousand twenty-two"}

# --------------------------------------------------------------------------------------------
# Vendors
# --------------------------------------------------------------------------------------------

VENDORS = {
    "shreeji": dict(
        legal_name="SHREEJI PRECISION COMPONENTS PRIVATE LIMITED",
        form_name="Shreeji Precision Components Pvt. Ltd.",
        trade_name="", entity_type="private_limited",
        pan="AAKCS4471M", state_code="27", cin="U29299MH2019PTC324118", inc_date=(12, 3, 2019),
        address="Plot No. 47, MIDC Bhosari", city="Pune", state="Maharashtra", pincode="411026",
        contact_name="Priya Deshmukh", contact_email="accounts@shreejiprecision.in", contact_phone="+91 98220 41733",
        owner_name="Rajesh Kulkarni", website="shreejiprecision.in", category="CNC machined components",
        ifsc="HDFC0000103", bank="HDFC BANK", branch="PUNE - FERGUSSON COLLEGE ROAD",
        account="50200041187623", cheque_name="SHREEJI PRECISION COMPONENTS PVT LTD", micr="411240003",
    ),
    "kaveri": dict(
        legal_name="KAVERI FREIGHT & LOGISTICS PRIVATE LIMITED",
        form_name="Kaveri Freight and Logistics Pvt Ltd",
        trade_name="", entity_type="private_limited",
        pan="AAHCK8812F", state_code="29", cin="U63030KA2016PTC094512", inc_date=(4, 8, 2016),
        address="No. 18, 2nd Cross, Peenya Industrial Area Phase 2", city="Bengaluru", state="Karnataka",
        pincode="560058", contact_name="Arjun Rao", contact_email="finance@kaverilogistics.in",
        contact_phone="+91 98451 22094", owner_name="Meera Iyengar", website="kaverilogistics.in",
        category="Inbound freight & warehousing",
        ifsc="HDFC0000053", bank="HDFC BANK", branch="BANGALORE - KORAMANGALAM",
        account="50100213378541", cheque_name="KAVERI FREIGHT & LOGISTICS PVT LTD", micr="560240004",
    ),
    "northstar": dict(
        legal_name="NORTHSTAR INDUSTRIAL SUPPLIES PRIVATE LIMITED",
        form_name="Northstar Industrial Supplies Pvt Ltd",
        trade_name="", entity_type="private_limited",
        pan="AAECN4821K", state_code="24", cin="U51909GJ2017PTC098761", inc_date=(21, 6, 2017),
        address="Shed 12, GIDC Vatva Phase 4", city="Ahmedabad", state="Gujarat", pincode="382445",
        contact_name="Kunal Shah", contact_email="kunal.shah@northstarsupplies.in", contact_phone="+91 99250 66173",
        owner_name="Hitesh Patel", website="northstarsupplies.in", category="Industrial safety supplies",
        ifsc="UTIB0000080", bank="AXIS BANK", branch="MANINAGAR",
        account="917020045566102", cheque_name="NORTHSTAR INDUSTRIAL SUPPLIES PVT LTD", micr="380211005",
        # The GST certificate belongs to a sister company with a near-identical name.
        gst_legal_name="NORTHSTAR INDUSTRIAL SOLUTIONS PRIVATE LIMITED", gst_pan="AAFCN7310M",
    ),
    "meridian": dict(
        legal_name="MERIDIAN OFFICE SOLUTIONS PRIVATE LIMITED",
        form_name="Meridian Office Solutions Pvt Ltd",
        trade_name="", entity_type="private_limited",
        pan="AAJCM6390Q", state_code="36", cin="U74999TG2020PTC141207", inc_date=(9, 1, 2020),
        address="Unit 304, Cyber Pearl, HITEC City", city="Hyderabad", state="Telangana", pincode="500081",
        contact_name="Sameer Reddy", contact_email="meridian.office.sol@gmail.com", contact_phone="+91 90004 81726",
        owner_name="Sameer Reddy", website="", category="Office supplies & facility consumables",
        # Same account as Apex Facility Services (an existing approved vendor).
        ifsc="SBIN0000847", bank="STATE BANK OF INDIA", branch="HYDERABAD MAIN",
        account="38291045672", cheque_name="MERIDIAN OFFICE SOLUTIONS PVT LTD", micr="500002003",
    ),
    "apex": dict(
        legal_name="APEX FACILITY SERVICES PRIVATE LIMITED",
        form_name="Apex Facility Services Private Limited",
        trade_name="", entity_type="private_limited",
        pan="AAFCA2210J", state_code="36", cin="U74900TG2015PTC099884", inc_date=(17, 11, 2015),
        address="5-9-22, Adarsh Nagar", city="Hyderabad", state="Telangana", pincode="500063",
        contact_name="Lakshmi Narayana", contact_email="billing@apexfacility.co.in", contact_phone="+91 98490 33187",
        owner_name="Lakshmi Narayana", website="apexfacility.co.in", category="Facility management",
        ifsc="SBIN0000847", bank="STATE BANK OF INDIA", branch="HYDERABAD MAIN",
        account="38291045672", cheque_name="APEX FACILITY SERVICES PVT LTD", micr="500002003",
    ),
    "vertex": dict(
        legal_name="VERTEX PACKAGING PRIVATE LIMITED",
        form_name="Vertex Packaging Private Limited",
        trade_name="", entity_type="private_limited",
        pan="AAGCV5530D", state_code="27", cin="U21012MH2018PTC311470", inc_date=(2, 2, 2018),
        address="Gala 9, Vasant Industrial Estate, Andheri East", city="Mumbai", state="Maharashtra",
        pincode="400093", contact_name="Neha Joshi", contact_email="accounts@vertexpack.in",
        contact_phone="+91 98670 11425", owner_name="Anil Mehta", website="vertexpack.in",
        category="Corrugated packaging",
        ifsc="ICIC0000004", bank="ICICI BANK", branch="MUMBAI NARIMAN POINT",
        account="000405021876", cheque_name="VERTEX PACKAGING PVT LTD", micr="400229002",
    ),
    "murugan": dict(
        legal_name="MURUGAN SELVARAJ", form_name="Murugan Electricals",
        trade_name="MURUGAN ELECTRICALS", entity_type="proprietorship",
        pan="BXRPS5521K", state_code="33", cin="", inc_date=None,
        address="14, Ranganathan Street, T. Nagar", city="Chennai", state="Tamil Nadu", pincode="600017",
        contact_name="Murugan Selvaraj", contact_email="muruganelectricals.tn@gmail.com",
        contact_phone="+91 94440 26718", owner_name="Murugan Selvaraj", website="",
        category="Electrical maintenance services",
        ifsc="ICIC0000009", bank="ICICI BANK", branch="CHENNAI NUNGAMBAKKAM",
        account="602105500318", cheque_name="MURUGAN ELECTRICALS", micr="600229003",
        dob="14/07/1981", father="SELVARAJ KANDASAMY",
    ),
    "saikrupa": dict(
        legal_name="SAI KRUPA FABRICATORS PRIVATE LIMITED",
        form_name="Sai Krupa Fabricators Pvt. Ltd.",
        trade_name="", entity_type="private_limited",
        pan="AAKCS9017B", state_code="27", cin="U28110MH2021PTC356092", inc_date=(23, 9, 2021),
        address="Plot F-31, MIDC Ambad", city="Nashik", state="Maharashtra", pincode="422010",
        contact_name="Vikram Pawar", contact_email="accounts@saikrupafab.in", contact_phone="+91 97660 21854",
        owner_name="Vikram Pawar", website="saikrupafab.in", category="Sheet metal fabrication",
        ifsc="ICIC0000027", bank="ICICI BANK", branch="NASHIK",
        account="002705018342", cheque_name="SAI KRUPA FABRICATORS PVT LTD", micr="422229002",
    ),
    "bluewave": dict(
        legal_name="BLUEWAVE TECHNOLOGIES PRIVATE LIMITED",
        form_name="Bluewave Technologies Pvt Ltd",
        trade_name="", entity_type="private_limited",
        pan="AAJCB3326H", state_code="29", cin="U72900KA2019PTC127745", inc_date=(5, 4, 2019),
        address="3rd Floor, 80 Feet Road, Indiranagar", city="Bengaluru", state="Karnataka", pincode="560038",
        contact_name="Ananya Krishnan", contact_email="vendor-ops@bluewavetech.in", contact_phone="+91 99001 77432",
        owner_name="Rahul Menon", website="bluewavetech.in", category="IT services & AMC",
        ifsc="KKBK0000431", bank="KOTAK MAHINDRA BANK", branch="BANGALORE - INDIRANAGAR",
        account="4612098735", cheque_name="BLUEWAVE TECHNOLOGIES PVT LTD", micr="560485002",
    ),
    "orion": dict(
        legal_name="ORION SPECIALTY CHEMICALS PRIVATE LIMITED",
        form_name="Orion Specialty Chemicals Pvt Ltd",
        trade_name="", entity_type="private_limited",
        pan="AAFCO6612R", state_code="24", cin="U24100GJ2016PTC093315", inc_date=(30, 5, 2016),
        address="Plot 118, GIDC Makarpura", city="Vadodara", state="Gujarat", pincode="390010",
        contact_name="Dhruv Trivedi", contact_email="accounts@orionspecialty.in", contact_phone="+91 98250 44906",
        owner_name="Dhruv Trivedi", website="orionspecialty.in", category="Industrial solvents",
        ifsc="UTIB0000080", bank="AXIS BANK", branch="MANINAGAR",
        account="916020078812240", cheque_name="ORION SPECIALTY CHEMICALS PVT LTD", micr="380211005",
    ),
    "deccan": dict(
        legal_name="DECCAN AGRO EQUIPMENTS PRIVATE LIMITED",
        form_name="Deccan Agro Equipments Pvt Ltd",
        trade_name="", entity_type="private_limited",
        pan="AAHCD7745N", state_code="27", cin="U29219MH2017PTC298850", inc_date=(14, 12, 2017),
        address="Survey No. 212, Chakan Industrial Area", city="Pune", state="Maharashtra", pincode="410501",
        contact_name="Sneha Patil", contact_email="sneha.patil@deccanagro.in", contact_phone="+91 98810 66251",
        owner_name="Mahesh Jadhav", website="deccanagro.in", category="Agricultural machinery parts",
        ifsc="KKBK0000721", bank="KOTAK MAHINDRA BANK", branch="PUNE",
        account="7311452268", cheque_name="DECCAN AGRO EQUIPMENTS PVT LTD", micr="411485002",
    ),
    # E7: cheque prints HDFC but the IFSC belongs to ICICI; image saved from Photoshop.
    "lakshmi": dict(
        legal_name="LAKSHMI ENGINEERING WORKS PRIVATE LIMITED",
        form_name="Lakshmi Engineering Works Pvt Ltd",
        trade_name="", entity_type="private_limited",
        pan="AAECL6624P", state_code="27", cin="U29100MH2018PTC309982", inc_date=(11, 7, 2018),
        address="Plot C-12, MIDC Satpur", city="Nashik", state="Maharashtra", pincode="422007",
        contact_name="Ravi Kulkarni", contact_email="accounts@lakshmiengg.in", contact_phone="+91 98230 55871",
        owner_name="Ravi Kulkarni", website="lakshmiengg.in", category="Hydraulic fittings",
        ifsc="ICIC0000027", bank="HDFC BANK", branch="NASHIK",
        account="50100388412907", cheque_name="LAKSHMI ENGINEERING WORKS PVT LTD", micr="422240002",
        cheque_software="Adobe Photoshop 25.0 (Windows)",
    ),
    # E8: declares Micro, the Udyam certificate says Medium.
    "pragati": dict(
        legal_name="PRAGATI POLYMERS PRIVATE LIMITED",
        form_name="Pragati Polymers Pvt Ltd",
        trade_name="", entity_type="private_limited",
        pan="AAHCP3381E", state_code="24", cin="U25209GJ2014PTC081146", inc_date=(3, 3, 2014),
        address="Plot 54, GIDC Naroda", city="Ahmedabad", state="Gujarat", pincode="382330",
        contact_name="Jignesh Desai", contact_email="purchase@pragatipolymers.in", contact_phone="+91 98252 71104",
        owner_name="Jignesh Desai", website="pragatipolymers.in", category="HDPE containers",
        ifsc="UTIB0000080", bank="AXIS BANK", branch="MANINAGAR",
        account="915020034418871", cheque_name="PRAGATI POLYMERS PVT LTD", micr="380211005",
        udyam="UDYAM-GJ-01-0048213", msme_declared="Micro", msme_cert="Medium",
    ),
    # Email-intake demo vendor: sends documents by email instead of using the portal.
    "sahyadri": dict(
        legal_name="SAHYADRI CASTINGS PRIVATE LIMITED",
        form_name="Sahyadri Castings Private Limited",
        trade_name="", entity_type="private_limited",
        pan="AAKCS2208H", state_code="27", cin="U27100MH2016PTC284477", inc_date=(19, 10, 2016),
        address="Gat No. 118, Kharabwadi, Chakan", city="Pune", state="Maharashtra", pincode="410501",
        contact_name="Amit Bhosale", contact_email="amit.bhosale@sahyadricastings.in", contact_phone="+91 98901 22457",
        owner_name="Amit Bhosale", website="sahyadricastings.in", category="Grey iron castings",
        ifsc="KKBK0000721", bank="KOTAK MAHINDRA BANK", branch="PUNE",
        account="9412287730", cheque_name="SAHYADRI CASTINGS PVT LTD", micr="411485002",
        udyam="UDYAM-MH-26-0071952", msme_declared="Small", msme_cert="Small",
    ),
}
VENDORS["shreeji"].update(udyam="UDYAM-MH-26-0012345", msme_declared="Micro", msme_cert="Micro")

for v in VENDORS.values():
    v["gstin"] = gstin(v["state_code"], v.get("gst_pan", v["pan"]))
    v.setdefault("gst_legal_name", v["legal_name"])

# --------------------------------------------------------------------------------------------
# Document renderers
# --------------------------------------------------------------------------------------------

FOOTER = "SYNTHETIC TEST DOCUMENT - fictional entity generated for VendorIQ demo. Not a government record."


def _footer(c: canvas.Canvas):
    c.setFont("Helvetica-Oblique", 7)
    c.setFillColor(HexColor("#888888"))
    c.drawCentredString(A4[0] / 2, 12 * mm, FOOTER)
    c.setFillColor(HexColor("#000000"))


def _wrap(c, text, x, y, width, font_name="Times-Roman", size=11, leading=15):
    c.setFont(font_name, size)
    words, line = text.split(), ""
    for w in words:
        trial = (line + " " + w).strip()
        if c.stringWidth(trial, font_name, size) > width:
            c.drawString(x, y, line)
            y -= leading
            line = w
        else:
            line = trial
    if line:
        c.drawString(x, y, line)
        y -= leading
    return y


def incorporation_pdf(v) -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    w, h = A4
    c.setStrokeColor(HexColor("#1f3b6e"))
    c.setLineWidth(2)
    c.rect(14 * mm, 20 * mm, w - 28 * mm, h - 34 * mm)
    c.setFont("Times-Bold", 13)
    c.drawCentredString(w / 2, h - 32 * mm, "GOVERNMENT OF INDIA")
    c.setFont("Times-Roman", 11)
    c.drawCentredString(w / 2, h - 38 * mm, "MINISTRY OF CORPORATE AFFAIRS")
    c.drawCentredString(w / 2, h - 44 * mm, "Central Registration Centre")
    c.setFont("Times-Bold", 18)
    c.drawCentredString(w / 2, h - 60 * mm, "Certificate of Incorporation")
    c.setFont("Times-Italic", 9)
    c.drawCentredString(w / 2, h - 67 * mm,
                        "[Pursuant to sub-section (2) of section 7 and sub-section (1) of section 8 of the Companies Act, 2013")
    c.drawCentredString(w / 2, h - 71 * mm, "(18 of 2013) and rule 18 of the Companies (Incorporation) Rules, 2014]")
    d, m, y = v["inc_date"]
    body = (f"I hereby certify that {v['legal_name']} is incorporated on this {ORDINAL_DAYS[d]} day of "
            f"{MONTHS[m - 1]} {YEAR_WORDS[y]} under the Companies Act, 2013 (18 of 2013) and that the company is "
            f"limited by shares.")
    yy = _wrap(c, body, 26 * mm, h - 88 * mm, w - 52 * mm, size=12, leading=17)
    yy -= 6
    yy = _wrap(c, f"The Corporate Identity Number of the company is {v['cin']}.", 26 * mm, yy, w - 52 * mm, size=12)
    yy -= 4
    yy = _wrap(c, f"The Permanent Account Number (PAN) of the company is {v['pan']}.", 26 * mm, yy, w - 52 * mm, size=12)
    yy -= 4
    tan = v["pan"][:4] + "0" + str(random.randint(1000, 9999)) + v["pan"][-1]
    yy = _wrap(c, f"The Tax Deduction and Collection Account Number (TAN) of the company is {tan}.", 26 * mm, yy,
               w - 52 * mm, size=12)
    yy -= 10
    yy = _wrap(c, f"Given under my hand at Manesar this {ORDINAL_DAYS[d]} day of {MONTHS[m - 1]} {y}.",
               26 * mm, yy, w - 52 * mm, size=12)
    c.setFont("Times-Bold", 11)
    c.drawRightString(w - 26 * mm, yy - 30, "Registrar of Companies")
    c.setFont("Times-Roman", 10)
    c.drawRightString(w - 26 * mm, yy - 44, "For and on behalf of the Jurisdictional Registrar of Companies")
    c.drawRightString(w - 26 * mm, yy - 57, "Central Registration Centre")
    c.setFont("Times-Bold", 10)
    c.drawString(26 * mm, 52 * mm, "Mailing Address as per record available in Registrar of Companies office:")
    c.setFont("Times-Roman", 10)
    c.drawString(26 * mm, 46 * mm, v["legal_name"])
    c.drawString(26 * mm, 41 * mm, f"{v['address']}, {v['city']}, {v['state']}, India - {v['pincode']}")
    _footer(c)
    c.showPage()
    c.save()
    return buf.getvalue()


def gst_pdf(v) -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    w, h = A4
    c.setFont("Helvetica-Bold", 12)
    c.drawCentredString(w / 2, h - 22 * mm, "Government of India")
    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(w / 2, h - 30 * mm, "Form GST REG-06")
    c.setFont("Helvetica", 9)
    c.drawCentredString(w / 2, h - 35 * mm, "[See Rule 10(1)]")
    c.setFont("Helvetica-Bold", 13)
    c.drawCentredString(w / 2, h - 44 * mm, "Registration Certificate")
    c.setFont("Helvetica-Bold", 11)
    c.drawString(20 * mm, h - 56 * mm, f"Registration Number : {v['gstin']}")

    constitution = "Proprietorship" if v["entity_type"] == "proprietorship" else "Private Limited Company"
    liability = v["inc_date"] or (1, 7, 2017)
    d, m, y = liability
    liab_year = max(y, 2017)
    rows = [
        ("1.", "Legal Name", v["gst_legal_name"]),
        ("2.", "Trade Name, if any", v["trade_name"] or v["gst_legal_name"]),
        ("3.", "Additional trade names, if any", "Not Applicable"),
        ("4.", "Constitution of Business", constitution),
        ("5.", "Address of Principal Place of Business",
         f"{v['address']}, {v['city']}, {v['state']}, {v['pincode']}"),
        ("6.", "Date of Liability", f"{d:02d}/{m:02d}/{liab_year}"),
        ("7.", "Date of Validity", "From  " + f"{d:02d}/{m:02d}/{liab_year}" + "   To  Not Applicable"),
        ("8.", "Type of Registration", "Regular"),
        ("9.", "Particulars of Approving Authority", "Centre - Superintendent, Range-II"),
    ]
    top = h - 64 * mm
    row_h = 13 * mm
    c.setLineWidth(0.6)
    for i, (num, label, value) in enumerate(rows):
        y0 = top - i * row_h
        c.rect(20 * mm, y0 - row_h, w - 40 * mm, row_h)
        c.line(30 * mm, y0, 30 * mm, y0 - row_h)
        c.line(95 * mm, y0, 95 * mm, y0 - row_h)
        c.setFont("Helvetica", 9.5)
        c.drawString(22 * mm, y0 - 8 * mm, num)
        c.drawString(32 * mm, y0 - 8 * mm, label)
        c.setFont("Helvetica-Bold" if i < 2 else "Helvetica", 9.5)
        if c.stringWidth(value, "Helvetica", 9.5) > (w - 40 * mm - 77 * mm):
            parts = value.split(", ")
            half = len(parts) // 2
            c.drawString(97 * mm, y0 - 5.5 * mm, ", ".join(parts[:half]) + ",")
            c.drawString(97 * mm, y0 - 10 * mm, ", ".join(parts[half:]))
        else:
            c.drawString(97 * mm, y0 - 8 * mm, value)
    yb = top - len(rows) * row_h - 12 * mm
    c.setFont("Helvetica", 9.5)
    c.drawString(20 * mm, yb, "Signature: Not Verified")
    c.drawString(20 * mm, yb - 6 * mm, "Digitally signed by DS GOODS AND SERVICES TAX NETWORK")
    c.drawString(20 * mm, yb - 12 * mm, f"Date of issue of Certificate: {d:02d}/{m:02d}/{liab_year}")
    c.setFont("Helvetica-Oblique", 8.5)
    c.drawString(20 * mm, yb - 22 * mm,
                 "Note: The registration certificate is required to be prominently displayed at all places of business in the State.")
    _footer(c)
    c.showPage()
    c.save()
    return buf.getvalue()


def pan_card_png(v) -> bytes:
    W, H = 1012, 638
    img = Image.new("RGB", (W, H), "#dfe9f2")
    d = ImageDraw.Draw(img)
    for x in range(0, W, 6):
        d.line([(x, 0), (x + 200, H)], fill="#d3e0ec", width=1)
    d.rectangle([0, 0, W, 92], fill="#0f4c81")
    d.text((30, 18), "INCOME TAX DEPARTMENT", font=font("arialbd.ttf", 34), fill="white")
    d.text((W - 300, 24), "GOVT. OF INDIA", font=font("arialbd.ttf", 30), fill="white")
    d.text((30, 112), "Permanent Account Number Card", font=font("arial.ttf", 24), fill="#1b2a3a")
    d.text((30, 146), v["pan"], font=font("arialbd.ttf", 46), fill="#111111")
    is_person = v["entity_type"] == "proprietorship"
    y = 232
    d.text((30, y), "Name", font=font("arial.ttf", 20), fill="#3c4a5a")
    # Shrink long names so they fit beside the photo box instead of being clipped.
    size = 30
    while size > 16 and d.textlength(v["legal_name"], font=font("arialbd.ttf", size)) > W - 290:
        size -= 1
    d.text((30, y + 26), v["legal_name"], font=font("arialbd.ttf", size), fill="#111111")
    y += 86
    if is_person:
        d.text((30, y), "Father's Name", font=font("arial.ttf", 20), fill="#3c4a5a")
        d.text((30, y + 26), v["father"], font=font("arialbd.ttf", 28), fill="#111111")
        y += 86
        d.text((30, y), "Date of Birth", font=font("arial.ttf", 20), fill="#3c4a5a")
        d.text((30, y + 26), v["dob"], font=font("arialbd.ttf", 28), fill="#111111")
    else:
        dd, mm_, yy = v["inc_date"]
        d.text((30, y), "Date of Incorporation/Formation", font=font("arial.ttf", 20), fill="#3c4a5a")
        d.text((30, y + 26), f"{dd:02d}/{mm_:02d}/{yy}", font=font("arialbd.ttf", 28), fill="#111111")
    # photo / QR placeholders
    d.rectangle([W - 230, 120, W - 40, 330], outline="#7a8a9a", width=3, fill="#eef3f8")
    d.text((W - 196, 212), "PHOTO" if is_person else "QR", font=font("arial.ttf", 26), fill="#7a8a9a")
    d.text((30, H - 44), "SYNTHETIC TEST DOCUMENT - not a government record", font=font("ariali.ttf", 18),
           fill="#7a8a9a")
    out = io.BytesIO()
    img.save(out, "PNG")
    return out.getvalue()


def cheque_png(v) -> bytes:
    W, H = 1700, 760
    img = Image.new("RGB", (W, H), "#f4f8ef")
    d = ImageDraw.Draw(img)
    for x in range(0, W, 14):
        d.line([(x, 0), (x, H)], fill="#eaf1e2", width=1)
    d.text((40, 30), v["bank"], font=font("arialbd.ttf", 44), fill="#123d6a")
    d.text((40, 86), f"Branch: {v['branch']}", font=font("arial.ttf", 24), fill="#333333")
    d.text((40, 118), f"IFSC: {v['ifsc']}", font=font("arialbd.ttf", 26), fill="#222222")
    d.text((W - 430, 40), "Date", font=font("arial.ttf", 24), fill="#333333")
    for i in range(8):
        d.rectangle([W - 360 + i * 40, 36, W - 324 + i * 40, 76], outline="#555555", width=2)
    d.text((40, 200), "Pay", font=font("arial.ttf", 28), fill="#333333")
    d.line([(110, 232), (W - 420, 232)], fill="#777777", width=2)
    d.text((W - 380, 200), "or Bearer", font=font("arial.ttf", 24), fill="#333333")
    d.text((40, 270), "Rupees", font=font("arial.ttf", 28), fill="#333333")
    d.line([(150, 302), (W - 420, 302)], fill="#777777", width=2)
    d.line([(40, 362), (W - 420, 362)], fill="#777777", width=2)
    d.rectangle([W - 380, 270, W - 60, 336], outline="#555555", width=2)
    d.text((W - 370, 284), "Rs.", font=font("arialbd.ttf", 30), fill="#333333")
    d.text((40, 400), "A/c No.", font=font("arial.ttf", 26), fill="#333333")
    d.text((170, 396), v["account"], font=font("consola.ttf", 34), fill="#111111")
    d.text((40, 450), "SB / CA", font=font("arial.ttf", 22), fill="#555555")
    d.text((W - 640, 470), f"For {v['cheque_name']}", font=font("arialbd.ttf", 26), fill="#111111")
    d.text((W - 460, 570), "Authorised Signatory", font=font("arial.ttf", 22), fill="#333333")
    micr = f"\u2446{random.randint(100000, 999999)}\u2446 {v['micr']}\u2448 {random.randint(100000, 999999)}\u2446 31"
    d.text((380, 660), micr.replace("\u2446", "  ").replace("\u2448", "  "), font=font("consola.ttf", 40),
           fill="#222222")
    # CANCELLED crossing
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    ld.line([(250, 620), (1300, 140)], fill=(180, 20, 20, 210), width=6)
    ld.line([(330, 650), (1380, 170)], fill=(180, 20, 20, 210), width=6)
    txt = Image.new("RGBA", (900, 140), (0, 0, 0, 0))
    ImageDraw.Draw(txt).text((10, 10), "CANCELLED", font=font("arialbd.ttf", 110), fill=(180, 20, 20, 220))
    txt = txt.rotate(24, expand=True)
    layer.alpha_composite(txt, (380, 190))
    img = Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB")
    d = ImageDraw.Draw(img)
    d.text((40, H - 34), "SYNTHETIC TEST DOCUMENT - fictional account", font=font("ariali.ttf", 18), fill="#888888")
    out = io.BytesIO()
    if v.get("cheque_software"):
        from PIL.PngImagePlugin import PngInfo
        info = PngInfo()
        info.add_text("Software", v["cheque_software"])
        img.save(out, "PNG", pnginfo=info)
    else:
        img.save(out, "PNG")
    return out.getvalue()


def udyam_pdf(v) -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    w, h = A4
    c.setStrokeColor(HexColor("#0b5394"))
    c.setLineWidth(1.5)
    c.rect(14 * mm, 20 * mm, w - 28 * mm, h - 34 * mm)
    c.setFont("Helvetica-Bold", 12)
    c.drawCentredString(w / 2, h - 28 * mm, "Government of India")
    c.setFont("Helvetica", 10)
    c.drawCentredString(w / 2, h - 34 * mm, "Ministry of Micro, Small and Medium Enterprises")
    c.setFont("Helvetica-Bold", 16)
    c.drawCentredString(w / 2, h - 48 * mm, "UDYAM REGISTRATION CERTIFICATE")
    d, m, y = v["inc_date"]
    rows = [
        ("UDYAM REGISTRATION NUMBER", v["udyam"]),
        ("NAME OF ENTERPRISE", v["legal_name"]),
        ("TYPE OF ENTERPRISE", f"{v['msme_cert']} (Classification Year 2025-26)"),
        ("MAJOR ACTIVITY", "Manufacturing"),
        ("ORGANISATION TYPE", "Private Limited Company"),
        ("OFFICIAL ADDRESS OF ENTERPRISE", f"{v['address']}, {v['city']}, {v['state']} - {v['pincode']}"),
        ("DATE OF INCORPORATION", f"{d:02d}/{m:02d}/{y}"),
        ("DATE OF UDYAM REGISTRATION", "14/08/2021"),
    ]
    top = h - 62 * mm
    for i, (k, val) in enumerate(rows):
        y0 = top - i * 12 * mm
        c.setFont("Helvetica-Bold", 9)
        c.drawString(22 * mm, y0, f"{i + 1}. {k}")
        c.setFont("Helvetica", 9.5)
        c.drawString(100 * mm, y0, val if len(val) < 60 else val[:58] + "...")
    c.setFont("Helvetica-Oblique", 8.5)
    c.drawString(22 * mm, top - len(rows) * 12 * mm - 6 * mm,
                 "Disclaimer: This is computer generated statement, no signature required.")
    _footer(c)
    c.showPage()
    c.save()
    return buf.getvalue()


def degrade_to_scanned_pdf(png_bytes: bytes, rotation: float = 1.6, blur: float = 1.1) -> bytes:
    """Simulate a phone-scanned page: slight rotation, blur, noise, low contrast, JPEG artefacts."""
    img = Image.open(io.BytesIO(png_bytes)).convert("L")
    img = img.rotate(rotation, expand=True, fillcolor=235)
    img = img.filter(ImageFilter.GaussianBlur(blur))
    px = img.load()
    for _ in range(int(img.size[0] * img.size[1] * 0.02)):
        x, y = random.randrange(img.size[0]), random.randrange(img.size[1])
        px[x, y] = random.choice([60, 120, 200])
    img = img.point(lambda p: int(40 + p * 0.78))
    jpg = io.BytesIO()
    img.convert("RGB").save(jpg, "JPEG", quality=38)
    jpg.seek(0)
    buf = io.BytesIO()
    page_w, page_h = A4
    c = canvas.Canvas(buf, pagesize=A4)
    iw, ih = img.size
    scale = min((page_w - 30 * mm) / iw, (page_h - 60 * mm) / ih)
    c.drawImage(ImageReader(jpg), 15 * mm, page_h - 25 * mm - ih * scale, iw * scale, ih * scale)
    c.showPage()
    c.save()
    return buf.getvalue()


def pdf_to_scanned(pdf_renderer, v) -> bytes:
    """Render a text PDF's content as an image-only scanned PDF (no text layer)."""
    # Re-draw the document on an image canvas via reportlab is not possible; instead rasterise a
    # simple text rendition of the GST certificate fields so the page has no extractable text.
    W, H = 1240, 1754
    img = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(img)
    f_b, f, f_s = font("arialbd.ttf", 30), font("arial.ttf", 24), font("arial.ttf", 20)
    d.text((W // 2 - 140, 90), "Government of India", font=f_b, fill="black")
    d.text((W // 2 - 130, 140), "Form GST REG-06", font=f_b, fill="black")
    d.text((W // 2 - 160, 190), "Registration Certificate", font=f_b, fill="black")
    d.text((90, 280), f"Registration Number : {v['gstin']}", font=f_b, fill="black")
    rows = [
        ("Legal Name", v["gst_legal_name"]),
        ("Trade Name, if any", v["trade_name"] or v["gst_legal_name"]),
        ("Constitution of Business", "Proprietorship" if v["entity_type"] == "proprietorship" else "Private Limited Company"),
        ("Address of Principal Place of Business", f"{v['address']}, {v['city']},"),
        ("", f"{v['state']}, {v['pincode']}"),
        ("Date of Liability", "01/07/2017"),
        ("Type of Registration", "Regular"),
    ]
    y = 360
    for label, value in rows:
        d.text((90, y), label, font=f, fill="black")
        d.text((560, y), value, font=f, fill="black")
        y += 62
    d.text((90, y + 40), "Digitally signed by DS GOODS AND SERVICES TAX NETWORK", font=f_s, fill="black")
    d.text((90, H - 80), "SYNTHETIC TEST DOCUMENT - fictional entity", font=f_s, fill="#777777")
    out = io.BytesIO()
    img.save(out, "PNG")
    return degrade_to_scanned_pdf(out.getvalue(), rotation=-0.9, blur=0.8)


# --------------------------------------------------------------------------------------------
# Ground truth (what a perfect extractor would return) for fixture test mode
# --------------------------------------------------------------------------------------------


def _f(key, value, quote=None, conf=0.98):
    return {"key": key, "value": value, "source_quote": quote or value, "confidence": conf}


def truth_incorporation(v):
    d, m, y = v["inc_date"]
    return dict(detected_type="certificate_of_incorporation", type_confidence=0.99, legibility="clear", fields=[
        _f("legal_name", v["legal_name"], f"I hereby certify that {v['legal_name']} is incorporated"),
        _f("cin", v["cin"], f"Corporate Identity Number of the company is {v['cin']}"),
        _f("pan", v["pan"], f"Permanent Account Number (PAN) of the company is {v['pan']}"),
        _f("registration_date", f"{y}-{m:02d}-{d:02d}"),
        _f("address", f"{v['address']}, {v['city']}, {v['state']}, India - {v['pincode']}"),
        _f("state", v["state"]),
    ], notes="")


def truth_gst(v, scanned=False):
    c = 0.86 if scanned else 0.98
    constitution = "Proprietorship" if v["entity_type"] == "proprietorship" else "Private Limited Company"
    return dict(detected_type="gst_registration_certificate", type_confidence=0.97, legibility="degraded" if scanned else "clear",
                fields=[
                    _f("gstin", v["gstin"], f"Registration Number : {v['gstin']}", c),
                    _f("legal_name", v["gst_legal_name"], conf=c),
                    _f("trade_name", v["trade_name"] or v["gst_legal_name"], conf=c),
                    _f("constitution_of_business", constitution, conf=c),
                    _f("address", f"{v['address']}, {v['city']}, {v['state']}, {v['pincode']}", conf=c),
                    _f("state", v["state"], conf=c),
                ], notes="")


def truth_pan(v):
    fields = [_f("pan", v["pan"]), _f("legal_name", v["legal_name"])]
    if v["entity_type"] == "proprietorship":
        fields += [_f("father_name", v["father"]), _f("date_of_birth", v["dob"])]
    else:
        d, m, y = v["inc_date"]
        fields.append(_f("registration_date", f"{y}-{m:02d}-{d:02d}"))
    return dict(detected_type="pan_card", type_confidence=0.99, legibility="clear", fields=fields, notes="")


def truth_cheque(v, scanned=False):
    c = 0.84 if scanned else 0.97
    return dict(detected_type="cancelled_cheque", type_confidence=0.98, legibility="degraded" if scanned else "clear",
                fields=[
                    _f("account_holder_name", v["cheque_name"], f"For {v['cheque_name']}", c),
                    _f("account_number", v["account"], conf=c),
                    _f("ifsc", v["ifsc"], f"IFSC: {v['ifsc']}", c),
                    _f("bank_name", v["bank"], conf=c),
                    _f("branch", v["branch"], conf=c),
                ], notes="Document is crossed and marked CANCELLED.")


# --------------------------------------------------------------------------------------------
# Scenarios
# --------------------------------------------------------------------------------------------


def truth_udyam(v):
    return dict(detected_type="udyam_certificate", type_confidence=0.97, legibility="clear", fields=[
        _f("udyam_number", v["udyam"], f"UDYAM REGISTRATION NUMBER {v['udyam']}"),
        _f("legal_name", v["legal_name"], f"NAME OF ENTERPRISE {v['legal_name']}"),
        _f("msme_category", v["msme_cert"], f"TYPE OF ENTERPRISE {v['msme_cert']}"),
        _f("major_activity", "Manufacturing"),
    ], notes="")


def form_for(v, **overrides):
    form = dict(
        legal_name=v["form_name"], trade_name=v["trade_name"].title() if v["trade_name"] else "",
        entity_type=v["entity_type"], pan=v["pan"], gstin=v["gstin"], cin=v["cin"],
        owner_name=v["owner_name"], address=v["address"], city=v["city"], state=v["state"], pincode=v["pincode"],
        contact_name=v["contact_name"], contact_email=v["contact_email"], contact_phone=v["contact_phone"],
        website=v["website"], category=v["category"],
        bank_account_holder=v["cheque_name"].title().replace("Pvt Ltd", "Pvt Ltd"),
        bank_account_number=v["account"], bank_ifsc=v["ifsc"], bank_name=v["bank"].title(),
        msme_registered="yes" if v.get("udyam") else "no", udyam_number=v.get("udyam", ""),
        msme_category=v.get("msme_declared", ""),
    )
    form.update(overrides)
    return form


SCENARIOS = [
    dict(id="shreeji", vendor="shreeji", group="demo", title="Clean submission",
         summary="Complete, consistent application. Names differ only in formatting (Pvt. Ltd. vs Private Limited).",
         expected="Approved (bank ownership remains unverified - condition before first payment)"),
    dict(id="kaveri", vendor="kaveri", group="demo", title="Wrong document uploaded",
         summary="The vendor uploaded their GST certificate in the bank-proof slot. Resubmission pack contains the cheque.",
         expected="Awaiting vendor -> automated follow-up -> resubmission -> Approved"),
    dict(id="northstar", vendor="northstar", group="demo", title="Sister-company GST certificate",
         summary="Every field looks valid alone. The GSTIN belongs to a different PAN - a sister company with a near-identical name.",
         expected="In review - cross-reference conflict surfaced with evidence"),
    dict(id="meridian", vendor="meridian", group="demo", title="Bank account already on file",
         summary="Documents are internally consistent, but the bank account belongs to an existing approved vendor.",
         expected="Rejected - bank account linked to another legal entity"),
    dict(id="vertex", vendor="vertex", group="extra", title="GSTIN typo",
         summary="Two digits transposed in the GSTIN typed on the form. The certificate has the correct value.",
         expected="Awaiting vendor - field correction with suggested value"),
    dict(id="murugan", vendor="murugan", group="extra", title="Proprietorship, scanned documents",
         summary="Sole proprietor: GST legal name is the owner's name, trade name is the business. Phone-scanned docs.",
         expected="Approved under proprietorship rules (or review if scan confidence is low)"),
    dict(id="bluewave", vendor="bluewave", group="demo", title="Vendor never replies",
         summary="PAN card missing. The vendor ignores the request, n8n sends reminders, then escalates.",
         expected="Awaiting vendor -> 2 reminders -> escalated as unresponsive"),
    dict(id="lakshmi", vendor="lakshmi", group="extra", title="Doctored cheque",
         summary="The cheque prints HDFC Bank but its IFSC belongs to ICICI, and the image was saved from Photoshop.",
         expected="Needs review - bank/IFSC mismatch + editing-software hint"),
    dict(id="pragati", vendor="pragati", group="extra", title="MSME category mismatch",
         summary="Declares Micro enterprise (45-day payment protection) but the Udyam certificate says Medium.",
         expected="Needs review - MSME category conflict affects payment terms"),
    dict(id="apex", vendor="apex", group="history", title="Existing vendor (history)", summary="", expected="Approved"),
    dict(id="saikrupa", vendor="saikrupa", group="history", title="History", summary="", expected="Approved"),
    dict(id="orion", vendor="orion", group="history", title="Cancelled GST registration", summary="", expected="Rejected"),
    dict(id="deccan", vendor="deccan", group="history", title="History", summary="", expected="Approved"),
]


def main():
    if os.path.isdir(PUBLIC):
        # Delete files, keep folders: OneDrive / dev-server watchers can lock directories on Windows.
        for root, _dirs, names in os.walk(PUBLIC):
            for n in names:
                os.remove(os.path.join(root, n))
    os.makedirs(PUBLIC, exist_ok=True)
    os.makedirs(FIXTURES, exist_ok=True)
    truth = {}
    index = []

    def write(scn_dir, name, data, truth_obj):
        path = os.path.join(scn_dir, name)
        with open(path, "wb") as fh:
            fh.write(data)
        truth[hashlib.sha256(data).hexdigest()] = truth_obj
        return name

    for s in SCENARIOS:
        v = VENDORS[s["vendor"]]
        scn_dir = os.path.join(PUBLIC, s["id"])
        os.makedirs(scn_dir, exist_ok=True)
        files = {}
        resubmission = {}
        slug = s["id"].capitalize()
        form = form_for(v)

        if v["entity_type"] != "proprietorship":
            files["incorporation"] = write(scn_dir, f"{slug}_Certificate_of_Incorporation.pdf",
                                           incorporation_pdf(v), truth_incorporation(v))
        if s["id"] == "murugan":
            files["gst"] = write(scn_dir, f"{slug}_GST_Certificate_scan.pdf", pdf_to_scanned(gst_pdf, v),
                                 truth_gst(v, scanned=True))
        else:
            files["gst"] = write(scn_dir, f"{slug}_GST_REG-06.pdf", gst_pdf(v), truth_gst(v))
        if s["id"] != "bluewave":
            files["pan"] = write(scn_dir, f"{slug}_PAN_Card.png", pan_card_png(v), truth_pan(v))
        cheque = cheque_png(v)
        if s["id"] == "kaveri":
            # Wrong document in the bank-proof slot: a second copy of the GST certificate.
            files["bank_proof"] = write(scn_dir, f"{slug}_Bank_Proof.pdf", gst_pdf(v), truth_gst(v))
            os.makedirs(os.path.join(scn_dir, "resubmission"), exist_ok=True)
            resubmission["bank_proof"] = "resubmission/" + write(
                os.path.join(scn_dir, "resubmission"), f"{slug}_Cancelled_Cheque.png", cheque, truth_cheque(v))
        elif s["id"] == "murugan":
            files["bank_proof"] = write(scn_dir, f"{slug}_Cancelled_Cheque_scan.pdf",
                                        degrade_to_scanned_pdf(cheque), truth_cheque(v, scanned=True))
        else:
            files["bank_proof"] = write(scn_dir, f"{slug}_Cancelled_Cheque.png", cheque, truth_cheque(v))

        if v.get("udyam"):
            files["udyam"] = write(scn_dir, f"{slug}_Udyam_Certificate.pdf", udyam_pdf(v), truth_udyam(v))

        if s["id"] == "vertex":
            g = v["gstin"]
            typo = g[:9] + g[10] + g[9] + g[11:]  # swap two PAN digits inside the GSTIN
            form["gstin"] = typo
            resubmission["fields"] = {"gstin": g}

        index.append(dict(id=s["id"], group=s["group"], title=s["title"], vendor=v["form_name"],
                          summary=s["summary"], expected=s["expected"], form=form, files=files,
                          resubmission=resubmission))

    # Email-intake pack: first email without the cheque, then a reply that attaches it.
    v = VENDORS["sahyadri"]
    em_dir = os.path.join(PUBLIC, "email-sahyadri")
    os.makedirs(os.path.join(em_dir, "reply"), exist_ok=True)
    em_files = [
        write(em_dir, "Sahyadri_Certificate_of_Incorporation.pdf", incorporation_pdf(v), truth_incorporation(v)),
        write(em_dir, "Sahyadri_GST_Certificate.pdf", gst_pdf(v), truth_gst(v)),
        write(em_dir, "Sahyadri_PAN.png", pan_card_png(v), truth_pan(v)),
        write(em_dir, "Sahyadri_Udyam.pdf", udyam_pdf(v), truth_udyam(v)),
    ]
    reply = "reply/" + write(os.path.join(em_dir, "reply"), "Sahyadri_Cancelled_Cheque.png", cheque_png(v), truth_cheque(v))
    with open(os.path.join(em_dir, "EMAIL.txt"), "w", encoding="utf8") as fh:
        fh.write(
            "Subject: Vendor registration - Sahyadri Castings\n\n"
            "Hello Acme team,\n\nWe would like to register as a supplier of grey iron castings. Please find our company\n"
            "documents attached. We are a registered MSME (Small).\n\nRegards,\nAmit Bhosale\nSahyadri Castings Pvt Ltd\n+91 98901 22457\n\n"
            f"Attach: {', '.join(em_files)}\nThen reply to VendorIQ's request email attaching: {reply}\n")
    index.append(dict(id="email-sahyadri", group="email", title="Email intake (no portal)", vendor=v["form_name"],
                      summary="Vendor emails documents; VendorIQ builds the application, asks for the missing cheque, vendor replies with it.",
                      expected="Awaiting vendor (confirm + cheque) -> reply -> confirm -> Approved", form=form_for(v),
                      files={}, email_files=em_files, resubmission={"reply": reply}))

    with open(os.path.join(PUBLIC, "scenarios.json"), "w") as fh:
        json.dump(index, fh, indent=2)
    with open(os.path.join(FIXTURES, "truth.json"), "w") as fh:
        json.dump(truth, fh, indent=1)

    registry = []
    for key, v in VENDORS.items():
        if key == "murugan":
            continue  # not in sandbox registry -> "unverified"
        registry.append(dict(gstin=v["gstin"], legal_name=v["gst_legal_name"],
                             trade_name=v["trade_name"] or v["gst_legal_name"],
                             status="Cancelled" if key == "orion" else "Active",
                             state_code=v["state_code"],
                             constitution="Proprietorship" if v["entity_type"] == "proprietorship" else "Private Limited Company"))
    with open(os.path.join(FIXTURES, "gst_registry.json"), "w") as fh:
        json.dump(registry, fh, indent=2)

    print(f"Generated {len(index)} scenarios, {len(truth)} documents.")
    for s in index:
        print(f"  {s['id']:10s} gstin={s['form']['gstin']}  files={list(s['files'].values())}")


if __name__ == "__main__":
    main()
