"""
Builds public/testing: ten test cases (all three channels) for the realistic-variation and adversarial datasets.

Every company, ID and account number is fictional. Reuses the renderers and vendors of generate_fixtures.py and
adds degraded and varied documents: skewed scans, low resolution, poor lighting, Hindi and English text, other
page layouts, handwritten annotations and edited-file metadata.

Run (after python scripts/generate_fixtures.py, so the GST registry knows the vendors):
    python scripts/build_testing_kit.py
"""

import io
import os
import random
import shutil
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import generate_fixtures as g  # noqa: E402

OUT = os.path.join(g.ROOT, "public", "testing")
V = g.VENDORS
random.seed(21)
np.random.seed(21)

HINDI = "C:/Windows/Fonts/Nirmala.ttc"
HAND = "C:/Windows/Fonts/Inkfree.ttf"


def pil_font(path, size):
    return ImageFont.truetype(path, size)


# --------------------------------------------------------------------------------------------
# Degradations
# --------------------------------------------------------------------------------------------

def to_img(b: bytes) -> Image.Image:
    return Image.open(io.BytesIO(b)).convert("RGB")


def to_png(img: Image.Image) -> bytes:
    out = io.BytesIO()
    img.save(out, "PNG")
    return out.getvalue()


def to_jpeg(img: Image.Image, quality: int) -> bytes:
    out = io.BytesIO()
    img.convert("RGB").save(out, "JPEG", quality=quality)
    return out.getvalue()


def low_res_jpeg(png: bytes, factor: float = 0.42, quality: int = 28) -> bytes:
    """A small, heavily compressed copy, like a photo forwarded through a chat app."""
    img = to_img(png)
    img = img.resize((int(img.size[0] * factor), int(img.size[1] * factor)), Image.LANCZOS)
    return to_jpeg(img, quality)


def poor_light_jpeg(png: bytes, rotation: float = 2.6) -> bytes:
    """A phone photo under a lamp: shadow across the left side, warm cast, noise, slight tilt and blur."""
    img = to_img(png)
    w, h = img.size
    arr = np.asarray(img).astype(np.float32)
    xs = np.linspace(0.42, 1.0, w)[None, :, None]
    ys = np.linspace(1.0, 0.78, h)[:, None, None]
    arr = arr * xs * ys
    arr[..., 0] *= 1.06
    arr[..., 2] *= 0.88
    arr = np.clip(arr + np.random.normal(0, 7, arr.shape), 0, 255).astype(np.uint8)
    img = Image.fromarray(arr).rotate(rotation, expand=True, fillcolor=(46, 40, 34))
    img = img.filter(ImageFilter.GaussianBlur(1.2))
    return to_jpeg(img, 46)


def image_pdf(img: Image.Image, quality: int = 80) -> bytes:
    """An image-only A4 PDF (no text layer)."""
    jpg = io.BytesIO()
    img.convert("RGB").save(jpg, "JPEG", quality=quality)
    jpg.seek(0)
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    pw, ph = A4
    iw, ih = img.size
    scale = min((pw - 30 * mm) / iw, (ph - 40 * mm) / ih)
    c.drawImage(ImageReader(jpg), 15 * mm, ph - 20 * mm - ih * scale, iw * scale, ih * scale)
    c.showPage()
    c.save()
    return buf.getvalue()


def skewed_scan_pdf(page: Image.Image, rotation: float = 4.2, blur: float = 1.3) -> bytes:
    return g.degrade_to_scanned_pdf(to_png(page), rotation=rotation, blur=blur)


def wobbly_ellipse(d, cx, cy, rx, ry, ink, width=4):
    pts = []
    for i in range(0, 380, 6):
        a = np.radians(i)
        j = 1 + random.uniform(-0.035, 0.035)
        pts.append((cx + rx * j * np.cos(a) + i * 0.02, cy + ry * j * np.sin(a)))
    d.line(pts, fill=ink, width=width, joint="curve")


def annotate(png: bytes, pan_box, notes) -> bytes:
    """Pen marks over a document: a circle around a value, a tick and handwritten remarks."""
    img = to_img(png)
    d = ImageDraw.Draw(img)
    ink = (22, 52, 168)
    x0, y0, x1, y1 = pan_box
    wobbly_ellipse(d, (x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2 + 30, (y1 - y0) / 2 + 16, ink)
    f = pil_font(HAND, 34)
    for (x, y, text) in notes:
        d.text((x, y), text, font=f, fill=ink)
    d.line([(520, 372), (552, 404), (626, 338)], fill=ink, width=6)
    d.line([(60, 560), (330, 548), (590, 561)], fill=(30, 30, 30), width=3)
    return to_png(img)


# --------------------------------------------------------------------------------------------
# Documents drawn as images (scanned look), English and Hindi
# --------------------------------------------------------------------------------------------

def incorporation_page(v, hindi=False) -> Image.Image:
    W, H = 1240, 1754
    img = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(img)
    fb, f, fs = g.font("timesbd.ttf", 34), g.font("times.ttf", 28), g.font("times.ttf", 22)
    hb = pil_font(HINDI, 30)
    d.rectangle([40, 40, W - 40, H - 40], outline="#1f3b6e", width=5)
    d.text((W // 2 - 190, 110), "GOVERNMENT OF INDIA", font=fb, fill="black")
    d.text((W // 2 - 205, 160), "MINISTRY OF CORPORATE AFFAIRS", font=f, fill="black")
    y = 215
    if hindi:
        d.text((W // 2 - 205, y), "भारत सरकार  -  कॉर्पोरेट कार्य मंत्रालय", font=hb, fill="black")
        y += 55
    d.text((W // 2 - 215, y + 30), "Certificate of Incorporation", font=g.font("timesbd.ttf", 44), fill="black")
    if hindi:
        d.text((W // 2 - 150, y + 100), "निगमन प्रमाण पत्र", font=pil_font(HINDI, 36), fill="black")
        y += 60
    dd, mm_, yy = v["inc_date"]
    lines = [
        f"I hereby certify that {v['legal_name']}",
        f"is incorporated on the {g.ORDINAL_DAYS[dd]} day of {g.MONTHS[mm_ - 1]} {g.YEAR_WORDS[yy]}",
        "under the Companies Act, 2013 and that the company is limited by shares.",
        "",
        f"The Corporate Identity Number of the company is {v['cin']}.",
        f"The Permanent Account Number (PAN) of the company is {v['pan']}.",
    ]
    yy_ = y + 200
    for ln in lines:
        d.text((110, yy_), ln, font=f, fill="black")
        yy_ += 52
    if hindi:
        d.text((110, yy_ + 20), "कंपनी का कॉर्पोरेट पहचान संख्या:  " + v["cin"], font=pil_font(HINDI, 28), fill="black")
        yy_ += 70
    d.text((110, yy_ + 60), "Registrar of Companies", font=fb, fill="black")
    d.text((110, H - 330), "Mailing address as per record available in Registrar of Companies office:", font=fs, fill="black")
    d.text((110, H - 290), v["legal_name"], font=fs, fill="black")
    d.text((110, H - 255), f"{v['address']}, {v['city']}, {v['state']}, India - {v['pincode']}", font=fs, fill="black")
    d.text((110, H - 120), g.FOOTER, font=g.font("ariali.ttf", 18), fill="#777777")
    return img


def gst_page(v, hindi=False) -> Image.Image:
    W, H = 1240, 1754
    img = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(img)
    fb, f, fs = g.font("arialbd.ttf", 32), g.font("arial.ttf", 25), g.font("arial.ttf", 20)
    hf, hb = pil_font(HINDI, 25), pil_font(HINDI, 32)
    d.text((W // 2 - 150, 90), "Government of India", font=fb, fill="black")
    y = 140
    if hindi:
        d.text((W // 2 - 80, y), "भारत सरकार", font=hb, fill="black")
        y += 52
    d.text((W // 2 - 130, y + 10), "Form GST REG-06", font=fb, fill="black")
    d.text((W // 2 - 175, y + 60), "Registration Certificate", font=fb, fill="black")
    if hindi:
        d.text((W // 2 - 200, y + 110), "वस्तु एवं सेवा कर - पंजीकरण प्रमाण पत्र", font=hb, fill="black")
        y += 55
    d.text((90, y + 170), f"Registration Number : {v['gstin']}", font=fb, fill="black")
    rows = [
        ("Legal Name", "कानूनी नाम", v["gst_legal_name"]),
        ("Trade Name, if any", "व्यापार का नाम", v["trade_name"] or v["gst_legal_name"]),
        ("Constitution of Business", "व्यवसाय का गठन", g.CONSTITUTION[v["entity_type"]]),
        ("Address of Principal Place of Business", "प्रधान व्यवसाय स्थान का पता", f"{v['address']}, {v['city']},"),
        ("", "", f"{v['state']}, {v['pincode']}"),
        ("Date of Liability", "देयता की तिथि", "01/07/2017"),
        ("Type of Registration", "पंजीकरण का प्रकार", "Regular"),
    ]
    yy = y + 260
    for en, hi, val in rows:
        d.text((90, yy), en, font=f, fill="black")
        if hindi and hi:
            d.text((90, yy + 32), hi, font=hf, fill="#333333")
        d.text((600, yy), val, font=f, fill="black")
        yy += 98 if hindi else 66
    d.text((90, yy + 40), "Digitally signed by DS GOODS AND SERVICES TAX NETWORK", font=fs, fill="black")
    d.text((90, H - 80), g.FOOTER, font=g.font("ariali.ttf", 17), fill="#777777")
    return img


def pan_card_hindi(v) -> bytes:
    """PAN card with Hindi and English labels, as real cards carry both."""
    W, H = 1012, 638
    img = Image.new("RGB", (W, H), "#dfe9f2")
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, W, 92], fill="#0f4c81")
    d.text((30, 10), "आयकर विभाग", font=pil_font(HINDI, 34), fill="white")
    d.text((30, 52), "INCOME TAX DEPARTMENT", font=g.font("arialbd.ttf", 26), fill="white")
    d.text((W - 300, 10), "भारत सरकार", font=pil_font(HINDI, 34), fill="white")
    d.text((W - 300, 52), "GOVT. OF INDIA", font=g.font("arialbd.ttf", 26), fill="white")
    d.text((30, 108), "स्थायी लेखा संख्या कार्ड  /  Permanent Account Number Card", font=pil_font(HINDI, 24), fill="#1b2a3a")
    d.text((30, 146), v["pan"], font=g.font("arialbd.ttf", 46), fill="#111111")
    d.text((30, 232), "नाम / Name", font=pil_font(HINDI, 22), fill="#3c4a5a")
    size = 30
    while size > 16 and d.textlength(v["legal_name"], font=g.font("arialbd.ttf", size)) > W - 290:
        size -= 1
    d.text((30, 262), v["legal_name"], font=g.font("arialbd.ttf", size), fill="#111111")
    dd, mm_, yy = v["inc_date"]
    d.text((30, 330), "निगमन की तारीख / Date of Incorporation", font=pil_font(HINDI, 22), fill="#3c4a5a")
    d.text((30, 360), f"{dd:02d}/{mm_:02d}/{yy}", font=g.font("arialbd.ttf", 28), fill="#111111")
    d.rectangle([W - 230, 120, W - 40, 330], outline="#7a8a9a", width=3, fill="#eef3f8")
    d.text((W - 196, 212), "QR", font=g.font("arial.ttf", 26), fill="#7a8a9a")
    d.text((30, H - 44), "SYNTHETIC TEST DOCUMENT - not a government record", font=g.font("ariali.ttf", 18), fill="#7a8a9a")
    return to_png(img)


# --------------------------------------------------------------------------------------------
# Other page layouts (text PDFs)
# --------------------------------------------------------------------------------------------

def gst_landscape_pdf(v) -> bytes:
    """GST certificate laid out as a landscape card with labelled boxes instead of a numbered table."""
    buf = io.BytesIO()
    pw, ph = landscape(A4)
    c = canvas.Canvas(buf, pagesize=landscape(A4))
    c.setFillColor(HexColor("#0b3d2e"))
    c.rect(0, ph - 34 * mm, pw, 34 * mm, stroke=0, fill=1)
    c.setFillColor(HexColor("#ffffff"))
    c.setFont("Helvetica-Bold", 20)
    c.drawString(18 * mm, ph - 16 * mm, "GOODS AND SERVICES TAX")
    c.setFont("Helvetica", 11)
    c.drawString(18 * mm, ph - 24 * mm, "Certificate of Registration (Form GST REG-06)")
    c.setFillColor(HexColor("#000000"))
    c.setFont("Helvetica-Bold", 14)
    c.drawString(18 * mm, ph - 48 * mm, f"GSTIN / UIN:  {v['gstin']}")
    boxes = [
        ("LEGAL NAME OF BUSINESS", v["gst_legal_name"]),
        ("TRADE NAME", v["trade_name"] or v["gst_legal_name"]),
        ("CONSTITUTION", g.CONSTITUTION[v["entity_type"]]),
        ("REGISTRATION TYPE", "Regular"),
        ("EFFECTIVE FROM", "01/07/2017"),
        ("STATE", v["state"]),
    ]
    bw, bh = 120 * mm, 22 * mm
    for i, (k, val) in enumerate(boxes):
        col, row = i % 2, i // 2
        x = 18 * mm + col * (bw + 8 * mm)
        y = ph - 62 * mm - row * (bh + 6 * mm)
        c.setStrokeColor(HexColor("#0b3d2e"))
        c.rect(x, y - bh, bw, bh)
        c.setFont("Helvetica", 8)
        c.setFillColor(HexColor("#555555"))
        c.drawString(x + 3 * mm, y - 6 * mm, k)
        c.setFillColor(HexColor("#000000"))
        c.setFont("Helvetica-Bold", 11)
        c.drawString(x + 3 * mm, y - 15 * mm, val)
    ya = ph - 62 * mm - 3 * (bh + 6 * mm)
    c.setStrokeColor(HexColor("#0b3d2e"))
    c.rect(18 * mm, ya - bh, 2 * bw + 8 * mm, bh)
    c.setFont("Helvetica", 8)
    c.setFillColor(HexColor("#555555"))
    c.drawString(21 * mm, ya - 6 * mm, "PRINCIPAL PLACE OF BUSINESS")
    c.setFillColor(HexColor("#000000"))
    c.setFont("Helvetica-Bold", 11)
    c.drawString(21 * mm, ya - 15 * mm, f"{v['address']}, {v['city']}, {v['state']} - {v['pincode']}")
    c.setFont("Helvetica-Oblique", 7)
    c.setFillColor(HexColor("#888888"))
    c.drawCentredString(pw / 2, 10 * mm, g.FOOTER)
    c.showPage()
    c.save()
    return buf.getvalue()


def incorporation_letter_pdf(v) -> bytes:
    """Certificate of incorporation as a plain letter with a details table."""
    buf = io.BytesIO()
    pw, ph = A4
    c = canvas.Canvas(buf, pagesize=A4)
    c.setFont("Helvetica-Bold", 15)
    c.drawString(22 * mm, ph - 30 * mm, "Registrar of Companies")
    c.setFont("Helvetica", 10)
    c.drawString(22 * mm, ph - 36 * mm, "Ministry of Corporate Affairs, Government of India")
    c.line(22 * mm, ph - 40 * mm, pw - 22 * mm, ph - 40 * mm)
    c.setFont("Helvetica-Bold", 17)
    c.drawString(22 * mm, ph - 56 * mm, "CERTIFICATE OF INCORPORATION")
    dd, mm_, yy = v["inc_date"]
    rows = [
        ("Name of the company", v["legal_name"]),
        ("Corporate Identity Number (CIN)", v["cin"]),
        ("Permanent Account Number (PAN)", v["pan"]),
        ("Date of incorporation", f"{dd:02d}-{g.MONTHS[mm_ - 1][:3]}-{yy}"),
        ("Class of company", "Private, limited by shares"),
        ("Registered office", f"{v['address']}, {v['city']}, {v['state']} - {v['pincode']}"),
    ]
    y = ph - 74 * mm
    for k, val in rows:
        c.setStrokeColor(HexColor("#999999"))
        c.rect(22 * mm, y - 10 * mm, pw - 44 * mm, 10 * mm)
        c.line(82 * mm, y, 82 * mm, y - 10 * mm)
        c.setFont("Helvetica-Bold", 9.5)
        c.drawString(25 * mm, y - 6.5 * mm, k)
        c.setFont("Helvetica", 9.5)
        text = val if c.stringWidth(val, "Helvetica", 9.5) < pw - 44 * mm - 66 * mm else val[:70]
        c.drawString(85 * mm, y - 6.5 * mm, text)
        y -= 10 * mm
    c.setFont("Helvetica", 10)
    c.drawString(22 * mm, y - 14 * mm, "This certificate is issued under the Companies Act, 2013.")
    c.setFont("Helvetica-Bold", 10)
    c.drawRightString(pw - 22 * mm, y - 40 * mm, "Registrar of Companies")
    c.setFont("Helvetica-Oblique", 7)
    c.setFillColor(HexColor("#888888"))
    c.drawCentredString(pw / 2, 12 * mm, g.FOOTER)
    c.showPage()
    c.save()
    return buf.getvalue()


def mark_edited(pdf: bytes, tool: str = "Canva") -> bytes:
    """Replace the PDF producer with an editing tool, keeping the file length identical."""
    old = b"ReportLab PDF Library - \(opensource\)"
    assert old in pdf, "producer string not found"
    return pdf.replace(old, tool.encode().ljust(len(old), b" "))


# --------------------------------------------------------------------------------------------
# Case descriptions
# --------------------------------------------------------------------------------------------

ENTITY_LABEL = {"private_limited": "Private Limited Company"}


def table(v, over=None, msme=False):
    """The values a tester types into the portal or the Google Form."""
    over = over or {}
    rows = [
        ("Legal name of business", over.get("legal_name", v["form_name"])),
        ("Entity type", ENTITY_LABEL[v["entity_type"]]),
        ("Proprietor / authorised signatory", over.get("owner_name", v["owner_name"])),
        ("PAN", over.get("pan", v["pan"])),
        ("GSTIN", over.get("gstin", v["gstin"])),
        ("CIN", over.get("cin", v["cin"])),
        ("Registered address", v["address"]),
        ("City", v["city"]),
        ("State", v["state"]),
        ("PIN code", v["pincode"]),
        ("Contact person", over.get("contact_name", v["contact_name"])),
        ("Contact email", "your own email address"),
        ("Phone", over.get("phone", v["contact_phone"])),
        ("What you supply", over.get("category", v["category"])),
        ("Account holder name", over.get("holder", v["cheque_name"].title())),
        ("Account number", over.get("account", v["account"])),
        ("IFSC", over.get("ifsc", v["ifsc"])),
        ("Bank name", over.get("bank", v["bank"].title().replace("Icici", "ICICI").replace("Hdfc", "HDFC"))),
        ("MSME (Udyam) registered?", "Yes" if v.get("udyam") else "No"),
    ]
    if v.get("udyam"):
        rows += [("Udyam number", v["udyam"]), ("MSME category", v["msme_declared"])]
    out = ["| Field | Value |", "|---|---|"]
    for k, val in rows:
        out.append(f"| {k} | {('`' + val + '`') if val != '' else '*(leave blank)*'} |")
    return "\n".join(out)


def md(path, text):
    with open(path, "w", encoding="utf8") as fh:
        fh.write(text.strip() + "\n")


def save(d, name, data):
    with open(os.path.join(d, name), "wb") as fh:
        fh.write(data)
    return name


def case_dir(folder):
    d = os.path.join(OUT, folder)
    os.makedirs(d, exist_ok=True)
    return d


def files_list(names, note=""):
    return "\n".join(f"- `{n}`{(' ' + note) if note else ''}" for n in names)


EMAIL_TO = "acmevendoronboarding@gmail.com"

PORTAL_STEPS = """1. Sign in to the company portal in your browser (open `https://zamp-prep.vercel.app/go`), then open the supplier portal: **Become a supplier**, then **Apply**.
2. Type the values from the table below (use **your own email** as the contact email) and attach the files listed.
3. Press **Submit application** and watch the run page.
4. Open the vendor under **All vendors** and read the **Checks** tab."""

FORM_STEPS = """1. Open the live Google Form: https://docs.google.com/forms/d/e/1FAIpQLScKSR6gw7gLbEeBdnJIfayYgipGbyclKOuP7RKfSfRN9_4M8g/viewform
2. Type the values from the table below exactly as shown (use **your own email**), choose *Private Limited Company*, and attach the files listed.
3. Submit. The application appears in **All vendors** with a *Google Form* tag within about a minute.
4. Open the vendor and read the **Checks** tab."""

EMAIL_STEPS = f"""1. Open Gmail and write a new email **to `{EMAIL_TO}`** from your own account.
2. Use the subject and body below and attach all the files listed.
3. Send. The inbox is checked every minute, so the vendor appears in **All vendors** with an *Email* tag within about a minute.
4. Open the vendor and read the **Checks** tab. An email application always asks the vendor to **confirm the details read from the documents** first: open the link in the request email, check the pre-filled values and press **Confirm**. The full checks then run again."""


def email_text(v, subject, para):
    return f"""Subject: `{subject}`

```
Hello Acme team,

{para}

Regards,
{v['contact_name']}
{v['form_name'].replace('Private Limited', 'Pvt Ltd')}
{v['contact_phone']}
```"""


CASES = []


def case(**kw):
    CASES.append(kw)


# ------------------------------------------------------------------ T01
def build_t01():
    v = V["chambal"]
    d = case_dir("T01-A-happy-path-email")
    names = [
        save(d, "Chambal_Certificate_of_Incorporation.pdf", g.incorporation_pdf(v)),
        save(d, "Chambal_GST_Certificate.pdf", g.gst_pdf(v)),
        save(d, "Chambal_PAN.png", g.pan_card_png(v)),
        save(d, "Chambal_Cancelled_Cheque.png", g.cheque_png(v)),
        save(d, "Chambal_Udyam_Certificate.pdf", g.udyam_pdf(v)),
    ]
    md(os.path.join(d, "HOW-TO-TEST.md"), f"""
# T01: Complete, consistent vendor (Dataset A, happy path), by email

**Channel:** Email (Gmail). **Tests:** complete details, correct documents, matching identifiers, valid bank information, consistent company details. A registered Small MSME.

## How to test
{EMAIL_STEPS}

## Email
{email_text(v, "Vendor registration - Chambal Valley Agro Industries", "We supply agricultural inputs and seeds from Gwalior and would like to register as your supplier. Our five documents are attached. We are a registered MSME (Small).")}

## Files to attach (all five)
{files_list(names)}

## Expected result
1. **Waiting for vendor** first: *Confirm your details* (the details were read from the documents).
2. After you confirm: **Approved**, with two conditions: *confirm bank ownership before the first payment* and *pay within 45 days (MSME Small)*. An ERP vendor record appears.
3. Every identifier check is green: PAN, GSTIN with checksum, CIN, IFSC, pincode against state, names across all five documents.

## Fails if
It is rejected or sent to Needs attention, or a check is red or reports a mismatch. Nothing in this case is wrong.
""")
    return dict(id="T01", folder="T01-A-happy-path-email", dataset="A: Happy path", channel="Email", title="Complete, consistent vendor with MSME certificate",
                expected="Waiting (confirm) → Approved, 45-day condition", vendor=v["form_name"])


# ------------------------------------------------------------------ T02
def build_t02():
    v = V["brahmaputra"]
    d = case_dir("T02-B-skewed-lowres-poor-light-portal")
    names = [
        save(d, "Brahmaputra_Incorporation_skewed_scan.pdf", skewed_scan_pdf(incorporation_page(v), rotation=4.4, blur=1.4)),
        save(d, "Brahmaputra_GST_skewed_scan.pdf", skewed_scan_pdf(gst_page(v), rotation=-3.8, blur=1.5)),
        save(d, "Brahmaputra_PAN_lowres.jpg", low_res_jpeg(g.pan_card_png(v))),
        save(d, "Brahmaputra_Cheque_poor_light.jpg", poor_light_jpeg(g.cheque_png(v))),
    ]
    md(os.path.join(d, "HOW-TO-TEST.md"), f"""
# T02: Skewed, low-resolution and poorly lit scans (Dataset B, robustness), by portal

**Channel:** Supplier portal. **Tests:** skewed scans, low-resolution images, poor lighting. The form values are correct; only the *quality of the documents* is bad.

| Document | Problem |
|---|---|
| Certificate of incorporation | image-only PDF, tilted 4 degrees, blurred, noisy, low contrast |
| GST certificate | image-only PDF, tilted the other way, blurred, noisy |
| PAN card | tiny, heavily compressed JPEG (about 425 x 268 pixels) |
| Cancelled cheque | phone photo under a lamp: shadow on the left, warm cast, tilted |

## How to test
{PORTAL_STEPS}

## Form values
{table(v)}

## Files
{files_list(names)}

## Expected result
Either outcome is acceptable, but the system must be **honest about the quality**:
- **Approved** (bank ownership condition), with the readings marked as lower confidence; **or**
- **Needs attention** or **Waiting for vendor** because a field was too unclear to confirm, with the unclear field named.

## Fails if
A wrong value is silently accepted (for example a different account number read from the blurred cheque and still shown as passed), or the run crashes instead of finishing.
Look at **Checks** and the document viewer: low-confidence fields should say so. Compare each extracted value with the table above.
""")
    return dict(id="T02", folder="T02-B-skewed-lowres-poor-light-portal", dataset="B: Realistic variations", channel="Portal", title="Skewed scans, low resolution, poor lighting",
                expected="Approved with low-confidence notes, or Needs attention naming the unclear field", vendor=v["form_name"])


# ------------------------------------------------------------------ T03
def build_t03():
    v = V["marwar"]
    d = case_dir("T03-B-formatting-layouts-form")
    names = [
        save(d, "Marwar_Incorporation_letter_layout.pdf", incorporation_letter_pdf(v)),
        save(d, "Marwar_GST_landscape_layout.pdf", gst_landscape_pdf(v)),
        save(d, "Marwar_PAN.png", g.pan_card_png(v)),
        save(d, "Marwar_Cancelled_Cheque.png", g.cheque_png(v)),
    ]
    over = dict(legal_name="MARWAR LEATHER WORKS PVT. LTD.", pan="aagcm7752k", gstin="08aagcm7752k1zy", cin="u19201rj2018ptc060214",
                account="5010 0344 7029 18", ifsc="hdfc0000053", bank="hdfc bank", holder="marwar leather works pvt ltd", phone="09414055218")
    md(os.path.join(d, "HOW-TO-TEST.md"), f"""
# T03: Formatting variations, other page layouts and missing optional fields (Dataset B), by Google Form

**Channel:** Google Form. **Tests:** different capitalisation, minor formatting variations, different PDF layouts, missing optional fields.

| Variation | Where |
|---|---|
| ALL CAPS name with dots (`PVT. LTD.`) | form legal name (documents say `PRIVATE LIMITED`) |
| lowercase PAN, GSTIN, CIN, IFSC and bank name | form |
| account number with spaces (`5010 0344 7029 18`) | form |
| phone as `09414055218` (no +91, no spaces) | form |
| incorporation certificate as a plain letter with a table | document |
| GST certificate as a landscape card with boxes (label `GSTIN / UIN`) | document |
| left blank: trade name, what you supply, website | form |

## How to test
{FORM_STEPS}

## Form values (type them exactly like this, including the lowercase)
| Field | Value |
|---|---|
| Legal name of business | `{over['legal_name']}` |
| Entity type | `Private Limited Company` |
| Proprietor / authorised signatory | *(leave blank)* |
| PAN | `{over['pan']}` |
| GSTIN | `{over['gstin']}` |
| CIN | `{over['cin']}` |
| Registered address | `{v['address']}` |
| City | `{v['city']}` |
| State | `{v['state']}` |
| PIN code | `{v['pincode']}` |
| Contact person | `{v['contact_name']}` |
| Contact email | your own email address |
| Phone | `{over['phone']}` |
| What you supply | *(leave blank)* |
| Account holder name | `{over['holder']}` |
| Account number | `{over['account']}` |
| IFSC | `{over['ifsc']}` |
| Bank name | `{over['bank']}` |
| MSME (Udyam) registered? | `No` |

## Files
{files_list(names)}

## Expected result
**Approved** (bank ownership condition). The system normalises case, spaces and legal-form abbreviations before comparing, so none of these differences raises a flag. Blank optional fields do not trigger a request.

## Fails if
The vendor is asked to "fix" its PAN, GSTIN or account number (the values are right, only formatted differently), or the names are called a mismatch, or the landscape GST layout is not read.
""")
    return dict(id="T03", folder="T03-B-formatting-layouts-form", dataset="B: Realistic variations", channel="Google Form", title="Capitalisation, formatting, other layouts, missing optional fields",
                expected="Approved (all variations normalised)", vendor=v["form_name"])


# ------------------------------------------------------------------ T04
def build_t04():
    v = V["varanasi"]
    d = case_dir("T04-B-hindi-english-layouts-portal")
    names = [
        save(d, "Varanasi_Incorporation_letter_layout.pdf", incorporation_letter_pdf(v)),
        save(d, "Varanasi_GST_Hindi_English_scan.pdf", image_pdf(gst_page(v, hindi=True), 78)),
        save(d, "Varanasi_PAN_Hindi_English.png", pan_card_hindi(v)),
        save(d, "Varanasi_Cancelled_Cheque.png", g.cheque_png(v)),
    ]
    md(os.path.join(d, "HOW-TO-TEST.md"), f"""
# T04: Hindi and English documents with different layouts (Dataset B), by portal

**Channel:** Supplier portal. **Tests:** multiple languages, different document layouts.

| Document | Variation |
|---|---|
| PAN card | Hindi and English labels (आयकर विभाग, नाम, निगमन की तारीख) |
| GST certificate | image-only scan with every label in Hindi and English (पंजीकरण प्रमाण पत्र, कानूनी नाम) |
| Certificate of incorporation | plain letter with a details table (not the usual certificate layout) |
| Cancelled cheque | standard |

## How to test
{PORTAL_STEPS}

## Form values
{table(v)}

## Files
{files_list(names)}

## Expected result
**Approved** (bank ownership condition). The readings come from the English values next to the Hindi labels: names, PAN, GSTIN and CIN match the form, and the document types are identified correctly (PAN card, GST certificate, certificate of incorporation).

## Fails if
A document is called "other" or the wrong type, the Hindi text is copied into a field (for example the legal name read as कानूनी नाम), or a value that is plainly on the page is reported as missing.
""")
    return dict(id="T04", folder="T04-B-hindi-english-layouts-portal", dataset="B: Realistic variations", channel="Portal", title="Hindi and English documents, different layouts",
                expected="Approved (bank ownership condition)", vendor=v["form_name"])


# ------------------------------------------------------------------ T05
def build_t05():
    v = V["pennar"]
    d = case_dir("T05-C-wrong-document-portal")
    pan = g.pan_card_png(v)
    names = [
        save(d, "Pennar_Incorporation.pdf", g.incorporation_pdf(v)),
        save(d, "Pennar_GST_Certificate_scan.png", pan),
        save(d, "Pennar_PAN.png", pan),
        save(d, "Pennar_Cancelled_Cheque.png", g.cheque_png(v)),
    ]
    os.makedirs(os.path.join(d, "send-later"), exist_ok=True)
    save(os.path.join(d, "send-later"), "Pennar_GST_Certificate.pdf", g.gst_pdf(v))
    md(os.path.join(d, "HOW-TO-TEST.md"), f"""
# T05: Wrong document uploaded (Dataset C, adversarial), by portal

**Channel:** Supplier portal. **Tests:** wrong document in a slot. `Pennar_GST_Certificate_scan.png` is really a **second copy of the PAN card**, so the *GST certificate* slot holds the wrong file.

## How to test
{PORTAL_STEPS}
5. Attach `Pennar_GST_Certificate_scan.png` in the **GST certificate** slot (the mistake) and `Pennar_PAN.png` in the PAN slot.
6. Wait for the request email, open its link, upload `send-later/Pennar_GST_Certificate.pdf` and submit.

## Form values
{table(v)}

## Files
{files_list(names)}
- `send-later/Pennar_GST_Certificate.pdf` (the correct file, for step 6)

## Expected result
1. **Waiting for vendor** with the check *"The file in this slot is a PAN card, not a GST certificate"*. The vendor is asked for exactly one thing: the GST registration certificate. It is **not rejected**.
2. After step 6 only the GST-related checks re-run (the other documents are not re-read) and the result is **Approved** (bank ownership condition).

## Fails if
The wrong file is accepted as a GST certificate, the vendor is rejected, or the request asks for more than the GST certificate.
""")
    return dict(id="T05", folder="T05-C-wrong-document-portal", dataset="C: Adversarial", channel="Portal", title="Wrong document uploaded (PAN card in the GST slot)",
                expected="Waiting for vendor (GST certificate) → Approved after resubmission", vendor=v["form_name"])


# ------------------------------------------------------------------ T06
def build_t06():
    v = V["tapti"]
    d = case_dir("T06-C-sister-company-gstin-email")
    names = [
        save(d, "Tapti_Certificate_of_Incorporation.pdf", g.incorporation_pdf(v)),
        save(d, "Tapti_GST_Certificate.pdf", g.gst_pdf(v)),
        save(d, "Tapti_PAN.png", g.pan_card_png(v)),
        save(d, "Tapti_Cancelled_Cheque.png", g.cheque_png(v)),
    ]
    md(os.path.join(d, "HOW-TO-TEST.md"), f"""
# T06: Sister-company GSTIN (Dataset C, adversarial), by email

**Channel:** Email. **Tests:** sister-company GSTIN, mismatched company names. The GST certificate belongs to **TAPTI ENGINEERING WORKS (INDIA) PRIVATE LIMITED** (a different PAN, `{v['gst_pan']}`); the PAN card and incorporation certificate belong to **TAPTI ENGINEERING WORKS PRIVATE LIMITED** (PAN `{v['pan']}`). Every field is valid on its own and the names are almost identical.

## How to test
{EMAIL_STEPS}

## Email
{email_text(v, "Vendor registration - Tapti Engineering Works", "We supply engineering components from Surat and would like to register as your supplier. Our four documents are attached.")}

## Files to attach
{files_list(names)}

## Expected result
1. **Waiting for vendor** (confirm the details), as for every email application.
2. After you confirm: **Needs attention** with the red check *GSTIN belongs to this PAN*: the PAN inside the GSTIN (`{v['gst_pan']}`) is not the company's PAN (`{v['pan']}`). The GST legal name on the certificate also differs from the incorporation certificate by the words "(INDIA)".
3. It is **not auto-approved**, and **not auto-rejected** (near-identical names can be a sister company with a legitimate explanation): a person decides.

## Fails if
It is approved, or the near-identical name is called a perfect match without the PAN conflict being flagged.
""")
    return dict(id="T06", folder="T06-C-sister-company-gstin-email", dataset="C: Adversarial", channel="Email", title="Sister-company GSTIN with a near-identical name",
                expected="Waiting (confirm) → Needs attention (GSTIN belongs to another PAN)", vendor=v["form_name"])


# ------------------------------------------------------------------ T07
def build_t07():
    v = V["rann"]
    d = case_dir("T07-C-duplicate-bank-account-form")
    names = [
        save(d, "Rann_Certificate_of_Incorporation.pdf", g.incorporation_pdf(v)),
        save(d, "Rann_GST_Certificate.pdf", g.gst_pdf(v)),
        save(d, "Rann_PAN.png", g.pan_card_png(v)),
        save(d, "Rann_Cancelled_Cheque.png", g.cheque_png(v)),
    ]
    md(os.path.join(d, "HOW-TO-TEST.md"), f"""
# T07: Duplicate bank account (Dataset C, adversarial), by Google Form

**Channel:** Google Form. **Tests:** duplicate records, a payment-diversion pattern. Everything is consistent, but the bank account `{v['account']}` at `{v['ifsc']}` already belongs to **Sai Krupa Fabricators**, an approved vendor with a different PAN.

## How to test
{FORM_STEPS}

## Form values
{table(v)}

## Files
{files_list(names)}

## Expected result
**Rejected** automatically. The red check *Bank account not used by another vendor* names Sai Krupa Fabricators (its vendor reference and status) as the existing owner of the account. No email is sent to the vendor: rejections are handled by a person.

## Fails if
It is approved or only sent to Needs attention, or the check does not say which vendor owns the account.

> Needs the sample vendor **Sai Krupa Fabricators** to be on the website (it is in the standard history). If Overview does not list it, this case cannot trigger.
""")
    return dict(id="T07", folder="T07-C-duplicate-bank-account-form", dataset="C: Adversarial", channel="Google Form", title="Bank account already registered to another vendor",
                expected="Rejected (account belongs to Sai Krupa Fabricators)", vendor=v["form_name"])


# ------------------------------------------------------------------ T08
def build_t08():
    v = V["aravali"]
    d = case_dir("T08-C-edited-files-annotations-portal")
    pan = annotate(g.pan_card_png(v), (30, 146, 330, 200), [(360, 150, "checked OK - R.S. 4/11"), (360, 205, "orig. to be verified?")])
    names = [
        save(d, "Aravali_Certificate_of_Incorporation.pdf", g.incorporation_pdf(v)),
        save(d, "Aravali_GST_Certificate.pdf", mark_edited(g.gst_pdf(v), "Canva")),
        save(d, "Aravali_PAN_annotated.png", pan),
        save(d, "Aravali_Cancelled_Cheque.png", g.cheque_png(v)),
    ]
    md(os.path.join(d, "HOW-TO-TEST.md"), f"""
# T08: Edited files and handwritten annotations (Dataset C, adversarial), by portal

**Channel:** Supplier portal. **Tests:** modified document metadata, handwritten annotations.

| Document | Variation |
|---|---|
| GST certificate | the PDF's producer says **Canva** (a design tool, not how the GST portal issues certificates) |
| Cancelled cheque | the image file says it was saved by **Adobe Photoshop 25.0** |
| PAN card | pen marks on top: a hand-drawn circle around the PAN, a tick and notes ("checked OK - R.S. 4/11", "orig. to be verified?") |
| Certificate of incorporation | clean |

All the *content* is correct and consistent with the form.

## How to test
{PORTAL_STEPS}

## Form values
{table(v)}

## Files
{files_list(names)}

## Expected result
**Needs attention** with two file-origin flags: *GST registration certificate: file origin (Canva)* and *Bank proof: file origin (Adobe Photoshop 25.0)*. They are warnings for a person to compare against the originals, never a rejection on their own.
The pen marks on the PAN card must **not** disturb the reading: the PAN number is still read as `{v['pan']}` and the PAN checks pass.

## Fails if
The edited files are approved without a flag, the vendor is auto-rejected for the metadata alone, or the handwriting is read as part of the PAN number or name.
""")
    return dict(id="T08", folder="T08-C-edited-files-annotations-portal", dataset="C: Adversarial", channel="Portal", title="Edited-file metadata and handwritten annotations",
                expected="Needs attention (two file-origin flags); annotations do not break the reading", vendor=v["form_name"])


# ------------------------------------------------------------------ T09
def build_t09():
    v = V["teesta"]
    d = case_dir("T09-C-transposed-digits-form")
    names = [
        save(d, "Teesta_Certificate_of_Incorporation.pdf", g.incorporation_pdf(v)),
        save(d, "Teesta_GST_Certificate.pdf", g.gst_pdf(v)),
        save(d, "Teesta_PAN.png", g.pan_card_png(v)),
        save(d, "Teesta_Cancelled_Cheque.png", g.cheque_png(v)),
    ]
    typed_pan = v["pan"][:5] + v["pan"][6] + v["pan"][5] + v["pan"][7:]
    g_ = v["gstin"]
    typed_gstin = g_[:9] + g_[10] + g_[9] + g_[11:]
    md(os.path.join(d, "HOW-TO-TEST.md"), f"""
# T09: Transposed identifier digits (Dataset C, adversarial), by Google Form

**Channel:** Google Form. **Tests:** transposed identifier digits, conflicting information. The documents are all correct. The vendor **types the PAN with two digits swapped**: `{typed_pan}` instead of `{v['pan']}`.

## How to test
{FORM_STEPS}
Type this wrong value (everything else as in the table):

| Field | Type this | Correct value (on the documents) |
|---|---|---|
| PAN | `{typed_pan}` | `{v['pan']}` |

## Form values
{table(v, over=dict(pan=typed_pan))}

## Files
{files_list(names)}

## Expected result
**Needs attention** with the conflict shown with evidence, all pointing at the PAN:
- *PAN matches PAN card*: form `{typed_pan}`, document `{v['pan']}`;
- *PAN matches incorporation certificate*: same difference;
- *GSTIN belongs to this PAN*: the PAN inside the GSTIN is `{v['pan']}`, not the typed one.

The documents agree with each other and the GSTIN, so a reviewer can see at a glance that the typing is the odd one out.

## Variation (optional, a second run needs a fresh vendor, so only try it after this one is deleted)
Type the **GSTIN** with two digits swapped (`{typed_gstin}` instead of `{v['gstin']}`). A transposed GSTIN fails its **check digit**, so the system answers differently: **Waiting for vendor** with the corrected value suggested (`{v['gstin']}`) and a link to fix it.

## Fails if
The mistyped PAN is accepted silently, or the vendor is rejected for a typing error.
""")
    return dict(id="T09", folder="T09-C-transposed-digits-form", dataset="C: Adversarial", channel="Google Form", title="Transposed digits in a typed identifier",
                expected="Needs attention (PAN conflict with evidence)", vendor=v["form_name"])


# ------------------------------------------------------------------ T10
def build_t10():
    v = V["mahanadi"]
    d = case_dir("T10-C-conflicting-names-email")
    names = [
        save(d, "Mahanadi_Certificate_of_Incorporation.pdf", g.incorporation_pdf(v)),
        save(d, "Mahanadi_GST_Certificate.pdf", g.gst_pdf(v)),
        save(d, "Mahanadi_PAN.png", g.pan_card_png(v)),
        save(d, "Mahanadi_Cancelled_Cheque.png", g.cheque_png(v)),
    ]
    md(os.path.join(d, "HOW-TO-TEST.md"), f"""
# T10: Conflicting company names across documents (Dataset C, adversarial), by email

**Channel:** Email. **Tests:** mismatched company names, conflicting information. The same business appears under three different names:

| Document | Name shown |
|---|---|
| Certificate of incorporation | MAHANADI PACKAGING INDUSTRIES PRIVATE LIMITED |
| PAN card | MAHANADI PACKAGING INDUSTRIES PRIVATE LIMITED |
| GST certificate | MAHANADI PACKAGING **AND LOGISTICS** PRIVATE LIMITED |
| Cancelled cheque, account holder | MAHANADI **PACKAGERS** PVT LTD |

## How to test
{EMAIL_STEPS}

## Email
{email_text(v, "Vendor registration - Mahanadi Packaging", "We supply corrugated packaging from Cuttack and would like to register as your supplier. Our four documents are attached.")}

## Files to attach
{files_list(names)}

## Expected result
1. **Waiting for vendor** (confirm the details).
2. After you confirm: **Needs attention** with name conflicts shown side by side: the GST legal name differs from the company's name, and the bank account holder is a different name. Each check quotes the text from the document it came from.
3. Not auto-approved. Not auto-rejected either: similar names can be a trading name, but a person must look.

## Fails if
Any of the three differing names is called a match, or the application is approved.
""")
    return dict(id="T10", folder="T10-C-conflicting-names-email", dataset="C: Adversarial", channel="Email", title="Company name differs across documents",
                expected="Waiting (confirm) → Needs attention (name conflicts)", vendor=v["form_name"])


def main():
    if os.path.isdir(OUT):
        for root, _dirs, names in os.walk(OUT):
            for n in names:
                os.remove(os.path.join(root, n))
    os.makedirs(OUT, exist_ok=True)
    summary = [f() for f in (build_t01, build_t02, build_t03, build_t04, build_t05, build_t06, build_t07, build_t08, build_t09, build_t10)]

    rows = "\n".join(
        f"| [{s['id']}](./{s['folder']}/HOW-TO-TEST.md) | {s['dataset']} | {s['channel']} | {s['title']} | {s['expected']} |" for s in summary)
    md(os.path.join(OUT, "README.md"), f"""
# Testing kit: ten cases for all three channels

Datasets: **A** happy path, **B** realistic variations (robustness), **C** adversarial and edge cases. Every name, ID and account number is fictional. Each folder has its documents and a `HOW-TO-TEST.md` with the exact steps, the values to type, the expected result and what counts as a failure.

| Case | Dataset | Channel | What it tests | Expected |
|---|---|---|---|---|
{rows}

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
""")
    print("built", len(summary), "cases in", OUT)
    for s in summary:
        print(" ", s["id"], s["channel"], "-", s["title"])


if __name__ == "__main__":
    main()
