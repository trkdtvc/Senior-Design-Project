from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import math


OUT = Path(__file__).with_name("Figure 3.6 - Account registration and email verification sequence.png")
W, H = 3000, 2760
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


def dashed_line(points, fill=LINE, width=4, dash=18, gap=12):
    for start, end in zip(points, points[1:]):
        x1, y1 = start
        x2, y2 = end
        length = math.hypot(x2 - x1, y2 - y1)
        if not length:
            continue
        ux, uy = (x2 - x1) / length, (y2 - y1) / length
        pos = 0
        while pos < length:
            seg_end = min(pos + dash, length)
            draw.line((x1 + ux * pos, y1 + uy * pos, x1 + ux * seg_end, y1 + uy * seg_end), fill=fill, width=width)
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
    title_box = draw.textbbox((0, 0), title, font=BODY_BOLD)
    draw.text((x - (title_box[2] - title_box[0]) / 2, 78), title, fill=INK, font=BODY_BOLD)
    sub_box = draw.textbbox((0, 0), subtitle, font=SMALL)
    draw.text((x - (sub_box[2] - sub_box[0]) / 2, 137), subtitle, fill=INK, font=SMALL)
    dashed_line(((x, 190), (x, H - 80)), width=4)


def message(x1, x2, y, text, response=False):
    if response:
        dashed_line(((x1, y), (x2, y)), width=4)
        arrow_head((x1, y), (x2, y), open_head=True)
    else:
        draw.line((x1, y, x2, y), fill=LINE, width=5)
        arrow_head((x1, y), (x2, y))
    centered_label((x1 + x2) / 2, y - 34, text)


def self_message(x, y, text, side=1):
    reach = 170 * side
    points = ((x, y), (x + reach, y), (x + reach, y + 70), (x, y + 70))
    draw.line(points, fill=LINE, width=5)
    arrow_head(points[-2], points[-1])
    centered_label(x + reach / 2, y - 34, text, max_width=430)


def alt_frame(y1, y2, divider_y, upper_label, lower_label):
    x1, x2 = 70, W - 70
    draw.rectangle((x1, y1, x2, y2), fill=FRAME_FILL, outline=LINE, width=4)
    draw.line((x1, divider_y, x2, divider_y), fill=LINE, width=3)
    tab_w = 165
    draw.polygon(((x1, y1), (x1 + tab_w, y1), (x1 + tab_w - 30, y1 + 62), (x1, y1 + 62)), fill=APP_FILL, outline=LINE)
    draw.text((x1 + 18, y1 + 8), "alt", fill=INK, font=SMALL_BOLD)


def frame_condition_label(x, y, text):
    bbox = draw.textbbox((0, 0), text, font=SMALL_BOLD)
    draw.rectangle((x - 8, y - 5, x + bbox[2] + 8, y + bbox[3] + 5), fill=FRAME_FILL)
    draw.text((x, y), text, fill=INK, font=SMALL_BOLD)


VISITOR, FRONTEND, BACKEND, MYSQL, RESEND = 270, 865, 1460, 2055, 2650

# Frames are drawn first so their borders remain behind messages and labels.
alt_frame(850, 1605, 1080, "registration data invalid or unavailable", "registration data valid and unique")
alt_frame(2100, 2660, 2310, "verification token invalid or expired", "verification token valid")

# Participants and lifelines.
participant(VISITOR, "Visitor", "User", ACTOR_FILL)
participant(FRONTEND, "React/Vite", "Frontend", APP_FILL)
participant(BACKEND, "Node/Express", "Backend", APP_FILL)
participant(MYSQL, "MySQL", "Database", DATA_FILL)
participant(RESEND, "Resend", "Email service", SERVICE_FILL)

# Registration request.
message(VISITOR, FRONTEND, 310, "Submit username, email, and password")
self_message(FRONTEND, 410, "Validate registration form")
message(FRONTEND, BACKEND, 550, "POST /auth/register")
message(BACKEND, MYSQL, 680, "Check username and email uniqueness")
message(MYSQL, BACKEND, 810, "Availability result", response=True)

# Registration alternatives.
message(BACKEND, FRONTEND, 970, "Validation error", response=True)
message(FRONTEND, VISITOR, 1050, "Display registration error", response=True)
self_message(BACKEND, 1180, "Hash password and generate token")
message(BACKEND, MYSQL, 1320, "Insert unverified account")
message(BACKEND, RESEND, 1450, "Send verification email")
message(BACKEND, FRONTEND, 1570, "Registration accepted", response=True)
message(FRONTEND, VISITOR, 1705, "Prompt user to check email", response=True)

# Email verification request.
message(VISITOR, BACKEND, 1835, "Open verification link")
message(BACKEND, MYSQL, 1965, "Validate token and expiry")
message(MYSQL, BACKEND, 2075, "Token and account result", response=True)

# Verification alternatives.
message(BACKEND, VISITOR, 2250, "Display verification error", response=True)
message(BACKEND, MYSQL, 2420, "Mark account as verified")
message(MYSQL, BACKEND, 2520, "Update confirmed", response=True)
message(BACKEND, VISITOR, 2625, "Display verification success", response=True)

# Redraw frame conditions last so lifelines never pass through their text.
frame_condition_label(250, 858, "[registration data invalid or unavailable]")
frame_condition_label(95, 1090, "[else: registration data valid and unique]")
frame_condition_label(250, 2108, "[verification token invalid or expired]")
frame_condition_label(95, 2320, "[else: verification token valid]")

img.save(OUT, dpi=(300, 300))
print(OUT)
