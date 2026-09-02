from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import math


OUT = Path(__file__).with_name(
    "Figure 3.3 - Account registration and email verification activity.png"
)

W, H = 2100, 3300
BG = "white"
INK = "#111111"
LINE = "#26384a"
ACTION_FILL = "#eef4f9"
USER_FILL = "#fff7e6"
SERVICE_FILL = "#f4f1fa"
ERROR_FILL = "#f8eeee"


def font(size: int, bold: bool = False):
    base = Path("C:/Windows/Fonts")
    return ImageFont.truetype(str(base / ("timesbd.ttf" if bold else "times.ttf")), size)


BODY = font(48)
BODY_BOLD = font(48, True)
SMALL = font(40)
LABEL = font(38, True)

img = Image.new("RGB", (W, H), BG)
draw = ImageDraw.Draw(img)


def wrapped_lines(text, text_font, max_width):
    words = text.split()
    lines = []
    current = ""
    for word in words:
        candidate = word if not current else f"{current} {word}"
        width = draw.textbbox((0, 0), candidate, font=text_font)[2]
        if current and width > max_width:
            lines.append(current)
            current = word
        else:
            current = candidate
    if current:
        lines.append(current)
    return lines


def centered_text(x, y, text, text_font=BODY, max_width=850, gap=8):
    lines = wrapped_lines(text, text_font, max_width)
    heights = [draw.textbbox((0, 0), line, font=text_font)[3] for line in lines]
    total = sum(heights) + gap * (len(lines) - 1)
    cy = y - total / 2
    for line, height in zip(lines, heights):
        bbox = draw.textbbox((0, 0), line, font=text_font)
        draw.text((x - (bbox[2] - bbox[0]) / 2, cy), line, fill=INK, font=text_font)
        cy += height + gap


def arrow_head(start, end, size=22):
    angle = math.atan2(end[1] - start[1], end[0] - start[0])
    left = (
        end[0] - size * math.cos(angle) + size * 0.55 * math.sin(angle),
        end[1] - size * math.sin(angle) - size * 0.55 * math.cos(angle),
    )
    right = (
        end[0] - size * math.cos(angle) - size * 0.55 * math.sin(angle),
        end[1] - size * math.sin(angle) + size * 0.55 * math.cos(angle),
    )
    draw.polygon((end, left, right), fill=LINE)


def connector(points, arrow=True, width=5):
    draw.line(points, fill=LINE, width=width, joint="curve")
    if arrow and len(points) >= 2:
        arrow_head(points[-2], points[-1])


def action(x, y, text, fill=ACTION_FILL, width=1040, height=126):
    box = (x - width / 2, y - height / 2, x + width / 2, y + height / 2)
    draw.rounded_rectangle(box, radius=24, fill=fill, outline=LINE, width=5)
    centered_text(x, y, text, BODY, width - 70)
    return box


def decision(x, y, text, width=520, height=170):
    points = ((x, y - height / 2), (x + width / 2, y), (x, y + height / 2), (x - width / 2, y))
    draw.polygon(points, fill="white", outline=LINE)
    draw.line(points + (points[0],), fill=LINE, width=5)
    centered_text(x, y, text, SMALL, width - 120, gap=5)
    return points


def label(x, y, text):
    bbox = draw.textbbox((0, 0), text, font=LABEL)
    pad = 10
    draw.rectangle((x - pad, y - pad, x + bbox[2] + pad, y + bbox[3] + pad), fill=BG)
    draw.text((x, y), text, fill=INK, font=LABEL)


MAIN_X = 820
SIDE_X = 1670
LEFT_BUS = 120
RIGHT_BUS = 2040

# Activity nodes.
draw.ellipse((MAIN_X - 36, 48, MAIN_X + 36, 120), fill=INK)

nodes = {}
nodes["form"] = action(MAIN_X, 230, "[User] Enter username, email address, and password", USER_FILL)
nodes["front_validate"] = action(MAIN_X, 410, "[Frontend] Validate required fields and formats")
decision(MAIN_X, 620, "Input valid?")
nodes["send"] = action(MAIN_X, 820, "[Frontend] Send registration request to backend")
nodes["back_validate"] = action(MAIN_X, 1000, "[Backend] Validate data and check username and email uniqueness")
decision(MAIN_X, 1220, "Data valid and unique?")
nodes["hash"] = action(MAIN_X, 1420, "[Backend] Hash password securely")
nodes["create"] = action(MAIN_X, 1600, "[MySQL] Create unverified account")
nodes["token"] = action(MAIN_X, 1780, "[Backend] Generate time-limited verification token")
nodes["email"] = action(MAIN_X, 1960, "[Resend] Deliver verification email", SERVICE_FILL)
nodes["open"] = action(MAIN_X, 2140, "[User] Open verification link", USER_FILL)
nodes["token_validate"] = action(MAIN_X, 2320, "[Backend] Validate verification token")
decision(MAIN_X, 2530, "Token valid and unexpired?")
nodes["verify"] = action(MAIN_X, 2730, "[MySQL] Mark account as verified")
nodes["success"] = action(MAIN_X, 2910, "[Frontend] Display verification success")

# Side outcomes.
nodes["input_error"] = action(SIDE_X, 620, "[Frontend] Display validation errors", ERROR_FILL, 650, 126)
nodes["registration_error"] = action(SIDE_X, 1220, "[Frontend] Display registration error", ERROR_FILL, 650, 126)
nodes["link_error"] = action(SIDE_X, 2530, "[Frontend] Display invalid or expired link", ERROR_FILL, 650, 126)

# Main success path.
connector(((MAIN_X, 120), (MAIN_X, nodes["form"][1])))
connector(((MAIN_X, nodes["form"][3]), (MAIN_X, nodes["front_validate"][1])))
connector(((MAIN_X, nodes["front_validate"][3]), (MAIN_X, 535)))
connector(((MAIN_X, 705), (MAIN_X, nodes["send"][1])))
label(MAIN_X + 28, 718, "Yes")
connector(((MAIN_X, nodes["send"][3]), (MAIN_X, nodes["back_validate"][1])))
connector(((MAIN_X, nodes["back_validate"][3]), (MAIN_X, 1135)))
connector(((MAIN_X, 1305), (MAIN_X, nodes["hash"][1])))
label(MAIN_X + 28, 1313, "Yes")
connector(((MAIN_X, nodes["hash"][3]), (MAIN_X, nodes["create"][1])))
connector(((MAIN_X, nodes["create"][3]), (MAIN_X, nodes["token"][1])))
connector(((MAIN_X, nodes["token"][3]), (MAIN_X, nodes["email"][1])))
connector(((MAIN_X, nodes["email"][3]), (MAIN_X, nodes["open"][1])))
connector(((MAIN_X, nodes["open"][3]), (MAIN_X, nodes["token_validate"][1])))
connector(((MAIN_X, nodes["token_validate"][3]), (MAIN_X, 2445)))
connector(((MAIN_X, 2615), (MAIN_X, nodes["verify"][1])))
label(MAIN_X + 28, 2622, "Yes")
connector(((MAIN_X, nodes["verify"][3]), (MAIN_X, nodes["success"][1])))

# Successful final node.
connector(((MAIN_X, nodes["success"][3]), (MAIN_X, 3100)))
draw.ellipse((MAIN_X - 44, 3100, MAIN_X + 44, 3188), outline=INK, width=7)
draw.ellipse((MAIN_X - 31, 3113, MAIN_X + 31, 3175), fill=INK)

# Input-validation failure and return to the form.
connector(((MAIN_X + 260, 620), (nodes["input_error"][0], 620)))
label(MAIN_X + 300, 565, "No")
connector(((SIDE_X, nodes["input_error"][1]), (SIDE_X, 300), (nodes["form"][2], 300), (nodes["form"][2], 260)))

# Backend-validation failure joins the same retry path.
connector(((MAIN_X + 260, 1220), (nodes["registration_error"][0], 1220)))
label(MAIN_X + 300, 1165, "No")
connector(((nodes["registration_error"][2], 1220), (RIGHT_BUS, 1220), (RIGHT_BUS, 300), (SIDE_X, 300)), arrow=False)

# Invalid or expired token ends the unsuccessful branch.
connector(((MAIN_X + 260, 2530), (nodes["link_error"][0], 2530)))
label(MAIN_X + 300, 2475, "No")
connector(((SIDE_X, nodes["link_error"][3]), (SIDE_X, 2910)))
draw.ellipse((SIDE_X - 44, 2910, SIDE_X + 44, 2998), outline=INK, width=7)
draw.ellipse((SIDE_X - 31, 2923, SIDE_X + 31, 2985), fill=INK)

img.save(OUT, dpi=(300, 300))
print(OUT)
