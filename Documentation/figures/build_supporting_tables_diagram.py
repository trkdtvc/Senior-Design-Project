from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


OUT = Path(__file__).with_name("Figure 3.10 - YFNC supporting tables and integrity relationships.png")
W, H = 3600, 2450
BG = "white"
INK = "#111111"
LINE = "#26384a"
IDENTITY_FILL = "#fff7e6"
SERVER_FILL = "#eef4f9"
CHANNEL_FILL = "#f2f5f7"
DIRECT_FILL = "#f4f1fa"


def font(size: int, bold: bool = False):
    base = Path("C:/Windows/Fonts")
    return ImageFont.truetype(str(base / ("timesbd.ttf" if bold else "times.ttf")), size)


TITLE = font(58, True)
BODY = font(46)
BODY_BOLD = font(46, True)
GROUP = font(54, True)
LABEL = font(40, True)

img = Image.new("RGB", (W, H), BG)
draw = ImageDraw.Draw(img)


def fit_font(text, max_width, bold=True):
    for size in (58, 54, 50, 46, 42, 38):
        candidate = font(size, bold)
        if draw.textbbox((0, 0), text, font=candidate)[2] <= max_width:
            return candidate
    return font(36, bold)


def centered_text(cx, y, text, text_font):
    bbox = draw.textbbox((0, 0), text, font=text_font)
    draw.text((cx - (bbox[2] - bbox[0]) / 2, y), text, fill=INK, font=text_font)


def core_box(cx, cy, title, subtitle, fill, width=730, height=190):
    box = (cx - width / 2, cy - height / 2, cx + width / 2, cy + height / 2)
    draw.rounded_rectangle(box, radius=20, fill=fill, outline=LINE, width=5)
    centered_text(cx, cy - 61, title, fit_font(title, width - 30))
    centered_text(cx, cy + 10, subtitle, fit_font(subtitle, width - 35, bold=False))
    return box


def support_box(cx, cy, title, lines, fill, width=730, height=270):
    x1, y1, x2, y2 = cx - width / 2, cy - height / 2, cx + width / 2, cy + height / 2
    draw.rounded_rectangle((x1, y1, x2, y2), radius=18, fill=fill, outline=LINE, width=5)
    draw.line((x1, y1 + 78, x2, y1 + 78), fill=LINE, width=4)
    centered_text(cx, y1 + 9, title, fit_font(title, width - 25))
    ty = y1 + 92
    for prefix, value in lines:
        prefix_text = f"{prefix} " if prefix else ""
        draw.text((x1 + 22, ty), prefix_text, fill=INK, font=BODY_BOLD if prefix else BODY)
        offset = draw.textbbox((0, 0), prefix_text, font=BODY_BOLD if prefix else BODY)[2]
        draw.text((x1 + 22 + offset, ty), value, fill=INK, font=BODY)
        ty += 55
    return (x1, y1, x2, y2)


IDENTITY_X, SERVER_X, CHANNEL_X, DIRECT_X = 450, 1320, 2250, 3170
CORE_Y = 280
ROWS = (700, 1060, 1420, 1780, 2140)

# Relationship spines are drawn before the boxes.
for x, count in ((IDENTITY_X, 1), (SERVER_X, 2), (CHANNEL_X, 5), (DIRECT_X, 5)):
    draw.line((x, CORE_Y + 95, x, ROWS[count - 1] - 123), fill=LINE, width=5)

# Column headings.
for x, heading in (
    (IDENTITY_X, "Identity support"),
    (SERVER_X, "Server moderation"),
    (CHANNEL_X, "Channel interaction"),
    (DIRECT_X, "Direct interaction"),
):
    centered_text(x, 35, heading, GROUP)

# Core/parent entity boxes.
core_box(IDENTITY_X, CORE_Y, "users", "account and token owner", IDENTITY_FILL)
core_box(SERVER_X, CORE_Y, "servers", "server and moderation parent", SERVER_FILL)
core_box(CHANNEL_X, CORE_Y, "channels / messages", "channel communication parents", CHANNEL_FILL)
core_box(DIRECT_X, CORE_Y, "direct conversations / messages", "private communication parents", DIRECT_FILL)

# Identity and server support tables.
support_box(IDENTITY_X, ROWS[0], "email_verification_tokens", [
    ("FK", "user_id"),
    ("UQ", "token; expires_at, used_at"),
], IDENTITY_FILL)

support_box(SERVER_X, ROWS[0], "server_bans", [
    ("FK", "server_id, user_id, banned_by"),
    ("UQ", "server_id, user_id"),
], SERVER_FILL)
support_box(SERVER_X, ROWS[1], "user_muted_servers", [
    ("FK", "user_id, server_id"),
    ("UQ", "user_id, server_id"),
], SERVER_FILL)

# Channel-message support tables.
support_box(CHANNEL_X, ROWS[0], "message_mentions", [
    ("FK", "message_id, mentioned_user_id"),
    ("UQ", "message_id, mentioned_user_id"),
], CHANNEL_FILL)
support_box(CHANNEL_X, ROWS[1], "message_reactions", [
    ("FK", "message_id, user_id"),
    ("UQ", "message_id, user_id, emoji"),
], CHANNEL_FILL)
support_box(CHANNEL_X, ROWS[2], "message_pins", [
    ("FK", "message_id, pinned_by"),
    ("UQ", "message_id"),
], CHANNEL_FILL)
support_box(CHANNEL_X, ROWS[3], "channel_read_states", [
    ("FK", "user_id, channel_id"),
    ("FK", "last_read_message_id"),
    ("UQ", "user_id, channel_id"),
], CHANNEL_FILL)
support_box(CHANNEL_X, ROWS[4], "user_muted_channels", [
    ("FK", "user_id, channel_id"),
    ("UQ", "user_id, channel_id"),
], CHANNEL_FILL)

# Direct-message support tables.
support_box(DIRECT_X, ROWS[0], "direct_message_reactions", [
    ("FK", "direct_message_id, user_id"),
    ("UQ", "message, user, emoji"),
], DIRECT_FILL)
support_box(DIRECT_X, ROWS[1], "direct_message_pins", [
    ("FK", "direct_message_id, pinned_by"),
    ("UQ", "direct_message_id"),
], DIRECT_FILL)
support_box(DIRECT_X, ROWS[2], "direct_conversation_read_states", [
    ("FK", "user_id, conversation_id"),
    ("FK", "last_read_message_id"),
    ("UQ", "user_id, conversation_id"),
], DIRECT_FILL)
support_box(DIRECT_X, ROWS[3], "direct_conversation_deletions", [
    ("FK", "conversation_id, user_id"),
    ("UQ", "conversation_id, user_id"),
], DIRECT_FILL)
support_box(DIRECT_X, ROWS[4], "user_muted_direct_conversations", [
    ("FK", "user_id, conversation_id"),
    ("UQ", "user_id, conversation_id"),
], DIRECT_FILL)

# Compact legend.
draw.line((510, 2370, 660, 2370), fill=LINE, width=5)
draw.text((690, 2340), "required parent relationship", fill=INK, font=LABEL)
draw.text((1690, 2340), "FK = foreign key     UQ = unique constraint", fill=INK, font=LABEL)

img.save(OUT, dpi=(300, 300))
print(OUT)
