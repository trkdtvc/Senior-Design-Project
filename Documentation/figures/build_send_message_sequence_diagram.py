from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import math


OUT = Path(__file__).with_name("Figure 3.8 - Sending a message to an authorized conversation sequence.png")
W, H = 3200, 3160
BG = "white"
INK = "#111111"
LINE = "#26384a"
ACTOR_FILL = "#fff7e6"
APP_FILL = "#eef4f9"
DATA_FILL = "#f2f5f7"
SERVICE_FILL = "#f4f1fa"
FRAME_FILL = "#fbfcfd"


def font(size: int, bold: bool = False):
    base = Path("C:/Windows/Fonts")
    return ImageFont.truetype(str(base / ("timesbd.ttf" if bold else "times.ttf")), size)


BODY = font(48)
BODY_BOLD = font(48, True)
SMALL = font(40)
SMALL_BOLD = font(40, True)

img = Image.new("RGB", (W, H), BG)
draw = ImageDraw.Draw(img)


def dashed_line(points, width=4, dash=18, gap=12):
    for start, end in zip(points, points[1:]):
        x1, y1 = start
        x2, y2 = end
        length = math.hypot(x2 - x1, y2 - y1)
        if not length:
            continue
        ux, uy = (x2 - x1) / length, (y2 - y1) / length
        position = 0
        while position < length:
            segment_end = min(position + dash, length)
            draw.line((x1 + ux * position, y1 + uy * position, x1 + ux * segment_end, y1 + uy * segment_end), fill=LINE, width=width)
            position += dash + gap


def arrow_head(start, end, size=19, open_head=False):
    angle = math.atan2(end[1] - start[1], end[0] - start[0])
    left = (
        end[0] - size * math.cos(angle) + size * 0.58 * math.sin(angle),
        end[1] - size * math.sin(angle) - size * 0.58 * math.cos(angle),
    )
    right = (
        end[0] - size * math.cos(angle) - size * 0.58 * math.sin(angle),
        end[1] - size * math.sin(angle) + size * 0.58 * math.cos(angle),
    )
    if open_head:
        draw.line((left, end, right), fill=LINE, width=4)
    else:
        draw.polygon((end, left, right), fill=LINE)


def centered_label(x, y, text, text_font=SMALL, max_width=470):
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
    line_h = draw.textbbox((0, 0), "Ag", font=text_font)[3]
    total_h = len(lines) * line_h + max(0, len(lines) - 1) * 4
    cy = y - total_h / 2
    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=text_font)
        draw.rectangle((x - (bbox[2] - bbox[0]) / 2 - 7, cy - 3, x + (bbox[2] - bbox[0]) / 2 + 7, cy + line_h + 3), fill=BG)
        draw.text((x - (bbox[2] - bbox[0]) / 2, cy), line, fill=INK, font=text_font)
        cy += line_h + 4


def participant(x, title, subtitle, fill):
    box = (x - 205, 60, x + 205, 190)
    draw.rounded_rectangle(box, radius=20, fill=fill, outline=LINE, width=5)
    bbox = draw.textbbox((0, 0), title, font=BODY_BOLD)
    draw.text((x - (bbox[2] - bbox[0]) / 2, 78), title, fill=INK, font=BODY_BOLD)
    bbox = draw.textbbox((0, 0), subtitle, font=SMALL)
    draw.text((x - (bbox[2] - bbox[0]) / 2, 137), subtitle, fill=INK, font=SMALL)
    dashed_line(((x, 190), (x, H - 80)))


def message(x1, x2, y, text, response=False):
    if response:
        dashed_line(((x1, y), (x2, y)))
        arrow_head((x1, y), (x2, y), open_head=True)
    else:
        draw.line((x1, y, x2, y), fill=LINE, width=5)
        arrow_head((x1, y), (x2, y))
    centered_label((x1 + x2) / 2, y - 32, text)


def self_message(x, y, text):
    points = ((x, y), (x + 165, y), (x + 165, y + 68), (x, y + 68))
    draw.line(points, fill=LINE, width=5)
    arrow_head(points[-2], points[-1])
    centered_label(x + 83, y - 32, text, max_width=410)


def alt_frame(y1, y2, divider_y):
    x1, x2 = 65, W - 65
    draw.rectangle((x1, y1, x2, y2), fill=FRAME_FILL, outline=LINE, width=4)
    draw.line((x1, divider_y, x2, divider_y), fill=LINE, width=3)
    draw.polygon(((x1, y1), (x1 + 155, y1), (x1 + 127, y1 + 58), (x1, y1 + 58)), fill=APP_FILL, outline=LINE)
    draw.text((x1 + 17, y1 + 7), "alt", fill=INK, font=SMALL_BOLD)


def frame_label(x, y, text):
    bbox = draw.textbbox((0, 0), text, font=SMALL_BOLD)
    draw.rectangle((x - 8, y - 5, x + bbox[2] + 8, y + bbox[3] + 5), fill=FRAME_FILL)
    draw.text((x, y), text, fill=INK, font=SMALL_BOLD)


USER, FRONTEND, BACKEND, MYSQL, STORAGE, SOCKET = 230, 780, 1330, 1880, 2430, 2980

# Alternative fragments.
alt_frame(500, 880, 675)
alt_frame(1280, 1690, 1480)
alt_frame(1740, 2800, 1970)

# Participants and lifelines.
participant(USER, "User", "Message author", ACTOR_FILL)
participant(FRONTEND, "React/Vite", "Frontend", APP_FILL)
participant(BACKEND, "Node/Express", "Backend", APP_FILL)
participant(MYSQL, "MySQL", "Database", DATA_FILL)
participant(STORAGE, "Attachment", "Persistent storage", SERVICE_FILL)
participant(SOCKET, "Socket.IO", "Real-time layer", SERVICE_FILL)

# Client-side submission.
message(USER, FRONTEND, 300, "Submit message and optional attachment")
self_message(FRONTEND, 405, "Validate input")
message(FRONTEND, USER, 610, "Display input validation error", response=True)
message(FRONTEND, BACKEND, 790, "POST message with access token and conversation ID")

# Backend authentication and authorization.
self_message(BACKEND, 940, "Authenticate request")
message(BACKEND, MYSQL, 1080, "Retrieve membership, permissions, and block state")
message(MYSQL, BACKEND, 1210, "Authorization context", response=True)
message(BACKEND, FRONTEND, 1400, "Conversation access error", response=True)
message(FRONTEND, USER, 1465, "Display access error", response=True)
self_message(BACKEND, 1590, "Validate content and attachment metadata")

# Server-side validation and successful persistence.
message(BACKEND, FRONTEND, 1870, "Message validation error", response=True)
message(FRONTEND, USER, 1940, "Display validation error", response=True)
message(BACKEND, STORAGE, 2110, "Store permitted attachment if present")
message(STORAGE, BACKEND, 2240, "Storage reference", response=True)
message(BACKEND, MYSQL, 2370, "Insert message and attachment record")
message(MYSQL, BACKEND, 2500, "Message persisted", response=True)
message(BACKEND, SOCKET, 2630, "Publish message event")
message(SOCKET, FRONTEND, 2760, "Deliver real-time message event")
message(BACKEND, FRONTEND, 2890, "201 Created with message state", response=True)
message(FRONTEND, USER, 3030, "Render sent message", response=True)

# Redraw fragment conditions over the lifelines.
frame_label(235, 508, "[frontend input invalid]")
frame_label(90, 685, "[else: frontend input valid]")
frame_label(235, 1288, "[user not authorized]")
frame_label(90, 1490, "[else: user authorized]")
frame_label(235, 1748, "[message data invalid]")
frame_label(90, 1980, "[else: message data valid]")

img.save(OUT, dpi=(300, 300))
print(OUT)
