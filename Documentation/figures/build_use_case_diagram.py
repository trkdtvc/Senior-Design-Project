from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import math


OUT = Path(__file__).with_name("Figure 3.2 - YFNC use case model.png")
W, H = 2800, 1900
BG = "white"
INK = "#111111"
LINE = "#25364a"
USE_FILL = "#eef4f9"
SERVICE_FILL = "#f4f6f8"


def font(size: int, bold: bool = False):
    base = Path("C:/Windows/Fonts")
    return ImageFont.truetype(str(base / ("timesbd.ttf" if bold else "times.ttf")), size)


TITLE = font(46, True)
BODY = font(34)
ACTOR = font(36, True)
SMALL = font(28)


img = Image.new("RGB", (W, H), BG)
draw = ImageDraw.Draw(img)


def text_center(x, y, lines, fonts, gap=8):
    heights = [draw.textbbox((0, 0), t, font=f)[3] for t, f in zip(lines, fonts)]
    total = sum(heights) + gap * (len(lines) - 1)
    cy = y - total / 2
    for t, f, h in zip(lines, fonts, heights):
        bb = draw.textbbox((0, 0), t, font=f)
        draw.text((x - (bb[2]-bb[0])/2, cy), t, fill=INK, font=f)
        cy += h + gap


def stick_actor(x, y, lines):
    # y is top of actor symbol.
    draw.ellipse((x-30, y, x+30, y+60), outline=LINE, width=5)
    draw.line((x, y+60, x, y+155), fill=LINE, width=5)
    draw.line((x-55, y+95, x+55, y+95), fill=LINE, width=5)
    draw.line((x, y+155, x-50, y+220), fill=LINE, width=5)
    draw.line((x, y+155, x+50, y+220), fill=LINE, width=5)
    text_center(x, y+265, lines, [ACTOR] + [BODY]*(len(lines)-1), gap=5)
    return (x, y+220)


def service_box(x, y, title, subtitle):
    box = (x-230, y-95, x+230, y+95)
    draw.rounded_rectangle(box, radius=18, fill=SERVICE_FILL, outline=LINE, width=4)
    text_center(x, y, [title, subtitle], [ACTOR, SMALL], gap=10)
    return box


def use_case(x, y, lines):
    box = (x-245, y-78, x+245, y+78)
    draw.ellipse(box, fill=USE_FILL, outline=LINE, width=4)
    text_center(x, y, lines, [BODY]*len(lines), gap=5)
    return box


def line(start, end, width=4):
    draw.line((start, end), fill=LINE, width=width)


def hollow_triangle(tip, direction, size=34):
    # direction is the angle from base toward the triangle tip.
    back = (tip[0]-size*math.cos(direction), tip[1]-size*math.sin(direction))
    normal = (-math.sin(direction), math.cos(direction))
    p2 = (back[0]+size*0.65*normal[0], back[1]+size*0.65*normal[1])
    p3 = (back[0]-size*0.65*normal[0], back[1]-size*0.65*normal[1])
    draw.polygon((tip, p2, p3), fill=BG, outline=LINE)
    draw.line((tip, p2, p3, tip), fill=LINE, width=4)


# System boundary.
boundary = (500, 330, 2280, 1820)
draw.rounded_rectangle(boundary, radius=18, outline=LINE, width=5)
draw.rectangle((535, 345, 750, 415), fill=BG)
draw.text((555, 350), "YFNC", fill=INK, font=TITLE)

# Actors above the system boundary.
visitor_anchor = stick_actor(820, 25, ["Unauthenticated", "Visitor"])
user_anchor = stick_actor(1400, 25, ["Registered User"])
owner_anchor = stick_actor(1980, 25, ["Server Owner /", "Authorized Member"])

# Actor generalization: owner is a specialized registered user.
line((1915, 145), (1465, 145))
hollow_triangle((1465, 145), math.pi)
draw.rectangle((1580, 115, 1820, 175), fill=BG)
draw.text((1600, 120), "specializes", fill=INK, font=SMALL)

# Use case columns.
visitor_cases = [
    (820, 500, ["Register account"]),
    (820, 790, ["Verify email address"]),
    (820, 1080, ["Sign in"]),
    (820, 1370, ["Recover password"]),
]
user_cases = [
    (1400, 470, ["Manage profile", "and account"]),
    (1400, 650, ["Manage friendships", "and blocks"]),
    (1400, 830, ["Create or join", "server"]),
    (1400, 1010, ["Exchange channel", "messages"]),
    (1400, 1190, ["Exchange direct", "messages"]),
    (1400, 1370, ["Interact with messages", "and attachments"]),
    (1400, 1550, ["Manage presence, read state,", "and notifications"]),
    (1400, 1730, ["Ask the conversation", "assistant"]),
]
owner_cases = [
    (1980, 750, ["Manage server", "and channels"]),
    (1980, 1160, ["Manage roles, permissions,", "and moderation"]),
]

# Association routing is drawn before the use-case ellipses so lines terminate
# at their borders and never cover labels.
visitor_bus_x = 540
user_bus_x = 1140
owner_bus_x = 1720

line((765, 120), (visitor_bus_x, 300))
line((visitor_bus_x, 300), (visitor_bus_x, 430))
line((visitor_bus_x, 430), (visitor_bus_x, visitor_cases[-1][1]))
for x, y, _ in visitor_cases:
    line((visitor_bus_x, y), (x-245, y))

line((1345, 120), (user_bus_x, 300))
line((user_bus_x, 300), (user_bus_x, 430))
line((user_bus_x, 430), (user_bus_x, user_cases[-1][1]))
for x, y, _ in user_cases:
    line((user_bus_x, y), (x-245, y))

line((1925, 120), (owner_bus_x, 300))
line((owner_bus_x, 300), (owner_bus_x, 430))
line((owner_bus_x, 430), (owner_bus_x, owner_cases[-1][1]))
for x, y, _ in owner_cases:
    line((owner_bus_x, y), (x-245, y))

# Supporting-service associations are also drawn behind their endpoint nodes.
line((450, 1030), (visitor_cases[1][0]-245, visitor_cases[1][1]))
line((450, 1130), (visitor_cases[3][0]-245, visitor_cases[3][1]))
line((2340, 1660), (user_cases[-1][0]+245, user_cases[-1][1]))

# Draw endpoint nodes after all associations.
visitor_boxes = [use_case(x, y, lines) for x, y, lines in visitor_cases]
user_boxes = [use_case(x, y, lines) for x, y, lines in user_cases]
owner_boxes = [use_case(x, y, lines) for x, y, lines in owner_cases]

resend = service_box(240, 1080, "Resend", "External email service")
gemini = service_box(2570, 1660, "Gemini", "External AI service")
text_center(240, 930, ["Supporting actor"], [SMALL])
text_center(2570, 1510, ["Supporting actor"], [SMALL])

img.save(OUT, dpi=(300, 300))
print(OUT)
