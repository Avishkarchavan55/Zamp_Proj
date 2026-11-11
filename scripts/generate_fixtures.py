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
YEAR_WORDS = {2013: "Two thousand thirteen", 2014: "Two thousand fourteen", 2015: "Two thousand fifteen", 2016: "Two thousand sixteen", 2017: "Two thousand seventeen",
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
    # Email-intake demo vendor (the user's chosen name): applies by email, no portal.
    "lokseva": dict(
        legal_name="LOKSEVA PASHUKHADYA PRIVATE LIMITED",
        form_name="Lokseva Pashukhadya Private Limited",
        trade_name="", entity_type="private_limited",
        pan="AAICL5527R", state_code="27", cin="U15400MH2018PTC312764", inc_date=(6, 4, 2018),
        address="Gat No. 42, MIDC Nagapur", city="Ahmednagar", state="Maharashtra", pincode="414111",
        contact_name="Sandeep Gaikwad", contact_email="accounts@loksevapashukhadya.in", contact_phone="+91 98221 40576",
        owner_name="Sandeep Gaikwad", website="loksevapashukhadya.in", category="Cattle feed & mineral mixture",
        ifsc="HDFC0000103", bank="HDFC BANK", branch="PUNE - FERGUSSON COLLEGE ROAD",
        account="50200077315842", cheque_name="LOKSEVA PASHUKHADYA PVT LTD", micr="411240003",
        udyam="UDYAM-MH-01-0063318", msme_declared="Small", msme_cert="Small",
    ),
    # Example: partnership firm, applies through the Google Form. Clean -> Approved.
    "riverside": dict(
        legal_name="RIVERSIDE TRADERS", form_name="Riverside Traders",
        trade_name="", entity_type="partnership",
        pan="AAJFR4417Q", state_code="24", cin="", inc_date=(3, 5, 2015),
        address="12, Ashram Road, Navrangpura", city="Ahmedabad", state="Gujarat", pincode="380009",
        contact_name="Kunal Shah", contact_email="kunal@riversidetraders.in", contact_phone="+91 98250 31184",
        owner_name="Kunal Shah", website="riversidetraders.in", category="Industrial packaging material",
        ifsc="UTIB0000004", bank="AXIS BANK", branch="MUMBAI BRANCH",
        account="915020034418827", cheque_name="RIVERSIDE TRADERS", micr="400211002",
    ),
    # Example: proprietorship with clear digital documents, applies on the portal. Clean -> Approved.
    "anjali": dict(
        legal_name="ANJALI RAO", form_name="Anjali Print Solutions",
        trade_name="ANJALI PRINT SOLUTIONS", entity_type="proprietorship",
        pan="CQKPR6623M", state_code="29", cin="", inc_date=None,
        address="88, 5th Block, Koramangala", city="Bengaluru", state="Karnataka", pincode="560034",
        contact_name="Anjali Rao", contact_email="anjali@anjaliprint.in", contact_phone="+91 99860 47213",
        owner_name="Anjali Rao", website="anjaliprint.in", category="Printing and labels",
        ifsc="HDFC0000053", bank="HDFC BANK", branch="BANGALORE - KORAMANGALAM",
        account="50100388215407", cheque_name="ANJALI PRINT SOLUTIONS", micr="560240004",
        dob="09/03/1988", father="VENKATESH RAO",
    ),
    # ---- History: realistic past applications loaded quietly so the dashboard has a believable mix.
    "kalpataru": dict(
        legal_name="KALPATARU STEEL TRADERS PRIVATE LIMITED", form_name="Kalpataru Steel Traders Pvt Ltd",
        trade_name="", entity_type="private_limited",
        pan="AAKCK6631D", state_code="27", cin="U51420MH2014PTC255310", inc_date=(11, 8, 2014),
        address="Plot 7, MIDC Chakan Phase 1", city="Pune", state="Maharashtra", pincode="410501",
        contact_name="Rohit Kulkarni", contact_email="rohit@kalpatarusteel.in", contact_phone="+91 98230 55107",
        owner_name="Rohit Kulkarni", website="kalpatarusteel.in", category="Steel sheets and coils",
        ifsc="HDFC0000001", bank="HDFC BANK", branch="TULSIANI CHMBRS - NARIMAN PT",
        account="50200061234871", cheque_name="KALPATARU STEEL TRADERS PVT LTD", micr="400240003",
    ),
    "suryodaya": dict(
        legal_name="SURYODAYA SOLAR SYSTEMS PRIVATE LIMITED", form_name="Suryodaya Solar Systems Pvt Ltd",
        trade_name="", entity_type="private_limited",
        pan="AAMCS4410K", state_code="24", cin="U40106GJ2018PTC101442", inc_date=(2, 2, 2018),
        address="44, Satellite Road", city="Ahmedabad", state="Gujarat", pincode="380015",
        contact_name="Nirali Desai", contact_email="nirali@suryodayasolar.in", contact_phone="+91 99250 18842",
        owner_name="Nirali Desai", website="suryodayasolar.in", category="Rooftop solar installation",
        ifsc="UTIB0000004", bank="AXIS BANK", branch="MUMBAI BRANCH",
        account="918020045512309", cheque_name="SURYODAYA SOLAR SYSTEMS PVT LTD", micr="400211002",
        udyam="UDYAM-GJ-01-0034471", msme_declared="Small", msme_cert="Small",
    ),
    "bharat": dict(
        legal_name="KARTHIK RAJAN", form_name="Bharat Fasteners",
        trade_name="BHARAT FASTENERS", entity_type="proprietorship",
        pan="BJKPR7712L", state_code="33", cin="", inc_date=None,
        address="22, Usman Road, T. Nagar", city="Chennai", state="Tamil Nadu", pincode="600017",
        contact_name="Karthik Rajan", contact_email="bharatfasteners@gmail.com", contact_phone="+91 94441 30987",
        owner_name="Karthik Rajan", website="", category="Industrial fasteners",
        ifsc="ICIC0000001", bank="ICICI BANK", branch="CHENNAICENOTAPH ROAD",
        account="000401552871", cheque_name="BHARAT FASTENERS", micr="600229002",
        dob="21/11/1984", father="RAJAN SUBRAMANIAM",
    ),
    "venkateswara": dict(
        legal_name="SRI VENKATESWARA HYDRAULICS", form_name="Sri Venkateswara Hydraulics",
        trade_name="", entity_type="partnership",
        pan="AAKFS2290M", state_code="29", cin="", inc_date=(15, 6, 2012),
        address="17, 3rd Main, Peenya Industrial Estate", city="Bengaluru", state="Karnataka", pincode="560058",
        contact_name="Srinivas Reddy", contact_email="accounts@svhydraulics.in", contact_phone="+91 98450 62210",
        owner_name="Srinivas Reddy", website="svhydraulics.in", category="Hydraulic cylinders and repair",
        ifsc="HDFC0000053", bank="HDFC BANK", branch="BANGALORE - KORAMANGALAM",
        account="50200099120344", cheque_name="SRI VENKATESWARA HYDRAULICS", micr="560240004",
    ),
    "coastal": dict(
        legal_name="COASTAL CHEM INDUSTRIES PRIVATE LIMITED", form_name="Coastal Chem Industries Pvt Ltd",
        trade_name="", entity_type="private_limited",
        pan="AAJCC8854P", state_code="24", cin="U24299GJ2019PTC109876", inc_date=(20, 9, 2019),
        address="9, Ashram Road, Navrangpura", city="Ahmedabad", state="Gujarat", pincode="380009",
        contact_name="Harsh Mehta", contact_email="harsh@coastalchem.in", contact_phone="+91 97240 88315",
        owner_name="Harsh Mehta", website="coastalchem.in", category="Industrial cleaning chemicals",
        ifsc="SBIN0000001", bank="STATE BANK OF INDIA", branch="KOLKATA MAIN",
        account="38771234560", cheque_name="COASTAL CHEM INDUSTRIES PVT LTD", micr="700002021",
        udyam="UDYAM-GJ-01-0051288", msme_declared="Micro", msme_cert="Micro",
    ),
    # History, needs a decision: the GST certificate carries a longer company name.
    "patil": dict(
        legal_name="PATIL LOGISTICS PRIVATE LIMITED", form_name="Patil Logistics Pvt Ltd",
        gst_legal_name="PATIL LOGISTICS AND WAREHOUSING PRIVATE LIMITED",
        trade_name="", entity_type="private_limited",
        pan="AAOCP5521R", state_code="27", cin="U63090MH2017PTC291104", inc_date=(5, 1, 2017),
        address="Survey 88, Nagar-Manmad Road", city="Ahmednagar", state="Maharashtra", pincode="414111",
        contact_name="Vikas Patil", contact_email="vikas@patillogistics.in", contact_phone="+91 98600 41228",
        owner_name="Vikas Patil", website="patillogistics.in", category="Road freight and warehousing",
        ifsc="SBIN0003403", bank="STATE BANK OF INDIA", branch="AMBEJOGAI",
        account="39102284471", cheque_name="PATIL LOGISTICS PVT LTD", micr="431002834",
    ),
    # History, waiting on the vendor: PAN card not uploaded.
    "ganga": dict(
        legal_name="GANGA PACKAGING PRIVATE LIMITED", form_name="Ganga Packaging Pvt Ltd",
        trade_name="", entity_type="private_limited",
        pan="AAGCG3317H", state_code="27", cin="U21012MH2015PTC264489", inc_date=(8, 4, 2015),
        address="Gat 112, Chakan Talegaon Road", city="Pune", state="Maharashtra", pincode="410501",
        contact_name="Sunita Ganguly", contact_email="sunita@gangapackaging.in", contact_phone="+91 98810 23574",
        owner_name="Sunita Ganguly", website="gangapackaging.in", category="Corrugated boxes",
        ifsc="UTIB0000004", bank="AXIS BANK", branch="MUMBAI BRANCH",
        account="917020011873316", cheque_name="GANGA PACKAGING PVT LTD", micr="400211002",
        skip_pan=True,
    ),
    # ---- History, rejected: GST registration suspended (not eligible).
    "shivshakti": dict(
        legal_name="SHIVSHAKTI METAL WORKS PRIVATE LIMITED", form_name="Shivshakti Metal Works Pvt Ltd",
        trade_name="", entity_type="private_limited",
        pan="AAPCS6620B", state_code="27", cin="U27100MH2016PTC284410", inc_date=(14, 3, 2016),
        address="Gat 41, Chakan Industrial Area", city="Pune", state="Maharashtra", pincode="410501",
        contact_name="Amol Shinde", contact_email="amol@shivshaktimetal.in", contact_phone="+91 98230 77410",
        owner_name="Amol Shinde", website="shivshaktimetal.in", category="Sheet metal fabrication",
        ifsc="SBIN0003403", bank="STATE BANK OF INDIA", branch="AMBEJOGAI",
        account="39188812047", cheque_name="SHIVSHAKTI METAL WORKS PVT LTD", micr="431002834",
        gst_status="Suspended",
    ),
    # History, rejected: the bank account belongs to Kalpataru Steel Traders (different PAN) - fraud pattern.
    "navkar": dict(
        legal_name="NAVKAR ENTERPRISES PRIVATE LIMITED", form_name="Navkar Enterprises Pvt Ltd",
        trade_name="", entity_type="private_limited",
        pan="AAMCN2219J", state_code="27", cin="U51909MH2020PTC339871", inc_date=(9, 7, 2020),
        address="Shop 3, Station Road", city="Ahmednagar", state="Maharashtra", pincode="414111",
        contact_name="Paresh Jain", contact_email="paresh@navkarenterprises.in", contact_phone="+91 98901 33025",
        owner_name="Paresh Jain", website="navkarenterprises.in", category="Steel trading",
        ifsc="HDFC0000001", bank="HDFC BANK", branch="TULSIANI CHMBRS - NARIMAN PT",
        account="50200061234871", cheque_name="NAVKAR ENTERPRISES PVT LTD", micr="400240003",
    ),
    # History, rejected: the bank account belongs to Suryodaya Solar Systems (different PAN) - fraud pattern.
    "greenfield": dict(
        legal_name="GREENFIELD AGRI EXPORTS PRIVATE LIMITED", form_name="Greenfield Agri Exports Pvt Ltd",
        trade_name="", entity_type="private_limited",
        pan="AAKCG5562M", state_code="24", cin="U01400GJ2021PTC120334", inc_date=(12, 1, 2021),
        address="21, Satellite Road", city="Ahmedabad", state="Gujarat", pincode="380015",
        contact_name="Kavya Shah", contact_email="kavya@greenfieldagri.in", contact_phone="+91 99250 61873",
        owner_name="Kavya Shah", website="greenfieldagri.in", category="Agricultural produce",
        ifsc="UTIB0000004", bank="AXIS BANK", branch="MUMBAI BRANCH",
        account="918020045512309", cheque_name="GREENFIELD AGRI EXPORTS PVT LTD", micr="400211002",
    ),
    # History, needs a decision: the GSTIN belongs to a sister company (different PAN, similar name).
    "mahalaxmi": dict(
        legal_name="MAHALAXMI PLASTICS PRIVATE LIMITED", form_name="Mahalaxmi Plastics Pvt Ltd",
        gst_legal_name="MAHALAXMI POLYMERS PRIVATE LIMITED", gst_pan="AAJCM4402L",
        trade_name="", entity_type="private_limited",
        pan="AAHCM7781K", state_code="24", cin="U25200GJ2015PTC085512", inc_date=(6, 10, 2015),
        address="5, Ashram Road, Navrangpura", city="Ahmedabad", state="Gujarat", pincode="380009",
        contact_name="Hiral Patel", contact_email="hiral@mahalaxmiplastics.in", contact_phone="+91 97250 40981",
        owner_name="Hiral Patel", website="mahalaxmiplastics.in", category="Plastic moulded parts",
        ifsc="UTIB0000004", bank="AXIS BANK", branch="MUMBAI BRANCH",
        account="918020077120458", cheque_name="MAHALAXMI PLASTICS PVT LTD", micr="400211002",
    ),
    # History, needs a decision: the cheque prints State Bank of India but the IFSC belongs to HDFC Bank.
    "triveni": dict(
        legal_name="TRIVENI ELECTRICALS PRIVATE LIMITED", form_name="Triveni Electricals Pvt Ltd",
        trade_name="", entity_type="private_limited",
        pan="AAICT3390F", state_code="29", cin="U31900KA2017PTC104211", inc_date=(19, 2, 2017),
        address="61, 4th Block, Koramangala", city="Bengaluru", state="Karnataka", pincode="560034",
        contact_name="Prakash Hegde", contact_email="prakash@trivenielectricals.in", contact_phone="+91 98450 27716",
        owner_name="Prakash Hegde", website="trivenielectricals.in", category="Switchgear and panels",
        ifsc="HDFC0000053", bank="STATE BANK OF INDIA", branch="KORAMANGALA",
        account="50200034551289", cheque_name="TRIVENI ELECTRICALS PVT LTD", micr="560240004",
    ),
    # History, needs a decision: declares a Small enterprise, the Udyam certificate says Medium.
    "krishna": dict(
        legal_name="KRISHNA FOOD PRODUCTS PRIVATE LIMITED", form_name="Krishna Food Products Pvt Ltd",
        trade_name="", entity_type="private_limited",
        pan="AAJCK8836D", state_code="33", cin="U15400TN2019PTC128843", inc_date=(25, 4, 2019),
        address="18, Usman Road, T. Nagar", city="Chennai", state="Tamil Nadu", pincode="600017",
        contact_name="Lakshmi Narayanan", contact_email="lakshmi@krishnafoods.in", contact_phone="+91 94440 72281",
        owner_name="Lakshmi Narayanan", website="krishnafoods.in", category="Packaged snacks",
        ifsc="ICIC0000001", bank="ICICI BANK", branch="CHENNAICENOTAPH ROAD",
        account="000401998812", cheque_name="KRISHNA FOOD PRODUCTS PVT LTD", micr="600229002",
        udyam="UDYAM-TN-02-0019934", msme_declared="Small", msme_cert="Medium",
    ),
}
VENDORS["shreeji"].update(udyam="UDYAM-MH-26-0012345", msme_declared="Micro", msme_cert="Micro")

# Added for the video: a second clean portal vendor and a second email-intake vendor (no Udyam, standard payment terms).
VENDORS["annapurna"] = dict(
    legal_name="ANNAPURNA SPICES PRIVATE LIMITED", form_name="Annapurna Spices Private Limited",
    trade_name="", entity_type="private_limited",
    pan="AABCA5518J", state_code="33", cin="U15490TN2016PTC107742", inc_date=(12, 9, 2016),
    address="27, Anna Salai", city="Chennai", state="Tamil Nadu", pincode="600002",
    contact_name="Meenakshi Iyer", contact_email="accounts@annapurnaspices.in", contact_phone="+91 94440 31872",
    owner_name="Meenakshi Iyer", website="annapurnaspices.in", category="Packaged spices and masalas",
    ifsc="HDFC0000053", bank="HDFC BANK", branch="BANGALORE - KORAMANGALAM",
    account="50100455127730", cheque_name="ANNAPURNA SPICES PVT LTD", micr="560240004",
)
VENDORS["narmada"] = dict(
    legal_name="NARMADA PUMP INDUSTRIES PRIVATE LIMITED", form_name="Narmada Pump Industries Private Limited",
    trade_name="", entity_type="private_limited",
    pan="AABCN6247L", state_code="24", cin="U29120GJ2015PTC084229", inc_date=(14, 7, 2015),
    address="Plot 214, GIDC Sachin", city="Surat", state="Gujarat", pincode="395003",
    contact_name="Dhruv Mehta", contact_email="accounts@narmadapumps.in", contact_phone="+91 98250 77419",
    owner_name="Dhruv Mehta", website="narmadapumps.in", category="Industrial water pumps",
    ifsc="ICIC0000027", bank="ICICI BANK", branch="MUMBAI",
    account="003301552847", cheque_name="NARMADA PUMP INDUSTRIES PVT LTD", micr="400229002",
)

# Video kit (final set): a clean MSME portal vendor, an email vendor with no cheque, and a Google Form vendor whose GST registration is cancelled.
VENDORS["sundaram"] = dict(
    legal_name="SUNDARAM AUTO COMPONENTS PRIVATE LIMITED", form_name="Sundaram Auto Components Private Limited",
    trade_name="", entity_type="private_limited",
    pan="AAECS7186Q", state_code="33", cin="U34300TN2017PTC118653", inc_date=(22, 2, 2017),
    address="Plot 36, SIDCO Industrial Estate", city="Coimbatore", state="Tamil Nadu", pincode="641001",
    contact_name="Karthik Subramanian", contact_email="accounts@sundaramauto.in", contact_phone="+91 98420 55631",
    owner_name="Karthik Subramanian", website="sundaramauto.in", category="Automotive machined parts",
    ifsc="KKBK0000721", bank="KOTAK MAHINDRA BANK", branch="PUNE",
    account="7412093356", cheque_name="SUNDARAM AUTO COMPONENTS PVT LTD", micr="411485002",
    udyam="UDYAM-TN-02-0034567", msme_declared="Small", msme_cert="Small",
)
VENDORS["himalaya"] = dict(
    legal_name="HIMALAYA HERBAL EXTRACTS PRIVATE LIMITED", form_name="Himalaya Herbal Extracts Private Limited",
    trade_name="", entity_type="private_limited",
    pan="AAFCH3904M", state_code="05", cin="U24233UT2018PTC008841", inc_date=(5, 11, 2018),
    address="Plot 12, SIDCUL Industrial Area", city="Dehradun", state="Uttarakhand", pincode="248001",
    contact_name="Neha Rawat", contact_email="accounts@himalayaherbal.in", contact_phone="+91 94120 66318",
    owner_name="Neha Rawat", website="himalayaherbal.in", category="Herbal extracts and supplements",
    ifsc="HDFC0000103", bank="HDFC BANK", branch="PUNE - FERGUSSON COLLEGE ROAD",
    account="50200092614417", cheque_name="HIMALAYA HERBAL EXTRACTS PVT LTD", micr="411240003",
    udyam="UDYAM-UT-04-0027715", msme_declared="Micro", msme_cert="Micro",
)
VENDORS["bhavani"] = dict(
    legal_name="BHAVANI DYES AND INTERMEDIATES PRIVATE LIMITED", form_name="Bhavani Dyes and Intermediates Pvt Ltd",
    trade_name="", entity_type="private_limited",
    pan="AAGCB5203E", state_code="24", cin="U24114GJ2013PTC074420", inc_date=(8, 8, 2013),
    address="Plot 88, GIDC Phase 2", city="Vapi", state="Gujarat", pincode="396191",
    contact_name="Rakesh Tandel", contact_email="accounts@bhavanidyes.in", contact_phone="+91 98250 44187",
    owner_name="Rakesh Tandel", website="bhavanidyes.in", category="Dyes and chemical intermediates",
    ifsc="UTIB0000080", bank="AXIS BANK", branch="MANINAGAR",
    account="917020061928344", cheque_name="BHAVANI DYES AND INTERMEDIATES PVT LTD", micr="380211005",
    gst_status="Cancelled",
)

VENDORS["rajputana"] = dict(
    legal_name="RAJPUTANA TEXTILES PRIVATE LIMITED", form_name="Rajputana Textiles Private Limited",
    trade_name="", entity_type="private_limited",
    pan="AAGCR7716K", state_code="08", cin="U17111RJ2015PTC048827", inc_date=(14, 2, 2015),
    address="Plot F-24, Sitapura Industrial Area", city="Jaipur", state="Rajasthan", pincode="302022",
    contact_name="Vikram Shekhawat", contact_email="accounts@rajputanatextiles.in", contact_phone="+91 98290 31472",
    owner_name="Vikram Shekhawat", website="rajputanatextiles.in", category="Block-printed fabrics",
    ifsc="ICIC0000027", bank="HDFC BANK", branch="JAIPUR",
    account="50100417725639", cheque_name="RAJPUTANA TEXTILES PVT LTD", micr="302240002",
    cheque_software="Adobe Photoshop 25.0 (Windows)",
)

VENDORS["nilgiri"] = dict(
    legal_name="NILGIRI TEA ESTATES PRIVATE LIMITED", form_name="Nilgiri Tea Estates Private Limited",
    trade_name="", entity_type="private_limited",
    pan="AAHCN7345B", state_code="33", cin="U01271TN2015PTC099184", inc_date=(12, 1, 2015),
    address="Glendale Estate Office, Kotagiri Road", city="Coonoor", state="Tamil Nadu", pincode="643101",
    contact_name="Meenakshi Ramesh", contact_email="accounts@nilgiritea.in", contact_phone="+91 94430 81257",
    owner_name="Meenakshi Ramesh", website="nilgiritea.in", category="Tea and tea packaging",
    ifsc="HDFC0000053", bank="HDFC BANK", branch="BANGALORE - KORAMANGALAM",
    account="50100309118274", cheque_name="NILGIRI TEA ESTATES PVT LTD", micr="560240004",
)

VENDORS["gomti"] = dict(
    legal_name="GOMTI CERAMICS PRIVATE LIMITED", form_name="Gomti Ceramics Private Limited",
    trade_name="", entity_type="private_limited",
    pan="AAGCG2284P", state_code="09", cin="U26914UP2016PTC083315", inc_date=(18, 4, 2016),
    address="B-27, Industrial Area, Sector 4", city="Lucknow", state="Uttar Pradesh", pincode="226010",
    contact_name="Aditi Srivastava", contact_email="accounts@gomticeramics.in", contact_phone="+91 94150 27316",
    owner_name="Aditi Srivastava", website="gomticeramics.in", category="Ceramic tiles and sanitaryware",
    ifsc="UTIB0000080", bank="AXIS BANK", branch="MANINAGAR",
    account="918010073345129", cheque_name="GOMTI CERAMICS PVT LTD", micr="380211005",
)

VENDORS["vidarbha"] = dict(
    legal_name="VIDARBHA OFFICE TRADERS PRIVATE LIMITED", form_name="Vidarbha Office Traders Private Limited",
    trade_name="", entity_type="private_limited",
    pan="AAGCV5408H", state_code="27", cin="U51909MH2019PTC324471", inc_date=(3, 6, 2019),
    address="Shop 14, Itwari Market Road", city="Nagpur", state="Maharashtra", pincode="440002",
    contact_name="Rohan Deshpande", contact_email="accounts@vidarbhatraders.in", contact_phone="+91 98230 60418",
    owner_name="Rohan Deshpande", website="vidarbhatraders.in", category="Office stationery and consumables",
    # Same account as Apex Facility Services (an existing approved vendor): payment-diversion pattern.
    ifsc="SBIN0000847", bank="STATE BANK OF INDIA", branch="HYDERABAD MAIN",
    account="38291045672", cheque_name="VIDARBHA OFFICE TRADERS PVT LTD", micr="500002003",
)

VENDORS["kakatiya"] = dict(
    legal_name="KAKATIYA RICE MILLS PRIVATE LIMITED", form_name="Kakatiya Rice Mills Private Limited",
    trade_name="", entity_type="private_limited",
    pan="AAHCK9162D", state_code="36", cin="U15312TG2018PTC124856", inc_date=(7, 12, 2018),
    address="Survey No. 212, Hanamkonda Road", city="Warangal", state="Telangana", pincode="506002",
    contact_name="Srinivas Reddy", contact_email="accounts@kakatiyarice.in", contact_phone="+91 94400 52871",
    owner_name="Srinivas Reddy", website="kakatiyarice.in", category="Rice milling and packaged rice",
    ifsc="KKBK0000721", bank="KOTAK MAHINDRA BANK", branch="PUNE",
    account="8814026673", cheque_name="KAKATIYA RICE MILLS PVT LTD", micr="411485002",
)

VENDORS["sutlej"] = dict(
    legal_name="SUTLEJ HOSIERY MILLS PRIVATE LIMITED", form_name="Sutlej Hosiery Mills Private Limited",
    trade_name="", entity_type="private_limited",
    pan="AAHCS8315F", state_code="03", cin="U17115PB2016PTC040129", inc_date=(25, 8, 2016),
    address="Plot 118, Focal Point Phase 5", city="Ludhiana", state="Punjab", pincode="141003",
    contact_name="Harpreet Gill", contact_email="accounts@sutlejhosiery.in", contact_phone="+91 98140 36275",
    owner_name="Harpreet Gill", website="sutlejhosiery.in", category="Knitted garments and hosiery",
    ifsc="HDFC0000103", bank="HDFC BANK", branch="PUNE - FERGUSSON COLLEGE ROAD",
    account="50200118347265", cheque_name="SUTLEJ HOSIERY MILLS PVT LTD", micr="411240003",
)
VENDORS["utkal"] = dict(
    legal_name="UTKAL CASHEW PROCESSORS PRIVATE LIMITED", form_name="Utkal Cashew Processors Private Limited",
    trade_name="", entity_type="private_limited",
    pan="AAGCU6027N", state_code="21", cin="U15319OR2017PTC021788", inc_date=(14, 3, 2017),
    address="Plot 5, Mancheswar Industrial Estate", city="Bhubaneswar", state="Odisha", pincode="751010",
    contact_name="Subhashree Mohanty", contact_email="accounts@utkalcashew.in", contact_phone="+91 94370 61842",
    owner_name="Subhashree Mohanty", website="utkalcashew.in", category="Cashew processing and packaging",
    ifsc="KKBK0000721", bank="KOTAK MAHINDRA BANK", branch="PUNE",
    account="7712038459", cheque_name="UTKAL CASHEW PROCESSORS PVT LTD", micr="411485002",
)

# ---- Testing kit (public/testing): ten vendors used by scripts/build_testing_kit.py ----------------------
VENDORS["chambal"] = dict(  # T01 happy path, email
    legal_name="CHAMBAL VALLEY AGRO INDUSTRIES PRIVATE LIMITED", form_name="Chambal Valley Agro Industries Private Limited",
    trade_name="", entity_type="private_limited",
    pan="AAFCC3185J", state_code="23", cin="U01100MP2017PTC043961", inc_date=(6, 4, 2017),
    address="Plot 31, Industrial Area, Maharajpura", city="Gwalior", state="Madhya Pradesh", pincode="474001",
    contact_name="Pooja Tomar", contact_email="accounts@chambalagro.in", contact_phone="+91 94250 71836",
    owner_name="Pooja Tomar", website="chambalagro.in", category="Agricultural inputs and seeds",
    ifsc="HDFC0000103", bank="HDFC BANK", branch="PUNE - FERGUSSON COLLEGE ROAD",
    account="50200126043381", cheque_name="CHAMBAL VALLEY AGRO INDUSTRIES PVT LTD", micr="411240003",
    udyam="UDYAM-MP-12-0019284", msme_declared="Small", msme_cert="Small",
)
VENDORS["brahmaputra"] = dict(  # T02 skewed, low-resolution, poorly lit scans, portal
    legal_name="BRAHMAPUTRA TEA MACHINERY PRIVATE LIMITED", form_name="Brahmaputra Tea Machinery Private Limited",
    trade_name="", entity_type="private_limited",
    pan="AAHCB2941R", state_code="18", cin="U29299AS2016PTC017352", inc_date=(11, 7, 2016),
    address="NH 37, Beltola Tiniali", city="Guwahati", state="Assam", pincode="781005",
    contact_name="Dipankar Bora", contact_email="accounts@brahmaputramachinery.in", contact_phone="+91 98640 23517",
    owner_name="Dipankar Bora", website="brahmaputramachinery.in", category="Tea processing machinery",
    ifsc="UTIB0000080", bank="AXIS BANK", branch="MANINAGAR",
    account="917030058126470", cheque_name="BRAHMAPUTRA TEA MACHINERY PVT LTD", micr="380211005",
)
VENDORS["marwar"] = dict(  # T03 formatting variations, other layouts, missing optional fields, Google Form
    legal_name="MARWAR LEATHER WORKS PRIVATE LIMITED", form_name="Marwar Leather Works Private Limited",
    trade_name="", entity_type="private_limited",
    pan="AAGCM7752K", state_code="08", cin="U19201RJ2018PTC060214", inc_date=(19, 9, 2018),
    address="E-112, Basni Industrial Area Phase 2", city="Jodhpur", state="Rajasthan", pincode="342001",
    contact_name="Mahendra Rathore", contact_email="accounts@marwarleather.in", contact_phone="+91 94140 55218",
    owner_name="Mahendra Rathore", website="marwarleather.in", category="Leather goods",
    ifsc="HDFC0000053", bank="HDFC BANK", branch="BANGALORE - KORAMANGALAM",
    account="50100344702918", cheque_name="MARWAR LEATHER WORKS PVT LTD", micr="560240004",
)
VENDORS["varanasi"] = dict(  # T04 Hindi and English documents, different layouts, portal
    legal_name="VARANASI SILK WEAVERS PRIVATE LIMITED", form_name="Varanasi Silk Weavers Private Limited",
    trade_name="", entity_type="private_limited",
    pan="AAHCV6418M", state_code="09", cin="U17119UP2015PTC070447", inc_date=(2, 2, 2015),
    address="D 33/12, Lallapura Road", city="Varanasi", state="Uttar Pradesh", pincode="221001",
    contact_name="Anita Pandey", contact_email="accounts@varanasisilk.in", contact_phone="+91 94150 38264",
    owner_name="Anita Pandey", website="varanasisilk.in", category="Silk fabrics and sarees",
    ifsc="ICIC0000027", bank="ICICI BANK", branch="NASHIK",
    account="004905612387", cheque_name="VARANASI SILK WEAVERS PVT LTD", micr="422229002",
)
VENDORS["pennar"] = dict(  # T05 wrong document uploaded, portal
    legal_name="PENNAR STEEL FABRICATORS PRIVATE LIMITED", form_name="Pennar Steel Fabricators Private Limited",
    trade_name="", entity_type="private_limited",
    pan="AAGCP4036D", state_code="37", cin="U28999AP2016PTC102945", inc_date=(13, 10, 2016),
    address="Door 8-2-17, Gandhi Nagar Industrial Estate", city="Nellore", state="Andhra Pradesh", pincode="524001",
    contact_name="Venkat Naidu", contact_email="accounts@pennarsteel.in", contact_phone="+91 94400 17352",
    owner_name="Venkat Naidu", website="pennarsteel.in", category="Structural steel fabrication",
    ifsc="KKBK0000721", bank="KOTAK MAHINDRA BANK", branch="PUNE",
    account="6623187045", cheque_name="PENNAR STEEL FABRICATORS PVT LTD", micr="411485002",
)
VENDORS["tapti"] = dict(  # T06 sister-company GSTIN, email
    legal_name="TAPTI ENGINEERING WORKS PRIVATE LIMITED", form_name="Tapti Engineering Works Private Limited",
    trade_name="", entity_type="private_limited",
    pan="AAGCT8820B", state_code="24", cin="U28910GJ2017PTC096118", inc_date=(5, 5, 2017),
    address="Plot 77, Pandesara GIDC", city="Surat", state="Gujarat", pincode="395003",
    contact_name="Jignesh Mehta", contact_email="accounts@taptiengineering.in", contact_phone="+91 98250 66431",
    owner_name="Jignesh Mehta", website="taptiengineering.in", category="Engineering components",
    ifsc="UTIB0000080", bank="AXIS BANK", branch="MANINAGAR",
    account="917040072219634", cheque_name="TAPTI ENGINEERING WORKS PVT LTD", micr="380211005",
    gst_pan="AAGCT8826F", gst_legal_name="TAPTI ENGINEERING WORKS (INDIA) PRIVATE LIMITED",
)
VENDORS["rann"] = dict(  # T07 bank account already registered to an approved vendor (Sai Krupa), Google Form
    legal_name="RANN SALT TRADERS PRIVATE LIMITED", form_name="Rann Salt Traders Private Limited",
    trade_name="", entity_type="private_limited",
    pan="AAHCR1273G", state_code="24", cin="U51909GJ2019PTC108833", inc_date=(30, 1, 2019),
    address="Plot 6, Sector 8, Gandhidham", city="Gandhidham", state="Gujarat", pincode="370201",
    contact_name="Bharat Solanki", contact_email="accounts@rannsalt.in", contact_phone="+91 98790 41256",
    owner_name="Bharat Solanki", website="rannsalt.in", category="Industrial salt trading",
    # Account and IFSC of Sai Krupa Fabricators, an approved vendor with a different PAN.
    ifsc="ICIC0000027", bank="ICICI BANK", branch="NASHIK",
    account="002705018342", cheque_name="RANN SALT TRADERS PVT LTD", micr="422229002",
)
VENDORS["aravali"] = dict(  # T08 edited files and handwritten annotations, portal
    legal_name="ARAVALI BRASS HANDICRAFTS PRIVATE LIMITED", form_name="Aravali Brass Handicrafts Private Limited",
    trade_name="", entity_type="private_limited",
    pan="AAFCA9024H", state_code="09", cin="U36999UP2016PTC081530", inc_date=(8, 8, 2016),
    address="Plot 21, Majhola Industrial Area", city="Moradabad", state="Uttar Pradesh", pincode="244001",
    contact_name="Imran Khan", contact_email="accounts@aravalibrass.in", contact_phone="+91 94120 77385",
    owner_name="Imran Khan", website="aravalibrass.in", category="Brass handicrafts",
    ifsc="HDFC0000103", bank="HDFC BANK", branch="PUNE - FERGUSSON COLLEGE ROAD",
    account="50200177630452", cheque_name="ARAVALI BRASS HANDICRAFTS PVT LTD", micr="411240003",
    cheque_software="Adobe Photoshop 25.0 (Windows)",
)
VENDORS["teesta"] = dict(  # T09 transposed PAN digits typed on the form, Google Form
    legal_name="TEESTA VALLEY TEA TRADERS PRIVATE LIMITED", form_name="Teesta Valley Tea Traders Private Limited",
    trade_name="", entity_type="private_limited",
    pan="AAHCT5719E", state_code="19", cin="U15500WB2018PTC226470", inc_date=(21, 6, 2018),
    address="Hill Cart Road, Sevoke More", city="Siliguri", state="West Bengal", pincode="734001",
    contact_name="Sourav Ghosh", contact_email="accounts@teestatea.in", contact_phone="+91 98320 45167",
    owner_name="Sourav Ghosh", website="teestatea.in", category="Tea trading and blending",
    ifsc="ICIC0000027", bank="ICICI BANK", branch="NASHIK",
    account="006105412966", cheque_name="TEESTA VALLEY TEA TRADERS PVT LTD", micr="422229002",
)
VENDORS["mahanadi"] = dict(  # T10 conflicting company names across documents, email
    legal_name="MAHANADI PACKAGING INDUSTRIES PRIVATE LIMITED", form_name="Mahanadi Packaging Industries Private Limited",
    trade_name="", entity_type="private_limited",
    pan="AAHCM4093K", state_code="21", cin="U21021OR2017PTC022871", inc_date=(17, 5, 2017),
    address="Plot 14, Jagatpur Industrial Estate", city="Cuttack", state="Odisha", pincode="753001",
    contact_name="Prasanta Das", contact_email="accounts@mahanadipack.in", contact_phone="+91 94370 28615",
    owner_name="Prasanta Das", website="mahanadipack.in", category="Corrugated packaging",
    ifsc="KKBK0000721", bank="KOTAK MAHINDRA BANK", branch="PUNE",
    account="9915274036", cheque_name="MAHANADI PACKAGERS PVT LTD", micr="411485002",
    gst_legal_name="MAHANADI PACKAGING AND LOGISTICS PRIVATE LIMITED",
)


for v in VENDORS.values():
    v["gstin"] = gstin(v["state_code"], v.get("gst_pan", v["pan"]))
    v.setdefault("gst_legal_name", v["legal_name"])

# --------------------------------------------------------------------------------------------
CONSTITUTION = {"proprietorship": "Proprietorship", "partnership": "Partnership", "llp": "Limited Liability Partnership",
                "public_limited": "Public Limited Company", "private_limited": "Private Limited Company"}

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

    constitution = CONSTITUTION[v["entity_type"]]
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
        ("Constitution of Business", CONSTITUTION[v["entity_type"]]),
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
    constitution = CONSTITUTION[v["entity_type"]]
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
    dict(id="riverside", vendor="riverside", group="example", title="Partnership firm (Google Form)",
         summary="A partnership firm with GST, PAN and cheque - no incorporation certificate needed. Best tried through the Google Form.",
         expected="Approved (bank ownership condition before first payment)"),
    dict(id="anjali", vendor="anjali", group="example", title="Proprietorship, clear documents",
         summary="A sole proprietor: the GST legal name is the owner, the trade name is the business. Clean digital documents.",
         expected="Approved (bank ownership condition before first payment)"),
    dict(id="kalpataru", vendor="kalpataru", group="history", title="History", summary="", expected="Approved"),
    dict(id="suryodaya", vendor="suryodaya", group="history", title="History (MSME Small)", summary="", expected="Approved"),
    dict(id="bharat", vendor="bharat", group="history", title="History (proprietor)", summary="", expected="Approved"),
    dict(id="venkateswara", vendor="venkateswara", group="history", title="History (partnership)", summary="", expected="Approved"),
    dict(id="coastal", vendor="coastal", group="history", title="History (MSME Micro)", summary="", expected="Approved"),
    dict(id="patil", vendor="patil", group="history", title="History (name differs on GST)", summary="", expected="Needs review"),
    dict(id="ganga", vendor="ganga", group="history", title="History (PAN missing)", summary="", expected="Awaiting vendor"),
    dict(id="shivshakti", vendor="shivshakti", group="history", title="History (GST suspended)", summary="", expected="Rejected"),
    dict(id="navkar", vendor="navkar", group="history", title="History (bank account of another company)", summary="", expected="Rejected"),
    dict(id="greenfield", vendor="greenfield", group="history", title="History (bank account of another company)", summary="", expected="Rejected"),
    dict(id="mahalaxmi", vendor="mahalaxmi", group="history", title="History (GSTIN of a sister company)", summary="", expected="Needs review"),
    dict(id="triveni", vendor="triveni", group="history", title="History (cheque bank differs from IFSC)", summary="", expected="Needs review"),
    dict(id="krishna", vendor="krishna", group="history", title="History (MSME category mismatch)", summary="", expected="Needs review"),
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

        if v["entity_type"] in ("private_limited", "public_limited", "llp"):
            files["incorporation"] = write(scn_dir, f"{slug}_Certificate_of_Incorporation.pdf",
                                           incorporation_pdf(v), truth_incorporation(v))
        if s["id"] == "murugan":
            files["gst"] = write(scn_dir, f"{slug}_GST_Certificate_scan.pdf", pdf_to_scanned(gst_pdf, v),
                                 truth_gst(v, scanned=True))
        else:
            files["gst"] = write(scn_dir, f"{slug}_GST_REG-06.pdf", gst_pdf(v), truth_gst(v))
        if s["id"] != "bluewave" and not v.get("skip_pan"):
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

    v = VENDORS["lokseva"]
    lk_dir = os.path.join(PUBLIC, "email-lokseva")
    os.makedirs(os.path.join(lk_dir, "reply"), exist_ok=True)
    lk_files = [
        write(lk_dir, "Lokseva_Certificate_of_Incorporation.pdf", incorporation_pdf(v), truth_incorporation(v)),
        write(lk_dir, "Lokseva_GST_Certificate.pdf", gst_pdf(v), truth_gst(v)),
        write(lk_dir, "Lokseva_PAN.png", pan_card_png(v), truth_pan(v)),
        write(lk_dir, "Lokseva_Udyam.pdf", udyam_pdf(v), truth_udyam(v)),
    ]
    lk_reply = "reply/" + write(os.path.join(lk_dir, "reply"), "Lokseva_Cancelled_Cheque.png", cheque_png(v), truth_cheque(v))
    with open(os.path.join(lk_dir, "EMAIL.txt"), "w", encoding="utf8") as fh:
        fh.write(
            "To: the onboarding inbox\n"
            "Subject: Vendor registration - Lokseva Pashukhadya\n\n"
            "Hello Acme team,\n\nWe manufacture cattle feed and mineral mixture and would like to register as your supplier.\n"
            "Our company documents are attached. We are a registered MSME (Small).\n\n"
            "Regards,\nSandeep Gaikwad\nLokseva Pashukhadya Pvt Ltd\n+91 98221 40576\n\n"
            f"ATTACH (first email): {', '.join(lk_files)}\n"
            f"Then REPLY to VendorIQ's request email and attach: {lk_reply}\n")
    index.append(dict(id="email-lokseva", group="email", title="Email intake: Lokseva Pashukhadya", vendor=v["form_name"],
                      summary="Vendor emails its documents (no cheque); VendorIQ builds the application, asks for the cheque, vendor replies with it.",
                      expected="Waiting for vendor (confirm + cheque) -> reply -> confirm -> Approved", form=form_for(v),
                      files={}, email_files=lk_files, resubmission={"reply": lk_reply}))


    # Video kit: a second clean portal vendor (Approved, standard 60-day terms).
    v = VENDORS["annapurna"]
    an_dir = os.path.join(PUBLIC, "annapurna")
    os.makedirs(an_dir, exist_ok=True)
    an_files = dict(
        incorporation=write(an_dir, "Annapurna_Certificate_of_Incorporation.pdf", incorporation_pdf(v), truth_incorporation(v)),
        gst=write(an_dir, "Annapurna_GST_REG-06.pdf", gst_pdf(v), truth_gst(v)),
        pan=write(an_dir, "Annapurna_PAN_Card.png", pan_card_png(v), truth_pan(v)),
        bank_proof=write(an_dir, "Annapurna_Cancelled_Cheque.png", cheque_png(v), truth_cheque(v)),
    )
    index.append(dict(id="annapurna", group="example", title="Private limited, no MSME", vendor=v["form_name"],
                      summary="A complete, consistent private limited company that is not an MSME. Standard 60-day payment terms.",
                      expected="Approved (bank ownership condition before first payment)", form=form_for(v), files=an_files,
                      resubmission={}))

    # Video kit: a second email-intake vendor (documents only, no cheque, not an MSME).
    v = VENDORS["narmada"]
    nm_dir = os.path.join(PUBLIC, "email-narmada")
    os.makedirs(os.path.join(nm_dir, "reply"), exist_ok=True)
    nm_files = [
        write(nm_dir, "Narmada_Certificate_of_Incorporation.pdf", incorporation_pdf(v), truth_incorporation(v)),
        write(nm_dir, "Narmada_GST_Certificate.pdf", gst_pdf(v), truth_gst(v)),
        write(nm_dir, "Narmada_PAN.png", pan_card_png(v), truth_pan(v)),
    ]
    nm_reply = "reply/" + write(os.path.join(nm_dir, "reply"), "Narmada_Cancelled_Cheque.png", cheque_png(v), truth_cheque(v))
    with open(os.path.join(nm_dir, "EMAIL.txt"), "w", encoding="utf8") as fh:
        fh.write(
            "To: the onboarding inbox\n"
            "Subject: Vendor registration - Narmada Pump Industries\n\n"
            "Hello Acme team,\n\nWe manufacture industrial water pumps and would like to register as your supplier.\n"
            "Our company documents are attached.\n\n"
            "Regards,\nDhruv Mehta\nNarmada Pump Industries Pvt Ltd\n+91 98250 77419\n\n"
            f"ATTACH (first email): {', '.join(nm_files)}\n"
            f"Then REPLY to VendorIQ's request email and attach: {nm_reply}\n")
    index.append(dict(id="email-narmada", group="email", title="Email intake: Narmada Pump Industries", vendor=v["form_name"],
                      summary="Vendor emails three documents (no cheque, not an MSME); VendorIQ builds the application, asks for the cheque, vendor replies with it.",
                      expected="Waiting for vendor (confirm + cheque) -> reply -> confirm -> Approved", form=form_for(v),
                      files={}, email_files=nm_files, resubmission={"reply": nm_reply}))


    # Video kit (final set).
    v = VENDORS["sundaram"]
    sd_dir = os.path.join(PUBLIC, "sundaram")
    os.makedirs(sd_dir, exist_ok=True)
    sd_files = dict(
        incorporation=write(sd_dir, "Sundaram_Certificate_of_Incorporation.pdf", incorporation_pdf(v), truth_incorporation(v)),
        gst=write(sd_dir, "Sundaram_GST_REG-06.pdf", gst_pdf(v), truth_gst(v)),
        pan=write(sd_dir, "Sundaram_PAN_Card.png", pan_card_png(v), truth_pan(v)),
        bank_proof=write(sd_dir, "Sundaram_Cancelled_Cheque.png", cheque_png(v), truth_cheque(v)),
        udyam=write(sd_dir, "Sundaram_Udyam_Certificate.pdf", udyam_pdf(v), truth_udyam(v)),
    )
    index.append(dict(id="sundaram", group="example", title="Private limited, MSME Small", vendor=v["form_name"],
                      summary="A complete, consistent private limited company that is a registered Small enterprise.",
                      expected="Approved (bank ownership condition, pay within 45 days)", form=form_for(v), files=sd_files,
                      resubmission={}))

    v = VENDORS["himalaya"]
    hm_dir = os.path.join(PUBLIC, "email-himalaya")
    os.makedirs(os.path.join(hm_dir, "reply"), exist_ok=True)
    hm_files = [
        write(hm_dir, "Himalaya_Certificate_of_Incorporation.pdf", incorporation_pdf(v), truth_incorporation(v)),
        write(hm_dir, "Himalaya_GST_Certificate.pdf", gst_pdf(v), truth_gst(v)),
        write(hm_dir, "Himalaya_PAN.png", pan_card_png(v), truth_pan(v)),
        write(hm_dir, "Himalaya_Udyam.pdf", udyam_pdf(v), truth_udyam(v)),
    ]
    hm_reply = "reply/" + write(os.path.join(hm_dir, "reply"), "Himalaya_Cancelled_Cheque.png", cheque_png(v), truth_cheque(v))
    with open(os.path.join(hm_dir, "EMAIL.txt"), "w", encoding="utf8") as fh:
        fh.write(f"""To: the onboarding inbox
Subject: Vendor registration - Himalaya Herbal Extracts

Hello Acme team,

We make herbal extracts and supplements and would like to register as your supplier.
Our company documents are attached. We are a registered MSME (Micro).

Regards,
Neha Rawat
Himalaya Herbal Extracts Pvt Ltd
+91 94120 66318

ATTACH (first email): {', '.join(hm_files)}
Then REPLY to VendorIQ's request email and attach: {hm_reply}
""")
    index.append(dict(id="email-himalaya", group="email", title="Email intake: Himalaya Herbal Extracts", vendor=v["form_name"],
                      summary="Vendor emails its documents (no cheque); VendorIQ builds the application, asks for the cheque, vendor replies with it.",
                      expected="Waiting for vendor (confirm + cheque) -> reply -> confirm -> Approved", form=form_for(v),
                      files={}, email_files=hm_files, resubmission={"reply": hm_reply}))

    v = VENDORS["bhavani"]
    bh_dir = os.path.join(PUBLIC, "bhavani")
    os.makedirs(bh_dir, exist_ok=True)
    bh_files = dict(
        incorporation=write(bh_dir, "Bhavani_Certificate_of_Incorporation.pdf", incorporation_pdf(v), truth_incorporation(v)),
        gst=write(bh_dir, "Bhavani_GST_REG-06.pdf", gst_pdf(v), truth_gst(v)),
        pan=write(bh_dir, "Bhavani_PAN_Card.png", pan_card_png(v), truth_pan(v)),
        bank_proof=write(bh_dir, "Bhavani_Cancelled_Cheque.png", cheque_png(v), truth_cheque(v)),
    )
    index.append(dict(id="bhavani", group="demo", title="Cancelled GST registration", vendor=v["form_name"],
                      summary="Everything else is consistent, but the GST registration has been cancelled. Best tried through the Google Form.",
                      expected="Rejected - GST registration cancelled", form=form_for(v), files=bh_files, resubmission={}))

    v = VENDORS["rajputana"]
    rj_dir = os.path.join(PUBLIC, "email-rajputana")
    os.makedirs(rj_dir, exist_ok=True)
    rj_files = [
        write(rj_dir, "Rajputana_Certificate_of_Incorporation.pdf", incorporation_pdf(v), truth_incorporation(v)),
        write(rj_dir, "Rajputana_GST_Certificate.pdf", gst_pdf(v), truth_gst(v)),
        write(rj_dir, "Rajputana_PAN.png", pan_card_png(v), truth_pan(v)),
        write(rj_dir, "Rajputana_Cancelled_Cheque.png", cheque_png(v), truth_cheque(v)),
    ]
    with open(os.path.join(rj_dir, "EMAIL.txt"), "w", encoding="utf8") as fh:
        fh.write(f"""To: the onboarding inbox
Subject: New vendor registration - Rajputana Textiles

Hello Acme team,

We supply block-printed fabrics from Jaipur and would like to register as your supplier.
All four documents, including our cancelled cheque, are attached.

Regards,
Vikram Shekhawat
Rajputana Textiles Pvt Ltd
+91 98290 31472

ATTACH: {', '.join(rj_files)}
""")
    index.append(dict(id="email-rajputana", group="email", title="Email intake: Rajputana Textiles (doctored cheque)", vendor=v["form_name"],
                      summary="Vendor emails a complete set, but the cheque prints HDFC while its IFSC belongs to ICICI and the image was saved from Photoshop.",
                      expected="Waiting for vendor (confirm details) -> confirm -> Needs attention (bank/IFSC mismatch + editing-software hint)",
                      form=form_for(v), files={}, email_files=rj_files, resubmission={}))

    v = VENDORS["nilgiri"]
    nl_dir = os.path.join(PUBLIC, "nilgiri")
    os.makedirs(os.path.join(nl_dir, "resubmission"), exist_ok=True)
    nl_files = dict(
        incorporation=write(nl_dir, "Nilgiri_Certificate_of_Incorporation.pdf", incorporation_pdf(v), truth_incorporation(v)),
        gst=write(nl_dir, "Nilgiri_GST_REG-06.pdf", gst_pdf(v), truth_gst(v)),
        # The mistake: the GST certificate is uploaded again in the PAN slot.
        pan=write(nl_dir, "Nilgiri_Scan_0412.pdf", gst_pdf(v), truth_gst(v)),
        bank_proof=write(nl_dir, "Nilgiri_Cancelled_Cheque.png", cheque_png(v), truth_cheque(v)),
    )
    nl_resub = "resubmission/" + write(os.path.join(nl_dir, "resubmission"), "Nilgiri_PAN_Card.png", pan_card_png(v), truth_pan(v))
    index.append(dict(id="nilgiri", group="demo", title="Wrong document in the PAN field (Google Form)", vendor=v["form_name"],
                      summary="The vendor attached the GST certificate where the PAN card belongs. Best tried through the Google Form; the vendor resubmits the PAN card from the link.",
                      expected="Awaiting vendor (PAN card) -> resubmission -> Approved", form=form_for(v), files=nl_files,
                      resubmission=dict(pan=nl_resub)))

    v = VENDORS["gomti"]
    gm_dir = os.path.join(PUBLIC, "gomti")
    os.makedirs(gm_dir, exist_ok=True)
    gm_files = dict(
        incorporation=write(gm_dir, "Gomti_Certificate_of_Incorporation.pdf", incorporation_pdf(v), truth_incorporation(v)),
        gst=write(gm_dir, "Gomti_GST_REG-06.pdf", gst_pdf(v), truth_gst(v)),
        pan=write(gm_dir, "Gomti_PAN_Card.png", pan_card_png(v), truth_pan(v)),
        bank_proof=write(gm_dir, "Gomti_Cancelled_Cheque.png", cheque_png(v), truth_cheque(v)),
    )
    index.append(dict(id="gomti", group="example", title="Private limited, not MSME", vendor=v["form_name"],
                      summary="A complete, consistent private limited company with four documents and no MSME registration.",
                      expected="Approved (bank ownership condition before first payment)", form=form_for(v), files=gm_files,
                      resubmission={}))

    v = VENDORS["vidarbha"]
    vd_dir = os.path.join(PUBLIC, "email-vidarbha")
    os.makedirs(vd_dir, exist_ok=True)
    vd_files = [
        write(vd_dir, "Vidarbha_Certificate_of_Incorporation.pdf", incorporation_pdf(v), truth_incorporation(v)),
        write(vd_dir, "Vidarbha_GST_Certificate.pdf", gst_pdf(v), truth_gst(v)),
        write(vd_dir, "Vidarbha_PAN.png", pan_card_png(v), truth_pan(v)),
        write(vd_dir, "Vidarbha_Cancelled_Cheque.png", cheque_png(v), truth_cheque(v)),
    ]
    with open(os.path.join(vd_dir, "EMAIL.txt"), "w", encoding="utf8") as fh:
        fh.write(f"""To: the onboarding inbox
Subject: Vendor registration - Vidarbha Office Traders

Hello Acme team,

We supply office stationery and consumables from Nagpur and would like to register as your supplier.
All four documents, including our cancelled cheque, are attached.

Regards,
Rohan Deshpande
Vidarbha Office Traders Pvt Ltd
+91 98230 60418

ATTACH: {', '.join(vd_files)}
""")
    index.append(dict(id="email-vidarbha", group="email", title="Email intake: Vidarbha Office Traders (bank account of another vendor)", vendor=v["form_name"],
                      summary="Vendor emails a complete, consistent set, but the cheque's account already belongs to Apex Facility Services, a different company.",
                      expected="Rejected - bank account linked to another legal entity",
                      form=form_for(v), files={}, email_files=vd_files, resubmission={}))

    v = VENDORS["kakatiya"]
    kt_dir = os.path.join(PUBLIC, "kakatiya")
    os.makedirs(kt_dir, exist_ok=True)
    kt_files = dict(
        incorporation=write(kt_dir, "Kakatiya_Certificate_of_Incorporation.pdf", incorporation_pdf(v), truth_incorporation(v)),
        gst=write(kt_dir, "Kakatiya_GST_REG-06.pdf", gst_pdf(v), truth_gst(v)),
        pan=write(kt_dir, "Kakatiya_PAN_Card.png", pan_card_png(v), truth_pan(v)),
        bank_proof=write(kt_dir, "Kakatiya_Cancelled_Cheque.png", cheque_png(v), truth_cheque(v)),
    )
    index.append(dict(id="kakatiya", group="example", title="Private limited, not MSME (second)", vendor=v["form_name"],
                      summary="A complete, consistent private limited company with four documents and no MSME registration.",
                      expected="Approved (bank ownership condition before first payment)", form=form_for(v), files=kt_files,
                      resubmission={}))

    v = VENDORS["sutlej"]
    sj_dir = os.path.join(PUBLIC, "sutlej")
    os.makedirs(sj_dir, exist_ok=True)
    sj_files = dict(
        incorporation=write(sj_dir, "Sutlej_Certificate_of_Incorporation.pdf", incorporation_pdf(v), truth_incorporation(v)),
        gst=write(sj_dir, "Sutlej_GST_REG-06.pdf", gst_pdf(v), truth_gst(v)),
        pan=write(sj_dir, "Sutlej_PAN_Card.png", pan_card_png(v), truth_pan(v)),
        bank_proof=write(sj_dir, "Sutlej_Cancelled_Cheque.png", cheque_png(v), truth_cheque(v)),
    )
    index.append(dict(id="sutlej", group="example", title="Private limited, not MSME (third)", vendor=v["form_name"],
                      summary="A complete, consistent private limited company with four documents and no MSME registration.",
                      expected="Approved (bank ownership condition before first payment)", form=form_for(v), files=sj_files,
                      resubmission={}))

    v = VENDORS["utkal"]
    uk_dir = os.path.join(PUBLIC, "utkal")
    os.makedirs(os.path.join(uk_dir, "resubmission"), exist_ok=True)
    uk_files = dict(
        incorporation=write(uk_dir, "Utkal_Certificate_of_Incorporation.pdf", incorporation_pdf(v), truth_incorporation(v)),
        gst=write(uk_dir, "Utkal_GST_REG-06.pdf", gst_pdf(v), truth_gst(v)),
        # The mistake: the GST certificate is uploaded again in the PAN slot.
        pan=write(uk_dir, "Utkal_Scan_0719.pdf", gst_pdf(v), truth_gst(v)),
        bank_proof=write(uk_dir, "Utkal_Cancelled_Cheque.png", cheque_png(v), truth_cheque(v)),
    )
    uk_resub = "resubmission/" + write(os.path.join(uk_dir, "resubmission"), "Utkal_PAN_Card.png", pan_card_png(v), truth_pan(v))
    index.append(dict(id="utkal", group="demo", title="Wrong document in the PAN field (Google Form, second)", vendor=v["form_name"],
                      summary="The vendor attached the GST certificate where the PAN card belongs. Best tried through the Google Form; the vendor resubmits the PAN card from the link.",
                      expected="Awaiting vendor (PAN card) -> resubmission -> Approved", form=form_for(v), files=uk_files,
                      resubmission=dict(pan=uk_resub)))

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
                             status="Cancelled" if key == "orion" else v.get("gst_status", "Active"),
                             state_code=v["state_code"],
                             constitution=CONSTITUTION[v["entity_type"]]))
    with open(os.path.join(FIXTURES, "gst_registry.json"), "w") as fh:
        json.dump(registry, fh, indent=2)

    print(f"Generated {len(index)} scenarios, {len(truth)} documents.")
    for s in index:
        print(f"  {s['id']:10s} gstin={s['form']['gstin']}  files={list(s['files'].values())}")


if __name__ == "__main__":
    main()
