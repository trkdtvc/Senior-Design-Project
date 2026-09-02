from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import math


OUT = Path(__file__).with_name("Figure 3.11 - YFNC production deployment model.png")
W, H = 3200, 2300
BG = "white"
INK = "#111111"
LINE = "#26384a"
USER_FILL = "#fff7e6"
FRONTEND_FILL = "#eef4f9"
BACKEND_FILL = "#eaf1f7"
DATA_FILL = "#f2f5f7"
SERVICE_FILL = "#f4f1fa"
BOUNDARY_FILL = "#fbfcfd"


def font(size: int, bold: bool = False):
    base = Path("C:/Windows/Fonts")
    return ImageFont.truetype(str(base / ("timesbd.ttf" if bold else "times.ttf")), size)


TITLE = font(64, True)
BODY = font(48)
BODY_BOLD = font(48, True)
SMALL = font(40)
LABEL = font(42, True)
BOUNDARY = font(54, True)

img = Image.new("RGB", (W, H), BG)
draw = ImageDraw.Draw(img)


def wrapped_lines(text, text_font, max_width):
    words = text.split()
    lines, current = [], ""
    for word in words:
        candidate = word if not current else f"{current} {word}"
        if current and draw.textbbox((0, 0), candidate, font=text_font)[2] > max_width:
            lines.append(current)
            current = word
        else:
            current = candidate
    if current:
        lines.append(current)
    return lines


def centered_text(cx, cy, text, text_font, max_width, gap=6):
    lines = wrapped_lines(text, text_font, max_width)
    line_h = draw.textbbox((0, 0), "Ag", font=text_font)[3]
    total_h = len(lines) * line_h + max(0, len(lines) - 1) * gap
    y = cy - total_h / 2
    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=text_font)
        draw.text((cx - (bbox[2] - bbox[0]) / 2, y), line, fill=INK, font=text_font)
        y += line_h + gap


def node(cx, cy, title, lines, fill, width, height):
    x1, y1, x2, y2 = cx - width / 2, cy - height / 2, cx + width / 2, cy + height / 2
    draw.rounded_rectangle((x1, y1, x2, y2), radius=24, fill=fill, outline=LINE, width=5)
    draw.line((x1, y1 + 90, x2, y1 + 90), fill=LINE, width=4)
    centered_text(cx, y1 + 45, title, TITLE, width - 40)
    body_y = y1 + 112
    for line in lines:
        centered_text(cx, body_y + 22, line, BODY, width - 55)
        body_y += 58
    return (x1, y1, x2, y2)


def arrow_head(start, end, size=22):
    angle = math.atan2(end[1] - start[1], end[0] - start[0])
    left = (
        end[0] - size * math.cos(angle) + size * 0.56 * math.sin(angle),
        end[1] - size * math.sin(angle) - size * 0.56 * math.cos(angle),
    )
    right = (
        end[0] - size * math.cos(angle) - size * 0.56 * math.sin(angle),
        end[1] - size * math.sin(angle) + size * 0.56 * math.cos(angle),
    )
    draw.polygon((end, left, right), fill=LINE)


def connector(points, label_text=None, label_pos=None, bidirectional=False):
    draw.line(points, fill=LINE, width=5, joint="curve")
    arrow_head(points[-2], points[-1])
    if bidirectional:
        arrow_head(points[1], points[0])
    if label_text and label_pos:
        lines = wrapped_lines(label_text, LABEL, 620)
        line_h = draw.textbbox((0, 0), "Ag", font=LABEL)[3]
        max_w = max(draw.textbbox((0, 0), line, font=LABEL)[2] for line in lines)
        total_h = len(lines) * line_h + (len(lines) - 1) * 4
        x, y = label_pos
        draw.rectangle((x - max_w / 2 - 12, y - total_h / 2 - 8, x + max_w / 2 + 12, y + total_h / 2 + 8), fill=BG)
        cy = y - total_h / 2
        for line in lines:
            bbox = draw.textbbox((0, 0), line, font=LABEL)
            draw.text((x - (bbox[2] - bbox[0]) / 2, cy), line, fill=INK, font=LABEL)
            cy += line_h + 4


# Platform boundaries.
draw.rounded_rectangle((110, 520, 1180, 1580), radius=24, fill=BOUNDARY_FILL, outline=LINE, width=5)
draw.rounded_rectangle((1320, 520, 3090, 1750), radius=24, fill=BOUNDARY_FILL, outline=LINE, width=5)
draw.rectangle((150, 540, 650, 610), fill=BOUNDARY_FILL)
draw.rectangle((1360, 540, 1890, 610), fill=BOUNDARY_FILL)
draw.text((175, 542), "Vercel platform", fill=INK, font=BOUNDARY)
draw.text((1385, 542), "Railway platform", fill=INK, font=BOUNDARY)

# Nodes.
browser = node(1600, 220, "User's web browser", [
    "Downloads the SPA",
    "Sends REST requests",
    "Maintains Socket.IO connection",
], USER_FILL, 940, 360)

frontend = node(645, 900, "React/Vite frontend", [
    "Production static build",
    "Client-side routing",
    "Vercel SPA rewrite",
], FRONTEND_FILL, 820, 390)

backend = node(2200, 850, "Node/Express backend", [
    "REST API and Socket.IO",
    "Authentication and authorization",
    "Single running instance",
    "Liveness and readiness endpoints",
], BACKEND_FILL, 1040, 460)

database = node(1700, 1420, "MySQL service", [
    "Relational application data",
    "Forward migrations and backups",
], DATA_FILL, 680, 310)

volume = node(2700, 1420, "Persistent volume", [
    "UPLOAD_DIR",
    "Message attachments",
], DATA_FILL, 680, 310)

resend = node(930, 2050, "Resend", [
    "Verification and recovery email",
], SERVICE_FILL, 760, 270)

gemini = node(2280, 2050, "Gemini", [
    "Authorized conversation-context responses",
], SERVICE_FILL, 900, 270)

# Runtime communication.
connector(((browser[0], 250), (645, 250), (645, frontend[1])), "HTTPS static assets", (850, 220))
connector(((browser[2], 250), (2200, 250), (2200, backend[1])), "HTTPS REST API and WSS Socket.IO", (2510, 205), bidirectional=True)
connector(((1950, backend[3]), (1700, database[1])), "Private MySQL connection", (1700, 1160), bidirectional=True)
connector(((2480, backend[3]), (2700, volume[1])), "Persistent file read/write", (2750, 1160), bidirectional=True)
connector(((backend[0], 850), (1260, 850), (1260, 1840), (930, resend[1])), "HTTPS email API", (1180, 1775))
connector(((backend[2], 850), (3110, 850), (3110, 1840), (2280, gemini[1])), "HTTPS AI API", (2730, 1785), bidirectional=True)

# Configuration notes inside each platform boundary.
draw.rounded_rectangle((255, 1325, 1035, 1495), radius=18, fill=FRONTEND_FILL, outline=LINE, width=4)
centered_text(645, 1410, "Environment configuration: VITE_API_URL", SMALL, 720)

draw.rounded_rectangle((1510, 1600, 2900, 1695), radius=18, fill=BACKEND_FILL, outline=LINE, width=4)
centered_text(2205, 1648, "Protected environment variables: DB credentials, JWT secret, provider keys, UPLOAD_DIR", SMALL, 1320)

img.save(OUT, dpi=(300, 300))
print(OUT)
