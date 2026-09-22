"""
Echo Tower — Level Design Notebook
Generates a grayscale, A4, printable PDF:
  - a symbol legend page
  - one annotation page per existing level (grid + notes lines)
  - several blank grid template pages for designing new levels

The LEVELS list below is copied from src/levels.js — if you add or edit
floors there, update this list too, then regenerate:

  python3 -m venv venv && ./venv/bin/pip install reportlab
  ./venv/bin/python3 make_notebook.py echo-tower-level-notebook.pdf
"""

import sys

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm

# ---------------------------------------------------------------------------
# Level data, mirrored from echo-tower/src/levels.js (kept in sync by hand —
# see DEVELOPMENT.md "Design notebook" section for the regeneration note).

LEVELS = [
    {
        "name": "First Steps",
        "hint": "Reach the stairs. Move with arrow keys or WASD.",
        "map": [
            "##########",
            "#@.......#",
            "#...##...#",
            "#...##...#",
            "#.......>#",
            "##########",
        ],
    },
    {
        "name": "Copycat",
        "hint": "The statue echoes your every move. Walls stop it — use them.",
        "map": [
            "###########",
            "#....#....#",
            "#.@..E...>#",
            "#....#....#",
            "###########",
        ],
    },
    {
        "name": "The Gatekeeper",
        "hint": "It cannot follow where walls forbid.",
        "map": [
            "##########",
            "##>......#",
            "##.####.##",
            "#........#",
            "#..E.....#",
            "#..@.....#",
            "#........#",
            "##########",
        ],
    },
    {
        "name": "The Switch",
        "hint": "Square switches stay pressed forever.",
        "map": [
            "##########",
            "#....#...#",
            "#.@....p.#",
            "#....#...#",
            "#..#######",
            "#..#....>#",
            "#..A.....#",
            "#..#.....#",
            "##########",
        ],
    },
    {
        "name": "Hold It Down",
        "hint": "Round buttons only work while something stands on them.",
        "map": [
            "############",
            "#........a##",
            "#.@.E....A>#",
            "#..........#",
            "############",
        ],
    },
    {
        "name": "Boxed In",
        "hint": "Crates can be pushed — and they are heavy.",
        "map": [
            "##########",
            "#........#",
            "#.@.$..a.#",
            "#........#",
            "####A#####",
            "#........#",
            "#.......>#",
            "##########",
        ],
    },
    {
        "name": "Sink or Swim",
        "hint": "Nobody can cross water. A crate might change that.",
        "map": [
            "############",
            "#....#..~..#",
            "#.@..#..~..#",
            "#..$....~.>#",
            "#.......~..#",
            "############",
        ],
    },
    {
        "name": "Contrary",
        "hint": "This one does the exact opposite of you.",
        "map": [
            "###########",
            "#a........#",
            "#.M...@...#",
            "#.........#",
            "########A##",
            "########>##",
            "###########",
        ],
    },
    {
        "name": "Twin Trouble",
        "hint": "One copies, one opposes. Both doors must open.",
        "map": [
            "#############",
            "#......#...a#",
            "#..E......BA>",
            "#.........###",
            "#.....@.....#",
            "#...........#",
            "#..M........#",
            "#b..........#",
            "#############",
        ],
    },
    {
        "name": "The Penthouse",
        "hint": "Everything you have learned, all at once.",
        "map": [
            "#############",
            "#.......~..a#",
            "#..E....~...#",
            "#.@..$..~...#",
            "#.......~#A##",
            "#.......~#.>#",
            "#############",
        ],
    },
]

MAX_COLS = max(len(row) for lvl in LEVELS for row in lvl["map"])
MAX_ROWS = max(len(lvl["map"]) for lvl in LEVELS)
LINE_GAP = 17

# ---------------------------------------------------------------------------
# Grayscale palette (0 = black, 1 = white)

INK = 0.15
INK_SOFT = 0.55
WALL_FILL = 0.80
WALL_LINE = 0.35
PAPER = 1.0
FAINT = 0.90

PAGE_W, PAGE_H = A4
MARGIN = 18 * mm

# One cell size shared by every level page and the blank templates, sized to
# fit the largest room (The Penthouse / Twin Trouble, 13x9) within the space
# left after the header and a sensible notes area below.
_avail_w = PAGE_W - 2 * MARGIN
_avail_h = 150 * mm
GLOBAL_CELL = min(_avail_w / MAX_COLS, _avail_h / MAX_ROWS, 15 * mm)


def set_gray(c, fill=None, stroke=None):
    if fill is not None:
        c.setFillGray(fill)
    if stroke is not None:
        c.setStrokeGray(stroke)


# ---------------------------------------------------------------------------
# Cell drawing — one function per map symbol. Each draws within a cell rect
# (x, y, size) where (x, y) is the bottom-left corner, in PDF points.

def draw_wall(c, x, y, s):
    set_gray(c, fill=WALL_FILL, stroke=WALL_LINE)
    c.setLineWidth(0.6)
    c.rect(x, y, s, s, fill=1, stroke=1)
    # diagonal hatch
    c.setLineWidth(0.4)
    step = s / 3.0
    for i in range(1, 3):
        o = step * i
        c.line(x + o, y + s, x, y + s - o)
        c.line(x + s, y + o, x + s - o, y)


def draw_floor_grid(c, x, y, s):
    set_gray(c, stroke=INK_SOFT)
    c.setLineWidth(0.4)
    c.rect(x, y, s, s, fill=0, stroke=1)


def draw_void(c, x, y, s):
    pass  # leave blank — outside the room


def draw_water(c, x, y, s):
    draw_floor_grid(c, x, y, s)
    set_gray(c, stroke=INK_SOFT)
    c.setLineWidth(0.5)
    rows = 3
    for r in range(rows):
        wy = y + s * (r + 0.5) / rows
        path = c.beginPath()
        n = 6
        for i in range(n + 1):
            wx = x + s * i / n
            dy = 1.4 * (1 if i % 2 == 0 else -1)
            if i == 0:
                path.moveTo(wx, wy + dy)
            else:
                path.lineTo(wx, wy + dy)
        c.drawPath(path, stroke=1, fill=0)


def draw_stairs(c, x, y, s):
    draw_floor_grid(c, x, y, s)
    set_gray(c, stroke=INK)
    c.setLineWidth(0.7)
    steps = 4
    layer_h = s * 0.11
    inset = (s * 0.8) / steps
    x0 = x + s * 0.1
    top = y + s * 0.85
    for i in range(steps):
        lx = x0 + i * inset
        ly = top - (i + 1) * layer_h
        c.rect(lx, ly, (x + s * 0.9) - lx, layer_h, fill=0, stroke=1)


def draw_label_cell(c, x, y, s, label, shape="square", font_size=None):
    """A bordered shape with a centred letter — used for player/statues/
    crates/buttons/doors so the page matches the map's ASCII characters."""
    draw_floor_grid(c, x, y, s)
    set_gray(c, fill=PAPER, stroke=INK)
    c.setLineWidth(0.8)
    pad = s * 0.16
    if shape == "circle":
        c.circle(x + s / 2, y + s / 2, s / 2 - pad, fill=0, stroke=1)
    elif shape == "square":
        c.rect(x + pad, y + pad, s - 2 * pad, s - 2 * pad, fill=0, stroke=1)
    elif shape == "diamond":
        c.saveState()
        c.translate(x + s / 2, y + s / 2)
        r = s / 2 - pad
        p = c.beginPath()
        p.moveTo(0, r); p.lineTo(r, 0); p.lineTo(0, -r); p.lineTo(-r, 0)
        p.close()
        c.drawPath(p, fill=0, stroke=1)
        c.restoreState()
    elif shape == "bars":
        c.rect(x + pad * 0.6, y + pad * 0.6, s - 1.2 * pad, s - 1.2 * pad, fill=0, stroke=1)
        for i in range(1, 3):
            bx = x + pad * 0.6 + i * (s - 1.2 * pad) / 3
            c.line(bx, y + pad * 0.6, bx, y + s - pad * 0.6)
    fsize = font_size or s * 0.42
    set_gray(c, fill=INK)
    c.setFont("Helvetica-Bold", fsize)
    c.drawCentredString(x + s / 2, y + s / 2 - fsize * 0.35, label)


SYMBOL_DRAW = {
    "#": lambda c, x, y, s: draw_wall(c, x, y, s),
    ".": lambda c, x, y, s: draw_floor_grid(c, x, y, s),
    " ": lambda c, x, y, s: draw_void(c, x, y, s),
    "~": lambda c, x, y, s: draw_water(c, x, y, s),
    ">": lambda c, x, y, s: draw_stairs(c, x, y, s),
    "@": lambda c, x, y, s: draw_label_cell(c, x, y, s, "P", "circle"),
    "E": lambda c, x, y, s: draw_label_cell(c, x, y, s, "E", "square"),
    "M": lambda c, x, y, s: draw_label_cell(c, x, y, s, "M", "square"),
    "$": lambda c, x, y, s: draw_label_cell(c, x, y, s, "X", "diamond"),
    "a": lambda c, x, y, s: draw_label_cell(c, x, y, s, "a", "circle", s * 0.36),
    "b": lambda c, x, y, s: draw_label_cell(c, x, y, s, "b", "circle", s * 0.36),
    "c": lambda c, x, y, s: draw_label_cell(c, x, y, s, "c", "circle", s * 0.36),
    "p": lambda c, x, y, s: draw_label_cell(c, x, y, s, "p", "square", s * 0.36),
    "q": lambda c, x, y, s: draw_label_cell(c, x, y, s, "q", "square", s * 0.36),
    "r": lambda c, x, y, s: draw_label_cell(c, x, y, s, "r", "square", s * 0.36),
    "A": lambda c, x, y, s: draw_label_cell(c, x, y, s, "A", "bars", s * 0.34),
    "B": lambda c, x, y, s: draw_label_cell(c, x, y, s, "B", "bars", s * 0.34),
    "C": lambda c, x, y, s: draw_label_cell(c, x, y, s, "C", "bars", s * 0.34),
}


def draw_grid(c, x0, y_top, cols, rows, size, map_rows=None, coords=False):
    """Draw a cols x rows grid. If map_rows given, render its symbols
    (top-left origin, matching the ASCII map). Otherwise draw an empty
    lettered/numbered grid ready for hand-drawing a new level.
    Returns (width, height) of the drawn grid in points."""
    for ry in range(rows):
        y = y_top - (ry + 1) * size
        for rx in range(cols):
            x = x0 + rx * size
            ch = None
            if map_rows is not None and ry < len(map_rows):
                row = map_rows[ry]
                ch = row[rx] if rx < len(row) else " "
            if ch is not None:
                SYMBOL_DRAW.get(ch, SYMBOL_DRAW["."])(c, x, y, size)
            else:
                draw_floor_grid(c, x, y, size)

    # outer border, a little heavier
    set_gray(c, stroke=INK)
    c.setLineWidth(1.1)
    c.rect(x0, y_top - rows * size, cols * size, rows * size, fill=0, stroke=1)

    if coords:
        set_gray(c, fill=INK_SOFT)
        c.setFont("Helvetica", 6)
        for rx in range(cols):
            c.drawCentredString(x0 + rx * size + size / 2, y_top + 3, str(rx))
        for ry in range(rows):
            c.drawRightString(x0 - 3, y_top - ry * size - size / 2 - 2, str(ry))

    return cols * size, rows * size


# ---------------------------------------------------------------------------
# Page furniture

def header(c, title, subtitle=None):
    set_gray(c, fill=INK)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(MARGIN, PAGE_H - MARGIN, title)
    if subtitle:
        set_gray(c, fill=INK_SOFT)
        c.setFont("Helvetica-Oblique", 10)
        c.drawString(MARGIN, PAGE_H - MARGIN - 14, subtitle)


def footer(c, text):
    set_gray(c, fill=INK_SOFT)
    c.setFont("Helvetica", 8)
    c.drawString(MARGIN, MARGIN - 10, text)
    c.drawRightString(PAGE_W - MARGIN, MARGIN - 10, "Echo Tower — sketchplanations.com")


def ruled_lines(c, x, y_top, width, n, gap=16, label=None):
    set_gray(c, fill=INK_SOFT)
    if label:
        c.setFont("Helvetica-Bold", 9)
        c.drawString(x, y_top, label)
        y_top -= 12
    c.setLineWidth(0.5)
    set_gray(c, stroke=FAINT)
    for i in range(n):
        y = y_top - i * gap
        c.line(x, y, x + width, y)
    return y_top - n * gap


LEGEND_ITEMS = [
    ("#", "Wall"), (".", "Floor"), (" ", "Void / outside"), (">", "Stairs (exit)"),
    ("@", "Player start"), ("E", "Echo statue — copies your move"),
    ("M", "Mirror statue — moves opposite"), ("$", "Crate — pushable, sinks in water"),
    ("~", "Water — impassable until filled"),
    ("a b c", "Momentary button (channel a/b/c) — needs weight"),
    ("p q r", "Latching button (channel a/b/c) — stays pressed"),
    ("A B C", "Door (channel a/b/c) — open while its channel is active"),
]


def draw_legend_page(c):
    header(c, "Echo Tower — Level Design Notebook",
           "Symbol key, used on every level page and the blank templates below.")
    y = PAGE_H - MARGIN - 46
    size = 15 * mm
    label_x = MARGIN + size + 8
    set_gray(c, fill=INK)
    for sym, desc in LEGEND_ITEMS:
        cell_x = MARGIN
        # draw a representative cell (use the first character as the symbol)
        draw_ch = sym[0] if sym != " " else " "
        # for multi-letter labels like "a b c" just draw the 'a' example,
        # already correctly rendered via SYMBOL_DRAW.
        SYMBOL_DRAW.get(draw_ch, SYMBOL_DRAW["."])(c, cell_x, y - size, size)
        set_gray(c, fill=INK)
        c.setFont("Helvetica-Bold", 11)
        c.drawString(label_x, y - size / 2 - 4, sym)
        c.setFont("Helvetica", 10)
        c.drawString(label_x + 45, y - size / 2 - 4, desc)
        y -= size + 8

    y -= 10
    set_gray(c, fill=INK)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(MARGIN, y, "How to use this notebook")
    y -= 16
    c.setFont("Helvetica", 10)
    notes = [
        "Floor pages: each shows the current room. Circle or cross out what isn't working,",
        "draw arrows for a new path, add walls/pieces in the margin, or just jot ideas on the lines.",
        "Blank pages: sketch a brand-new room using the same symbols. Print as many as you like.",
        "To bring a design back into the game, transcribe it as a row-by-row text map — see",
        "echo-tower/DEVELOPMENT.md → “Map legend” for the exact character reference.",
    ]
    for line in notes:
        c.drawString(MARGIN, y, line)
        y -= 14

    footer(c, "Legend")


def draw_level_page(c, index, level):
    n = index + 1
    header(c, f"Floor {n} · {level['name']}", f"Introduces: {level['hint']}")

    rows = level["map"]
    cols = max(len(r) for r in rows)
    nrows = len(rows)

    # Every level page uses the same cell size (the one that fits the
    # largest level) so room sizes stay visually comparable page to page.
    grid_x = MARGIN + (PAGE_W - 2 * MARGIN - GLOBAL_CELL * cols) / 2
    grid_top = PAGE_H - MARGIN - 46

    gw, gh = draw_grid(c, grid_x, grid_top, cols, nrows, GLOBAL_CELL, map_rows=rows)

    # Fill the rest of the page with note lines — smaller rooms leave more
    # room to write, which is the point.
    notes_top = grid_top - gh - 22
    bottom = MARGIN + 14
    n_lines = max(4, int((notes_top - 12 - bottom) / LINE_GAP))
    ruled_lines(c, MARGIN, notes_top, PAGE_W - 2 * MARGIN, n_lines, gap=LINE_GAP,
                label="Notes / changes")

    footer(c, f"Floor {n} of {len(LEVELS)}")


def draw_blank_template_page(c, page_label):
    header(c, "Echo Tower — Blank Level", "Design a new room. Symbol key on the legend page.")

    cols, nrows = MAX_COLS, MAX_ROWS
    grid_x = MARGIN + (PAGE_W - 2 * MARGIN - GLOBAL_CELL * cols) / 2
    grid_top = PAGE_H - MARGIN - 46

    gw, gh = draw_grid(c, grid_x, grid_top, cols, nrows, GLOBAL_CELL, map_rows=None, coords=True)

    notes_top = grid_top - gh - 22
    y = notes_top
    set_gray(c, fill=INK_SOFT)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(MARGIN, y, "Floor name")
    c.setFont("Helvetica-Bold", 9)
    c.drawString(PAGE_W / 2, y, "Idea / new challenge introduced")
    y -= 4
    set_gray(c, stroke=FAINT)
    c.setLineWidth(0.5)
    c.line(MARGIN, y - 10, PAGE_W / 2 - 8, y - 10)
    c.line(PAGE_W / 2, y - 10, PAGE_W - MARGIN, y - 10)

    ruled_lines(c, MARGIN, y - 24, PAGE_W - 2 * MARGIN, 4, gap=17, label="Notes")

    footer(c, page_label)


def build(output_path, blank_pages=3):
    c = canvas.Canvas(output_path, pagesize=A4)
    c.setTitle("Echo Tower — Level Design Notebook")
    c.setAuthor("Echo Tower")
    c.setSubject("Grayscale printable level annotation and design sheets")

    draw_legend_page(c)
    c.showPage()

    for i, level in enumerate(LEVELS):
        draw_level_page(c, i, level)
        c.showPage()

    for i in range(blank_pages):
        draw_blank_template_page(c, f"Blank template ({i + 1} of {blank_pages}) — print extra copies as needed")
        c.showPage()

    c.save()


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "echo-tower-level-notebook.pdf"
    build(out)
    print(f"wrote {out}")
