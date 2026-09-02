from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import math


OUT = Path(__file__).with_name("Figure 3.9 - YFNC core entity relationship model.png")
W, H = 3500, 2350
BG = "white"
INK = "#111111"
LINE = "#26384a"
USER_FILL = "#fff7e6"
SOCIAL_FILL = "#eef7f1"
SERVER_FILL = "#eef4f9"
MESSAGE_FILL = "#f2f5f7"
DIRECT_FILL = "#f4f1fa"


def font(size: int, bold: bool = False):
    base = Path("C:/Windows/Fonts")
    return ImageFont.truetype(str(base / ("timesbd.ttf" if bold else "times.ttf")), size)


TITLE = font(68, True)
FIELD = font(50)
FIELD_BOLD = font(50, True)
GROUP = font(52, True)
LABEL = font(40, True)

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


def connector(points, dashed=False, width=5):
    if dashed:
        dashed_line(points, width=width)
    else:
        draw.line(points, fill=LINE, width=width, joint="curve")


def relation_label(x, y, text):
    bbox = draw.textbbox((0, 0), text, font=LABEL)
    draw.rectangle((x - 8, y - 5, x + bbox[2] + 8, y + bbox[3] + 5), fill=BG)
    draw.text((x, y), text, fill=INK, font=LABEL)


def fitted_title_font(text, max_width):
    for size in (68, 64, 60, 56, 52, 48, 44):
        candidate = font(size, True)
        if draw.textbbox((0, 0), text, font=candidate)[2] <= max_width:
            return candidate
    return font(42, True)


def entity_box(cx, cy, title, fields, fill, width=700, height=330):
    x1, y1, x2, y2 = cx - width / 2, cy - height / 2, cx + width / 2, cy + height / 2
    draw.rounded_rectangle((x1, y1, x2, y2), radius=18, fill=fill, outline=LINE, width=5)
    draw.line((x1, y1 + 86, x2, y1 + 86), fill=LINE, width=4)
    title_font = fitted_title_font(title, width - 30)
    bbox = draw.textbbox((0, 0), title, font=title_font)
    draw.text((cx - (bbox[2] - bbox[0]) / 2, y1 + 10), title, fill=INK, font=title_font)
    fy = y1 + 98
    for prefix, name in fields:
        prefix_font = FIELD_BOLD if prefix else FIELD
        prefix_text = f"{prefix} " if prefix else ""
        draw.text((x1 + 24, fy), prefix_text, fill=INK, font=prefix_font)
        px = draw.textbbox((0, 0), prefix_text, font=prefix_font)[2]
        draw.text((x1 + 24 + px, fy), name, fill=INK, font=FIELD)
        fy += 58
    return (x1, y1, x2, y2)


SOCIAL_X, SERVER_X, MESSAGE_X, DIRECT_X = 420, 1260, 2200, 3120
Y1, Y2, Y3 = 720, 1220, 1720
USER_X, USER_Y = 1750, 210

# Relationship connectors are drawn first and remain behind the entity boxes.
# Dashed lines represent foreign-key references back to users.
connector(((1440, 365), (60, 365), (60, Y3), (70, Y3)), dashed=True)
for y in (Y1, Y2, Y3):
    connector(((60, y), (70, y)), dashed=True)

connector(((1600, 365), (875, 365), (875, Y3), (910, Y3)), dashed=True)
for y in (Y1, Y2, Y3):
    connector(((875, y), (910, y)), dashed=True)

connector(((1900, 365), (2570, 365), (2570, Y2), (2550, Y2)), dashed=True)
connector(((2060, 365), (3490, 365), (3490, Y2), (3470, Y2)), dashed=True)
connector(((3490, Y1), (3470, Y1)), dashed=True)

# Server, channel-message, and direct-message parent-child relationships.
connector(((SERVER_X, Y1 + 165), (SERVER_X, Y2 - 165)))
connector(((SERVER_X + 350, Y1), (1680, Y1), (1680, Y3), (SERVER_X + 350, Y3)))
connector(((SERVER_X + 350, Y1), (MESSAGE_X - 350, Y1)))
connector(((MESSAGE_X, Y1 + 165), (MESSAGE_X, Y2 - 165)))
connector(((MESSAGE_X, Y2 + 165), (MESSAGE_X, Y3 - 165)))
connector(((DIRECT_X, Y1 + 165), (DIRECT_X, Y2 - 165)))
connector(((DIRECT_X, Y2 + 165), (DIRECT_X, Y3 - 165)))

# Domain headings.
for x, heading in (
    (SOCIAL_X, "Social relationships"),
    (SERVER_X, "Server membership"),
    (MESSAGE_X, "Channel messaging"),
    (DIRECT_X, "Direct messaging"),
):
    bbox = draw.textbbox((0, 0), heading, font=GROUP)
    draw.text((x - (bbox[2] - bbox[0]) / 2, 485), heading, fill=INK, font=GROUP)

# Entity boxes.
entity_box(USER_X, USER_Y, "users", [
    ("PK", "user_id"),
    ("UQ", "username, email"),
    ("", "password_hash, status"),
], USER_FILL, width=700, height=310)

entity_box(SOCIAL_X, Y1, "friend_requests", [
    ("PK", "request_id"),
    ("FK", "sender_id, receiver_id"),
    ("", "status"),
], SOCIAL_FILL)
entity_box(SOCIAL_X, Y2, "friendships", [
    ("PK", "friendship_id"),
    ("FK", "user_one_id, user_two_id"),
    ("UQ", "user pair"),
], SOCIAL_FILL)
entity_box(SOCIAL_X, Y3, "user_blocks", [
    ("PK", "block_id"),
    ("FK", "blocker_id, blocked_id"),
    ("UQ", "user pair"),
], SOCIAL_FILL)

entity_box(SERVER_X, Y1, "servers", [
    ("PK", "server_id"),
    ("FK", "owner_id"),
    ("", "server_name"),
], SERVER_FILL)
entity_box(SERVER_X, Y2, "server_members", [
    ("PK", "member_id"),
    ("FK", "server_id, user_id"),
    ("", "server_role"),
], SERVER_FILL)
entity_box(SERVER_X, Y3, "server_invites", [
    ("PK", "invite_id"),
    ("FK", "server_id, created_by"),
    ("UQ", "invite_code"),
], SERVER_FILL)

entity_box(MESSAGE_X, Y1, "channels", [
    ("PK", "channel_id"),
    ("FK", "server_id"),
    ("UQ", "server_id, channel_name"),
], MESSAGE_FILL)
entity_box(MESSAGE_X, Y2, "messages", [
    ("PK", "message_id"),
    ("FK", "channel_id, user_id"),
    ("FK", "reply_to_message_id"),
], MESSAGE_FILL)
entity_box(MESSAGE_X, Y3, "message_attachments", [
    ("PK", "attachment_id"),
    ("FK", "message_id"),
    ("", "file_url, file metadata"),
], MESSAGE_FILL)

entity_box(DIRECT_X, Y1, "direct_conversations", [
    ("PK", "conversation_id"),
    ("FK", "user_one_id"),
    ("FK", "user_two_id"),
], DIRECT_FILL)
entity_box(DIRECT_X, Y2, "direct_messages", [
    ("PK", "direct_message_id"),
    ("FK", "conversation_id, sender_id"),
    ("FK", "reply_to_message_id"),
], DIRECT_FILL)
entity_box(DIRECT_X, Y3, "direct_message_attachments", [
    ("PK", "attachment_id"),
    ("FK", "direct_message_id"),
    ("", "file_url, file metadata"),
], DIRECT_FILL)

# Cardinality and connector annotations.
relation_label(SERVER_X + 25, 955, "1 : 0..*")
relation_label(1640, 665, "1 : 0..*")
relation_label(MESSAGE_X + 25, 955, "1 : 0..*")
relation_label(MESSAGE_X + 25, 1455, "1 : 0..*")
relation_label(DIRECT_X + 25, 955, "1 : 0..*")
relation_label(DIRECT_X + 25, 1455, "1 : 0..*")

# Legend.
draw.line((270, 2140, 410, 2140), fill=LINE, width=5)
draw.text((435, 2110), "parent-to-child relationship", fill=INK, font=LABEL)
dashed_line(((1420, 2140), (1560, 2140)), width=5)
draw.text((1585, 2110), "foreign-key reference to users", fill=INK, font=LABEL)
bbox = draw.textbbox((0, 0), "PK = primary key     FK = foreign key     UQ = unique", font=LABEL)
draw.text(((W - (bbox[2] - bbox[0])) / 2, 2220), "PK = primary key     FK = foreign key     UQ = unique", fill=INK, font=LABEL)

img.save(OUT, dpi=(300, 300))
print(OUT)
