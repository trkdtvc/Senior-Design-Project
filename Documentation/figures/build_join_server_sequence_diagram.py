from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import math


OUT = Path(__file__).with_name("Figure 3.7 - Joining a server through an invitation sequence.png")
W, H = 3000, 3650
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


BODY = font(52)
BODY_BOLD = font(52, True)
SMALL = font(44)
SMALL_BOLD = font(44, True)

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
        pos = 0
        while pos < length:
            segment_end = min(pos + dash, length)
            draw.line((x1 + ux * pos, y1 + uy * pos, x1 + ux * segment_end, y1 + uy * segment_end), fill=LINE, width=width)
            pos += dash + gap


def arrow_head(start, end, size=20, open_head=False):
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


def centered_label(x, y, text, text_font=SMALL, max_width=520):
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
    box = (x - 230, 60, x + 230, 190)
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
    centered_label((x1 + x2) / 2, y - 34, text)


def self_message(x, y, text):
    points = ((x, y), (x + 175, y), (x + 175, y + 70), (x, y + 70))
    draw.line(points, fill=LINE, width=5)
    arrow_head(points[-2], points[-1])
    centered_label(x + 88, y - 34, text, max_width=430)


def alt_frame(y1, y2, divider_y):
    x1, x2 = 70, W - 70
    draw.rectangle((x1, y1, x2, y2), fill=FRAME_FILL, outline=LINE, width=4)
    draw.line((x1, divider_y, x2, divider_y), fill=LINE, width=3)
    draw.polygon(((x1, y1), (x1 + 165, y1), (x1 + 135, y1 + 62), (x1, y1 + 62)), fill=APP_FILL, outline=LINE)
    draw.text((x1 + 18, y1 + 8), "alt", fill=INK, font=SMALL_BOLD)


def frame_label(x, y, text):
    bbox = draw.textbbox((0, 0), text, font=SMALL_BOLD)
    draw.rectangle((x - 8, y - 5, x + bbox[2] + 8, y + bbox[3] + 5), fill=FRAME_FILL)
    draw.text((x, y), text, fill=INK, font=SMALL_BOLD)


USER, FRONTEND, BACKEND, MYSQL = 300, 1000, 1700, 2400

# Alternative fragments are placed beneath the interaction paths.
alt_frame(510, 850, 675)
alt_frame(1030, 1450, 1230)
alt_frame(1630, 2190, 1920)
alt_frame(2440, 2910, 2700)

# Participants and lifelines.
participant(USER, "User", "Registered user", ACTOR_FILL)
participant(FRONTEND, "React/Vite", "Frontend", APP_FILL)
participant(BACKEND, "Node/Express", "Backend", APP_FILL)
participant(MYSQL, "MySQL", "Database", DATA_FILL)

# User supplies and the frontend validates the invitation code.
message(USER, FRONTEND, 310, "Enter invitation code")
self_message(FRONTEND, 410, "Validate code input")
message(FRONTEND, USER, 640, "Display code-required error", response=True)
message(FRONTEND, BACKEND, 780, "POST join request with code and access token")

# The protected backend route authenticates the request.
self_message(BACKEND, 900, "Authenticate request")
message(BACKEND, FRONTEND, 1140, "Authentication required", response=True)
message(FRONTEND, USER, 1210, "Redirect to sign in", response=True)

# The backend retrieves and validates the invitation.
message(BACKEND, MYSQL, 1380, "Retrieve invitation and server")
message(MYSQL, BACKEND, 1530, "Invitation result", response=True)
message(BACKEND, FRONTEND, 1750, "Invalid, inactive, or expired invitation", response=True)
message(FRONTEND, USER, 1850, "Display invitation error", response=True)

# A valid invitation is checked against bans and existing membership.
message(BACKEND, MYSQL, 2290, "Check ban and membership status")
message(MYSQL, BACKEND, 2390, "Authorization and membership result", response=True)
message(BACKEND, FRONTEND, 2560, "Banned or already a member", response=True)
message(FRONTEND, USER, 2660, "Display join error", response=True)

# A permitted join creates a membership and returns the joined server.
message(BACKEND, MYSQL, 3020, "Create membership with member role")
message(MYSQL, BACKEND, 3140, "Membership saved", response=True)
message(BACKEND, FRONTEND, 3260, "Joined server information", response=True)
self_message(FRONTEND, 3360, "Reload server list")
message(FRONTEND, USER, 3540, "Open joined server", response=True)

# Redraw alternative conditions so lifelines never obscure them.
frame_label(250, 518, "[invitation code missing]")
frame_label(95, 685, "[else: code provided]")
frame_label(250, 1038, "[authentication invalid]")
frame_label(95, 1240, "[else: user authenticated]")
frame_label(250, 1638, "[invitation invalid, inactive, or expired]")
frame_label(95, 1930, "[else: invitation valid]")
frame_label(250, 2448, "[user banned or already a member]")
frame_label(95, 2710, "[else: join permitted]")

img.save(OUT, dpi=(300, 300))
print(OUT)
