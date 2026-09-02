from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import math


OUT = Path(__file__).with_name("Figure 3.5 - Sending a message to an authorized conversation activity.png")
W, H = 2100, 3150
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

# Initial node and principal success path.
draw.ellipse((MAIN_X - 36, 45, MAIN_X + 36, 117), fill=INK)

nodes = {}
nodes["compose"] = action(MAIN_X, 220, "[User] Compose and submit a message", USER_FILL)
nodes["front_validate"] = action(MAIN_X, 400, "[Frontend] Validate message input and attachment selection")
decision(MAIN_X, 610, "Input valid?")
nodes["request"] = action(MAIN_X, 810, "[Frontend] Send message request with conversation identifier")
nodes["authenticate"] = action(MAIN_X, 990, "[Backend] Authenticate the requesting user")
decision(MAIN_X, 1200, "Authentication valid?")
nodes["access"] = action(MAIN_X, 1400, "[Backend] Check conversation membership and sending permission")
decision(MAIN_X, 1610, "Authorized to send?")
nodes["server_validate"] = action(MAIN_X, 1810, "[Backend] Validate content and attachment metadata")
decision(MAIN_X, 2020, "Message data valid?")
nodes["attachment"] = action(MAIN_X, 2220, "[Attachment storage] Store permitted attachment if included", SERVICE_FILL)
nodes["persist"] = action(MAIN_X, 2400, "[MySQL] Persist message and attachment record")
nodes["event"] = action(MAIN_X, 2580, "[Socket.IO] Distribute message event to authorized participants", SERVICE_FILL)
nodes["render"] = action(MAIN_X, 2760, "[Frontend] Render the message and update conversation state")

# Error and retry outcomes.
nodes["input_error"] = action(SIDE_X, 610, "[Frontend] Display input validation error", ERROR_FILL, 670)
nodes["auth_error"] = action(SIDE_X, 1200, "[Frontend] Display authentication error", ERROR_FILL, 670)
nodes["access_error"] = action(SIDE_X, 1610, "[Frontend] Display conversation access error", ERROR_FILL, 670)
nodes["message_error"] = action(SIDE_X, 2020, "[Frontend] Display message validation error", ERROR_FILL, 670)

# Main connectors.
connector(((MAIN_X, 117), (MAIN_X, nodes["compose"][1])))
connector(((MAIN_X, nodes["compose"][3]), (MAIN_X, nodes["front_validate"][1])))
connector(((MAIN_X, nodes["front_validate"][3]), (MAIN_X, 525)))
connector(((MAIN_X, 695), (MAIN_X, nodes["request"][1])))
label(MAIN_X + 28, 702, "Yes")
connector(((MAIN_X, nodes["request"][3]), (MAIN_X, nodes["authenticate"][1])))
connector(((MAIN_X, nodes["authenticate"][3]), (MAIN_X, 1115)))
connector(((MAIN_X, 1285), (MAIN_X, nodes["access"][1])))
label(MAIN_X + 28, 1292, "Yes")
connector(((MAIN_X, nodes["access"][3]), (MAIN_X, 1525)))
connector(((MAIN_X, 1695), (MAIN_X, nodes["server_validate"][1])))
label(MAIN_X + 28, 1702, "Yes")
connector(((MAIN_X, nodes["server_validate"][3]), (MAIN_X, 1935)))
connector(((MAIN_X, 2105), (MAIN_X, nodes["attachment"][1])))
label(MAIN_X + 28, 2112, "Yes")
connector(((MAIN_X, nodes["attachment"][3]), (MAIN_X, nodes["persist"][1])))
connector(((MAIN_X, nodes["persist"][3]), (MAIN_X, nodes["event"][1])))
connector(((MAIN_X, nodes["event"][3]), (MAIN_X, nodes["render"][1])))
connector(((MAIN_X, nodes["render"][3]), (MAIN_X, 2940)))
final_node(MAIN_X, 2940)

# Invalid frontend input returns to message composition.
connector(((MAIN_X + 260, 610), (nodes["input_error"][0], 610)))
label(MAIN_X + 300, 555, "No")
connector(((SIDE_X, nodes["input_error"][1]), (SIDE_X, 290), (nodes["compose"][2], 290), (nodes["compose"][2], 250)))

# Authentication failure terminates the protected operation.
connector(((MAIN_X + 260, 1200), (nodes["auth_error"][0], 1200)))
label(MAIN_X + 300, 1145, "No")
connector(((SIDE_X, nodes["auth_error"][3]), (SIDE_X, 1400)))
final_node(SIDE_X, 1400)

# Authorization failure terminates without persisting a message.
connector(((MAIN_X + 260, 1610), (nodes["access_error"][0], 1610)))
label(MAIN_X + 300, 1555, "No")
connector(((SIDE_X, nodes["access_error"][3]), (SIDE_X, 1810)))
final_node(SIDE_X, 1810)

# Backend-validation failure returns to message composition.
connector(((MAIN_X + 260, 2020), (nodes["message_error"][0], 2020)))
label(MAIN_X + 300, 1965, "No")
connector(((nodes["message_error"][2], 2020), (RIGHT_BUS, 2020), (RIGHT_BUS, 290), (SIDE_X, 290)), arrow=False)

img.save(OUT, dpi=(300, 300))
print(OUT)
