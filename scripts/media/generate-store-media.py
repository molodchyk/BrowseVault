from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError as exc:
    raise SystemExit("Pillow is required to regenerate store media: python -m pip install pillow") from exc


ROOT = Path(__file__).resolve().parents[2]
PROMO_DIR = ROOT / "store-listing" / "chrome-web-store" / "media" / "promo"

COLORS = {
    "bg": "#061313",
    "panel": "#112728",
    "panel_2": "#173334",
    "line": "#31585B",
    "muted": "#A9C5C7",
    "text": "#F4FBFB",
    "teal": "#18A8AA",
    "teal_dark": "#126B70",
    "blue": "#2A69A7",
    "gold": "#E2A84A",
    "red": "#A12C3D",
    "ink": "#081A1B",
}

FONT_CANDIDATES = {
    "regular": [
        "C:/Windows/Fonts/segoeui.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/Library/Fonts/Arial.ttf",
    ],
    "semibold": [
        "C:/Windows/Fonts/seguisb.ttf",
        "C:/Windows/Fonts/segoeuib.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/Library/Fonts/Arial Bold.ttf",
    ],
    "bold": [
        "C:/Windows/Fonts/segoeuib.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/Library/Fonts/Arial Bold.ttf",
    ],
    "mono": [
        "C:/Windows/Fonts/consola.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
        "/Library/Fonts/Menlo.ttc",
    ],
}


def load_font(size, style="regular"):
    for candidate in FONT_CANDIDATES[style]:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default(size=size)


def draw_text(draw, xy, value, size, fill=None, style="regular", anchor=None):
    draw.text(
        xy,
        value,
        font=load_font(size, style),
        fill=fill or COLORS["text"],
        anchor=anchor,
    )


def text_width(value, size, style="regular"):
    font = load_font(size, style)
    left, _top, right, _bottom = font.getbbox(value)
    return right - left


def rounded(draw, xy, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)


def chip(draw, xy, label, fill, text_fill=None, pad_x=14, pad_y=8, size=17):
    x, y = xy
    width = text_width(label, size, "semibold") + pad_x * 2
    height = size + pad_y * 2
    rounded(draw, (x, y, x + width, y + height), 10, fill)
    draw_text(draw, (x + pad_x, y + pad_y - 1), label, size, text_fill or COLORS["text"], "semibold")
    return width


def card(draw, xy, radius=18, fill=None):
    rounded(draw, xy, radius, fill or COLORS["panel"], COLORS["line"], 2)


def vault_mark(draw, xy, size):
    x, y = xy
    rounded(draw, (x, y, x + size, y + size), max(8, size // 5), COLORS["teal_dark"])
    inset = max(5, size // 6)
    body_y = y + int(size * 0.42)
    rounded(
        draw,
        (x + inset, body_y, x + size - inset, y + size - inset),
        max(3, size // 10),
        COLORS["text"],
    )
    rounded(
        draw,
        (x + inset + 3, body_y + 3, x + size - inset - 3, y + size - inset - 3),
        max(2, size // 12),
        COLORS["teal_dark"],
    )
    shackle_w = int(size * 0.42)
    shackle_h = int(size * 0.25)
    shackle_x = x + (size - shackle_w) // 2
    draw.arc(
        (shackle_x, y + int(size * 0.22), shackle_x + shackle_w, y + int(size * 0.22) + shackle_h),
        180,
        360,
        fill=COLORS["gold"],
        width=max(3, size // 12),
    )
    rounded(
        draw,
        (x + int(size * 0.44), y + int(size * 0.60), x + int(size * 0.56), y + int(size * 0.72)),
        3,
        COLORS["gold"],
    )


def mini_result(draw, x, y, width, title, meta, accent=COLORS["teal"]):
    rounded(draw, (x, y, x + width, y + 54), 12, "#0D2021", COLORS["line"], 1)
    rounded(draw, (x + 14, y + 17, x + 28, y + 31), 4, accent)
    draw_text(draw, (x + 42, y + 10), title, 17, COLORS["text"], "semibold")
    draw_text(draw, (x + 42, y + 33), meta, 12, COLORS["muted"], "regular")


def search_card(draw, x, y, width, height):
    card(draw, (x, y, x + width, y + height), 18)
    header_h = 54
    rounded(draw, (x, y, x + width, y + header_h), 18, COLORS["panel_2"])
    draw.rectangle((x, y + header_h - 18, x + width, y + header_h), fill=COLORS["panel_2"])
    draw_text(draw, (x + 22, y + 17), "History search", 20, style="bold")
    draw_text(draw, (x + width - 24, y + 18), "local vault", 15, COLORS["muted"], "semibold", "ra")

    search_y = y + header_h + 22
    rounded(draw, (x + 22, search_y, x + width - 22, search_y + 50), 10, COLORS["ink"], COLORS["line"], 1)
    draw_text(draw, (x + 40, search_y + 14), 'site:docs after:2026-01-01 "exact"', 18, COLORS["muted"], "mono")

    chips_y = search_y + 68
    cursor = x + 22
    for label, fill in [
        ("site:", COLORS["teal_dark"]),
        ("after:", COLORS["blue"]),
        ("regex:", COLORS["gold"]),
    ]:
        cursor += chip(draw, (cursor, chips_y), label, fill, size=14, pad_x=11, pad_y=6) + 8

    result_y = chips_y + 54
    mini_result(draw, x + 22, result_y, width - 44, "Chrome Web Store research", "chrome.google.com - 12 visits", COLORS["teal"])
    mini_result(draw, x + 22, result_y + 68, width - 44, "Backup release checklist", "github.com - exported today", COLORS["blue"])


def backup_card(draw, x, y, width, height):
    card(draw, (x, y, x + width, y + height), 18, COLORS["panel_2"])
    draw_text(draw, (x + 22, y + 20), "Backup status", 22, style="bold")
    draw_text(draw, (x + 22, y + 52), "JSON archive verified", 16, COLORS["muted"], "regular")
    chip(draw, (x + 392, y + 20), "export CSV", COLORS["blue"], size=15)
    chip(draw, (x + 505, y + 20), "restore", COLORS["teal_dark"], size=15)
    rows = [
        ("16,435", "records"),
        ("177", "domains"),
        ("SHA-256", "integrity"),
    ]
    row_y = y + 74
    for index, (value, label) in enumerate(rows):
        box_x = x + 22 + index * ((width - 64) // 3)
        box_w = (width - 80) // 3
        rounded(draw, (box_x, row_y, box_x + box_w, row_y + 38), 10, COLORS["ink"], COLORS["line"], 1)
        draw_text(draw, (box_x + 14, row_y + 6), value, 20 if index != 2 else 17, COLORS["teal"], "bold")
        draw_text(draw, (box_x + 112, row_y + 10), label, 12, COLORS["muted"], "semibold")


def small_promo():
    image = Image.new("RGB", (440, 280), COLORS["bg"])
    draw = ImageDraw.Draw(image)

    draw.rectangle((0, 0, 440, 6), fill=COLORS["teal_dark"])
    vault_mark(draw, (30, 36), 34)
    draw_text(draw, (74, 38), "BrowseVault", 25, style="bold")
    draw_text(draw, (75, 69), "History Search & Backup", 12, COLORS["muted"], "regular")

    chip(draw, (34, 114), "Local vault", COLORS["teal_dark"], size=13, pad_x=11, pad_y=7)
    chip(draw, (34, 154), "Search operators", COLORS["blue"], size=13, pad_x=11, pad_y=7)
    chip(draw, (34, 194), "Backup + export", COLORS["gold"], COLORS["ink"], size=13, pad_x=11, pad_y=7)

    rounded(draw, (250, 34, 408, 236), 16, COLORS["panel"], COLORS["line"], 2)
    draw_text(draw, (266, 52), "Search vault", 16, style="bold")
    rounded(draw, (266, 82, 392, 112), 8, COLORS["ink"], COLORS["line"], 1)
    draw_text(draw, (278, 90), "site:docs", 10, COLORS["muted"], "mono")

    for i, (title, meta, color) in enumerate(
        [
            ("Design notes", "8 visits", COLORS["teal"]),
            ("Backup run", "JSON ok", COLORS["blue"]),
            ("Restore check", "passed", COLORS["gold"]),
        ]
    ):
        row_y = 128 + i * 34
        rounded(draw, (266, row_y, 392, row_y + 28), 6, "#0D2021", COLORS["line"], 1)
        rounded(draw, (276, row_y + 9, 288, row_y + 17), 3, color)
        draw_text(draw, (296, row_y + 3), title, 9, COLORS["text"], "semibold")
        draw_text(draw, (296, row_y + 16), meta, 7, COLORS["muted"], "regular")

    draw_text(draw, (34, 248), 'after:2026-01-01  "exact"', 11, COLORS["gold"], "mono")
    return image


def marquee_promo():
    image = Image.new("RGB", (1400, 560), COLORS["bg"])
    draw = ImageDraw.Draw(image)

    draw.rectangle((0, 0, 1400, 10), fill=COLORS["teal_dark"])
    draw.rectangle((0, 550, 1400, 560), fill=COLORS["blue"])
    vault_mark(draw, (94, 78), 58)
    draw_text(draw, (170, 80), "BrowseVault", 64, style="bold")
    draw_text(draw, (172, 150), "History Search & Backup", 31, COLORS["muted"], "regular")
    draw_text(draw, (98, 230), "Private browser history search, backup,", 28, COLORS["text"], "semibold")
    draw_text(draw, (98, 266), "export, and preservation.", 28, COLORS["text"], "semibold")

    chip(draw, (98, 335), "local-first", COLORS["teal_dark"], size=20)
    chip(draw, (254, 335), "advanced search", COLORS["blue"], size=20)
    chip(draw, (474, 335), "backup integrity", COLORS["gold"], COLORS["ink"], size=20)
    rounded(draw, (98, 432, 606, 486), 12, COLORS["ink"], COLORS["line"], 1)
    draw_text(draw, (122, 449), 'site:docs after:2026-01-01 "exact phrase"', 20, COLORS["gold"], "mono")

    search_card(draw, 690, 58, 610, 322)
    backup_card(draw, 690, 398, 610, 120)

    draw_text(draw, (1300, 525), "No analytics. No host permissions. No remote code.", 16, COLORS["muted"], "semibold", "ra")
    return image


def main():
    PROMO_DIR.mkdir(parents=True, exist_ok=True)
    outputs = [
        ("small-promo.png", small_promo()),
        ("marquee-promo.png", marquee_promo()),
    ]

    for filename, image in outputs:
        image.save(PROMO_DIR / filename, optimize=True)
        print(f"Generated {filename} ({image.width}x{image.height})")


if __name__ == "__main__":
    main()
