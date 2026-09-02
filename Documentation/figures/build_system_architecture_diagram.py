from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import math


OUT = Path(__file__).with_name("Figure 3.1 - YFNC system architecture.png")
W, H = 2200, 1500
BG = "white"
INK = "#111111"
LINE = "#25364a"
FILL_MAIN = "#e9f1f8"
FILL_SERVICE = "#f4f6f8"
FILL_USER = "#fff7e6"


def font(size: int, bold: bool = False):
    windows = Path("C:/Windows/Fonts")
    name = "timesbd.ttf" if bold else "times.ttf"
    return ImageFont.truetype(str(windows / name), size=size)


TITLE = font(46, True)
BODY = font(36)
LABEL = font(30)


def centered_text(draw, box, lines, title=True):
    x1, y1, x2, y2 = box
    fonts = [TITLE if title and i == 0 else BODY for i in range(len(lines))]
    gaps = 16
    heights = [draw.textbbox((0, 0), line, font=f)[3] for line, f in zip(lines, fonts)]
    total = sum(heights) + gaps * (len(lines) - 1)
    y = y1 + (y2 - y1 - total) / 2
    for line, f, h in zip(lines, fonts, heights):
        bbox = draw.textbbox((0, 0), line, font=f)
        tw = bbox[2] - bbox[0]
        draw.text(((x1 + x2 - tw) / 2, y), line, fill=INK, font=f)
        y += h + gaps


def box(draw, coords, lines, fill):
    draw.rounded_rectangle(coords, radius=22, fill=fill, outline=LINE, width=5)
    centered_text(draw, coords, lines)


def arrowhead(draw, tip, angle, color=LINE, size=24):
    spread = math.radians(28)
    points = [tip]
    for a in (angle + math.pi - spread, angle + math.pi + spread):
        points.append((tip[0] + size * math.cos(a), tip[1] + size * math.sin(a)))
    draw.polygon(points, fill=color)


def arrow(draw, start, end, label, both=False, label_offset=(0, -40)):
    draw.line([start, end], fill=LINE, width=5)
    ang = math.atan2(end[1] - start[1], end[0] - start[0])
    arrowhead(draw, end, ang)
    if both:
        arrowhead(draw, start, ang + math.pi)
    mx = (start[0] + end[0]) / 2 + label_offset[0]
    my = (start[1] + end[1]) / 2 + label_offset[1]
    bb = draw.textbbox((0, 0), label, font=LABEL)
    pad = 10
    draw.rectangle((mx - (bb[2]-bb[0])/2 - pad, my - pad,
                    mx + (bb[2]-bb[0])/2 + pad, my + (bb[3]-bb[1]) + pad), fill=BG)
    draw.text((mx - (bb[2]-bb[0])/2, my), label, fill=INK, font=LABEL)


img = Image.new("RGB", (W, H), BG)
draw = ImageDraw.Draw(img)

user = (760, 70, 1440, 250)
frontend = (650, 370, 1550, 610)
backend = (650, 760, 1550, 1030)
mysql = (70, 1210, 520, 1430)
storage = (590, 1210, 1040, 1430)
resend = (1110, 1210, 1560, 1430)
gemini = (1630, 1210, 2080, 1430)

box(draw, user, ["User's Web Browser", "Application interaction"], FILL_USER)
box(draw, frontend, ["React and Vite Frontend", "Presentation layer - Vercel"], FILL_MAIN)
box(draw, backend, ["Node.js and Express Backend", "Application, security, and coordination layer - Railway"], FILL_MAIN)
box(draw, mysql, ["MySQL", "Persistent relational data", "Railway"], FILL_SERVICE)
box(draw, storage, ["Attachment Storage", "Protected persistent files", "Railway"], FILL_SERVICE)
box(draw, resend, ["Resend", "Verification and recovery", "email"], FILL_SERVICE)
box(draw, gemini, ["Gemini", "Authorized conversation", "context and responses"], FILL_SERVICE)

arrow(draw, (1100, 250), (1100, 370), "Interface", both=True, label_offset=(150, -10))
arrow(draw, (960, 610), (960, 760), "HTTPS API", both=True, label_offset=(-155, 10))
arrow(draw, (1240, 610), (1240, 760), "Socket.IO", both=True, label_offset=(155, 10))

arrow(draw, (820, 1030), (295, 1210), "Queries and records", both=True, label_offset=(-10, -45))
arrow(draw, (1000, 1030), (815, 1210), "Protected files", both=True, label_offset=(-10, -45))
arrow(draw, (1200, 1030), (1335, 1210), "Email requests", both=False, label_offset=(-5, -45))
arrow(draw, (1380, 1030), (1855, 1210), "Context and response", both=True, label_offset=(20, -45))

img.save(OUT, dpi=(300, 300))
print(OUT)
