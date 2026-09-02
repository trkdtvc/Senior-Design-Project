from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import math


OUT = Path(__file__).with_name("Figure 3.4 - Joining a server through an invitation activity.png")
W, H = 2100, 2900
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
SMALL = font(40)
LABEL = font(38, True)

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
    if arrow:
        arrow_head(points[-2], points[-1])


def action(x, y, text, fill=ACTION_FILL, width=1040, height=126):
    box = (x - width / 2, y - height / 2, x + width / 2, y + height / 2)
    draw.rounded_rectangle(box, radius=24, fill=fill, outline=LINE, width=5)
    centered_text(x, y, text, BODY, width - 70)
    return box


def decision(x, y, text, width=520, height=170):
    points = ((x, y - height / 2), (x + width / 2, y), (x, y + height / 2), (x - width / 2, y))
    draw.polygon(points, fill=BG, outline=LINE)
    draw.line(points + (points[0],), fill=LINE, width=5)
    centered_text(x, y, text, SMALL, width - 120, gap=5)


def label(x, y, text):
    bbox = draw.textbbox((0, 0), text, font=LABEL)
    draw.rectangle((x - 9, y - 7, x + bbox[2] + 9, y + bbox[3] + 7), fill=BG)
    draw.text((x, y), text, fill=INK, font=LABEL)


def final_node(x, y):
    draw.ellipse((x - 44, y, x + 44, y + 88), outline=INK, width=7)
    draw.ellipse((x - 31, y + 13, x + 31, y + 75), fill=INK)


MAIN_X = 800
SIDE_X = 1650
RIGHT_BUS = 2040

# Initial node and implemented join-by-code workflow.
draw.ellipse((MAIN_X - 36, 45, MAIN_X + 36, 117), fill=INK)

nodes = {}
nodes["enter_code"] = action(MAIN_X, 220, "[User] Enter invitation code", USER_FILL)
nodes["validate_code"] = action(MAIN_X, 390, "[Frontend] Validate invitation code input")
decision(MAIN_X, 570, "Code provided?")
nodes["request"] = action(MAIN_X, 760, "[Frontend] Send authenticated join request")
nodes["authenticate"] = action(MAIN_X, 930, "[Backend] Authenticate the requesting user")
decision(MAIN_X, 1110, "Authentication valid?")
nodes["retrieve"] = action(MAIN_X, 1290, "[MySQL] Retrieve invitation and associated server")
decision(MAIN_X, 1470, "Invitation valid, active, and unexpired?")
nodes["membership_check"] = action(MAIN_X, 1650, "[Backend] Check ban and existing membership status")
decision(MAIN_X, 1830, "Join permitted?")
nodes["create"] = action(MAIN_X, 2010, "[MySQL] Create membership with the member role")
nodes["confirm"] = action(MAIN_X, 2190, "[Backend] Return the joined server information")
nodes["reload"] = action(MAIN_X, 2370, "[Frontend] Reload the user's server list")
nodes["open_server"] = action(MAIN_X, 2550, "[Frontend] Open the joined server")

# Alternative outcomes.
nodes["code_error"] = action(SIDE_X, 570, "[Frontend] Display invitation-code validation error", ERROR_FILL, 700)
nodes["signin"] = action(SIDE_X, 1110, "[Frontend] Redirect user to sign in", ERROR_FILL, 700)
nodes["invite_error"] = action(SIDE_X, 1470, "[Frontend] Display invalid or expired invitation error", ERROR_FILL, 700)
nodes["join_error"] = action(SIDE_X, 1830, "[Frontend] Display ban or existing-membership error", ERROR_FILL, 700)

# Main path connectors.
connector(((MAIN_X, 117), (MAIN_X, nodes["enter_code"][1])))
connector(((MAIN_X, nodes["enter_code"][3]), (MAIN_X, nodes["validate_code"][1])))
connector(((MAIN_X, nodes["validate_code"][3]), (MAIN_X, 485)))
connector(((MAIN_X, 655), (MAIN_X, nodes["request"][1])))
label(MAIN_X + 28, 662, "Yes")
connector(((MAIN_X, nodes["request"][3]), (MAIN_X, nodes["authenticate"][1])))
connector(((MAIN_X, nodes["authenticate"][3]), (MAIN_X, 1025)))
connector(((MAIN_X, 1195), (MAIN_X, nodes["retrieve"][1])))
label(MAIN_X + 28, 1202, "Yes")
connector(((MAIN_X, nodes["retrieve"][3]), (MAIN_X, 1385)))
connector(((MAIN_X, 1555), (MAIN_X, nodes["membership_check"][1])))
label(MAIN_X + 28, 1562, "Yes")
connector(((MAIN_X, nodes["membership_check"][3]), (MAIN_X, 1745)))
connector(((MAIN_X, 1915), (MAIN_X, nodes["create"][1])))
label(MAIN_X + 28, 1922, "Yes")
connector(((MAIN_X, nodes["create"][3]), (MAIN_X, nodes["confirm"][1])))
connector(((MAIN_X, nodes["confirm"][3]), (MAIN_X, nodes["reload"][1])))
connector(((MAIN_X, nodes["reload"][3]), (MAIN_X, nodes["open_server"][1])))
connector(((MAIN_X, nodes["open_server"][3]), (MAIN_X, 2720)))
final_node(MAIN_X, 2720)

# Failure branches end without creating a membership.
connector(((MAIN_X + 260, 570), (nodes["code_error"][0], 570)))
label(MAIN_X + 300, 515, "No")
connector(((SIDE_X, nodes["code_error"][3]), (SIDE_X, 750)))
final_node(SIDE_X, 750)

connector(((MAIN_X + 260, 1110), (nodes["signin"][0], 1110)))
label(MAIN_X + 300, 1055, "No")
connector(((SIDE_X, nodes["signin"][3]), (SIDE_X, 1290)))
final_node(SIDE_X, 1290)

connector(((MAIN_X + 260, 1470), (nodes["invite_error"][0], 1470)))
label(MAIN_X + 300, 1415, "No")
connector(((SIDE_X, nodes["invite_error"][3]), (SIDE_X, 1650)))
final_node(SIDE_X, 1650)

connector(((MAIN_X + 260, 1830), (nodes["join_error"][0], 1830)))
label(MAIN_X + 300, 1775, "No")
connector(((SIDE_X, nodes["join_error"][3]), (SIDE_X, 2010)))
final_node(SIDE_X, 2010)

img.save(OUT, dpi=(300, 300))
print(OUT)
