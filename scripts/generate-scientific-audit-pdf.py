#!/usr/bin/env python3
"""Render the publication-grade Markdown audit as a stable, inspectable PDF."""

from __future__ import annotations

import html
import json
import math
import re
from pathlib import Path

from reportlab.graphics.shapes import Circle, Drawing, Line, Rect, String
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    ListFlowable,
    ListItem,
    PageBreak,
    PageTemplate,
    Paragraph,
    Preformatted,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs" / "scientific-audit-report.md"
OUTPUT = ROOT / "output" / "pdf" / "shriki-2016-publication-grade-audit.pdf"
SCALING = ROOT / "mathematica" / "benchmark-results" / "scaling-summary.json"
CRITICAL = ROOT / "mathematica" / "benchmark-results" / "critical-slowing-142.json"

NAVY = colors.HexColor("#17324D")
BLUE = colors.HexColor("#1E6A8D")
TEAL = colors.HexColor("#2A8C82")
ORANGE = colors.HexColor("#C66A24")
RED = colors.HexColor("#A83A3A")
INK = colors.HexColor("#24313B")
MUTED = colors.HexColor("#60717E")
PALE = colors.HexColor("#EAF1F5")
GRID = colors.HexColor("#CCD8DF")


def ascii_typography(value: str) -> str:
    replacements = {
        "\u2010": "-", "\u2011": "-", "\u2012": "-", "\u2013": "-",
        "\u2014": "-", "\u2212": "-", "\u2018": "'", "\u2019": "'",
        "\u201c": '"', "\u201d": '"', "\u2026": "...", "\u00a0": " ",
    }
    for old, new in replacements.items():
        value = value.replace(old, new)
    return value


def inline_markup(value: str) -> str:
    value = ascii_typography(value.strip())
    placeholders: list[str] = []

    def stash(fragment: str) -> str:
        placeholders.append(fragment)
        return f"@@MARKUP{len(placeholders) - 1}@@"

    def markdown_link(match: re.Match[str]) -> str:
        label, url = match.group(1), match.group(2)
        return stash(f'<link href="{html.escape(url, quote=True)}" color="#1E6A8D">'
                     f'{html.escape(label)}</link>')

    value = re.sub(r"\[([^\]]+)\]\((https?://[^)]+)\)", markdown_link, value)
    code_fragments: list[str] = []

    def inline_code(match: re.Match[str]) -> str:
        code_fragments.append(
            f'<font face="Courier" size="7.6">{html.escape(match.group(1))}</font>')
        return f"@@CODE{len(code_fragments) - 1}@@"

    value = re.sub(r"`([^`]+)`", inline_code, value)
    value = html.escape(value)
    value = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", value)
    value = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<i>\1</i>", value)

    url_pattern = re.compile(r"(?<![\"'=])(https?://[^\s<]+)")

    def raw_link(match: re.Match[str]) -> str:
        url = match.group(1).rstrip(".,;)")
        suffix = match.group(1)[len(url):]
        return (f'<link href="{url}" color="#1E6A8D">{url}</link>' + suffix)

    value = url_pattern.sub(raw_link, value)
    for index, fragment in enumerate(code_fragments):
        value = value.replace(f"@@CODE{index}@@", fragment)
    for index, fragment in enumerate(placeholders):
        value = value.replace(f"@@MARKUP{index}@@", fragment)
    return value


styles = getSampleStyleSheet()
BODY = ParagraphStyle(
    "Body",
    parent=styles["BodyText"],
    fontName="Helvetica",
    fontSize=8.7,
    leading=12.2,
    textColor=INK,
    spaceAfter=5.4,
    alignment=TA_LEFT,
    allowWidows=0,
    allowOrphans=0,
)
H1 = ParagraphStyle(
    "H1", parent=styles["Heading1"], fontName="Helvetica-Bold",
    fontSize=18, leading=21, textColor=NAVY, spaceBefore=12, spaceAfter=8,
)
H2 = ParagraphStyle(
    "H2", parent=styles["Heading2"], fontName="Helvetica-Bold",
    fontSize=13, leading=16, textColor=NAVY, spaceBefore=11, spaceAfter=6,
    keepWithNext=True,
)
H3 = ParagraphStyle(
    "H3", parent=styles["Heading3"], fontName="Helvetica-Bold",
    fontSize=10.2, leading=13, textColor=BLUE, spaceBefore=8, spaceAfter=4,
    keepWithNext=True,
)
CAPTION = ParagraphStyle(
    "Caption", parent=BODY, fontSize=7.4, leading=9.5, textColor=MUTED,
    spaceBefore=2, spaceAfter=7,
)
TABLE_HEADER = ParagraphStyle(
    "TableHeader", parent=BODY, fontName="Helvetica-Bold", fontSize=6.8,
    leading=8.2, textColor=colors.white, spaceAfter=0,
)
TABLE_CELL = ParagraphStyle(
    "TableCell", parent=BODY, fontSize=6.7, leading=8.3, spaceAfter=0,
)
CODE = ParagraphStyle(
    "Code", parent=BODY, fontName="Courier", fontSize=7.6, leading=10,
    leftIndent=8, rightIndent=8, borderColor=GRID, borderWidth=0.5,
    borderPadding=5, backColor=colors.HexColor("#F6F8F9"), spaceBefore=2,
    spaceAfter=7,
)


def header_footer(canvas, doc):
    canvas.saveState()
    width, height = A4
    if doc.page == 1:
        canvas.restoreState()
        return
    canvas.setStrokeColor(GRID)
    canvas.setLineWidth(0.45)
    canvas.line(17 * mm, height - 13 * mm, width - 17 * mm, height - 13 * mm)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 7.2)
    canvas.drawString(17 * mm, height - 10.3 * mm,
                      "Shriki-Sadeh-Ward model: fidelity and scaling audit")
    canvas.drawRightString(width - 17 * mm, 10 * mm, f"Page {doc.page}")
    canvas.drawString(17 * mm, 10 * mm, "Reproducible project audit - 7 September 2026")
    canvas.restoreState()


class AuditDocument(BaseDocTemplate):
    def __init__(self, filename: str):
        super().__init__(
            filename,
            pagesize=A4,
            leftMargin=17 * mm,
            rightMargin=17 * mm,
            topMargin=17 * mm,
            bottomMargin=16 * mm,
            title="Publication-grade fidelity and scaling audit of the Shriki-Sadeh-Ward neural synaesthesia model",
            author="Not-a-test reproducibility project",
            subject="Independent Wolfram reconstruction and 2026 exact-model scaling audit",
        )
        frame = Frame(self.leftMargin, self.bottomMargin, self.width, self.height,
                      id="main", leftPadding=0, rightPadding=0,
                      topPadding=0, bottomPadding=0)
        self.addPageTemplates(PageTemplate(id="audit", frames=[frame],
                                           onPage=header_footer))


def axis_label(drawing: Drawing, x: float, y: float, label: str,
               anchor: str = "middle", size: float = 7.2, color=MUTED):
    drawing.add(String(x, y, label, fontName="Helvetica", fontSize=size,
                       textAnchor=anchor, fillColor=color))


def scaling_chart() -> KeepTogether:
    summary = json.loads(SCALING.read_text())
    rows = [row for row in summary["currentRequestedLadder"]
            if row["trainingHorizonClass"] == "uniform-ten-update-window"]
    width, height = 470, 205
    left, right, bottom, top = 52, 15, 34, 18
    plot_w, plot_h = width - left - right, height - bottom - top
    x_values = [math.log2(row["totalNeurons"]) for row in rows]
    y_values = [math.log10(row["trainingSecondsPerStep"]) for row in rows]
    x_min, x_max = min(x_values), max(x_values)
    y_min, y_max = -0.8, 0.9
    sx = lambda value: left + (value - x_min) / (x_max - x_min) * plot_w
    sy = lambda value: bottom + (value - y_min) / (y_max - y_min) * plot_h
    drawing = Drawing(width, height)
    drawing.add(Rect(0, 0, width, height, fillColor=colors.white,
                     strokeColor=GRID, strokeWidth=0.6, rx=3, ry=3))
    for tick in [-0.5, 0, 0.5]:
        y = sy(tick)
        drawing.add(Line(left, y, width - right, y, strokeColor=GRID,
                         strokeWidth=0.45))
        axis_label(drawing, left - 7, y - 2.5, f"{10 ** tick:.2f}", "end")
    drawing.add(Line(left, bottom, left, height - top, strokeColor=NAVY,
                     strokeWidth=0.8))
    drawing.add(Line(left, bottom, width - right, bottom, strokeColor=NAVY,
                     strokeWidth=0.8))
    points = [(sx(x), sy(y)) for x, y in zip(x_values, y_values)]
    for first, second in zip(points, points[1:]):
        drawing.add(Line(first[0], first[1], second[0], second[1],
                         strokeColor=BLUE, strokeWidth=2.0))
    for (x, y), row in zip(points, rows):
        drawing.add(Circle(x, y, 3.2, fillColor=TEAL, strokeColor=colors.white,
                           strokeWidth=0.8))
        axis_label(drawing, x, bottom - 13, f"{row['totalNeurons']:,}")
    axis_label(drawing, left + plot_w / 2, 9, "Output neurons M", size=8)
    axis_label(drawing, 5, bottom + plot_h / 2,
               "seconds/update (log scale)", "start", size=7)
    axis_label(drawing, left, height - 11,
               "Uniform ten-update window", "start", 8.4, NAVY)
    caption = Paragraph(
        "Figure 1. Current source-qualified factor-history measurements. "
        "The fitted log-log slope is 0.991 over this fixed rank-50 window; "
        "it is not a long-horizon complexity estimate.", CAPTION)
    return KeepTogether([drawing, caption])


def critical_chart() -> KeepTogether:
    report = json.loads(CRITICAL.read_text())
    rows = report["results"]
    width, height = 470, 205
    left, right, bottom, top = 52, 15, 34, 18
    plot_w, plot_h = width - left - right, height - bottom - top
    x_values = [-math.log10(1 - row["rho"]) for row in rows]
    y_values = [math.log10(row["policySettledGradientRelativeFrobeniusErrorVsExact"])
                for row in rows]
    x_min, x_max = 1, 4
    y_min, y_max = -7, 0
    sx = lambda value: left + (value - x_min) / (x_max - x_min) * plot_w
    sy = lambda value: bottom + (value - y_min) / (y_max - y_min) * plot_h
    drawing = Drawing(width, height)
    drawing.add(Rect(0, 0, width, height, fillColor=colors.white,
                     strokeColor=GRID, strokeWidth=0.6, rx=3, ry=3))
    for tick in [-6, -4, -2, 0]:
        y = sy(tick)
        drawing.add(Line(left, y, width - right, y, strokeColor=GRID,
                         strokeWidth=0.45))
        axis_label(drawing, left - 7, y - 2.5, f"1e{tick}", "end")
    for tick in [1, 2, 3, 4]:
        x = sx(tick)
        axis_label(drawing, x, bottom - 13, f"1e-{tick}")
    drawing.add(Line(left, bottom, left, height - top, strokeColor=NAVY,
                     strokeWidth=0.8))
    drawing.add(Line(left, bottom, width - right, bottom, strokeColor=NAVY,
                     strokeWidth=0.8))
    points = [(sx(x), sy(y)) for x, y in zip(x_values, y_values)]
    for first, second in zip(points, points[1:]):
        drawing.add(Line(first[0], first[1], second[0], second[1],
                         strokeColor=ORANGE, strokeWidth=2.0))
    for (x, y), row in zip(points, rows):
        color = RED if row["rho"] >= 0.9999 else ORANGE
        drawing.add(Circle(x, y, 3.2, fillColor=color, strokeColor=colors.white,
                           strokeWidth=0.8))
    axis_label(drawing, left + plot_w / 2, 9,
               "Distance to criticality (1-rho, log scale)", size=8)
    axis_label(drawing, 4, bottom + plot_h / 2,
               "gradient relative error", "start", size=7)
    axis_label(drawing, left, height - 11,
               "Tolerance-settled gradient error", "start", 8.4, NAVY)
    caption = Paragraph(
        "Figure 2. A residual near 1e-9 does not control gradient error as "
        "the fixed-point operator approaches singularity. At rho=0.9999 the "
        "relative Frobenius error is 0.62176.", CAPTION)
    return KeepTogether([drawing, caption])


def table_from_lines(lines: list[str]) -> Table:
    rows: list[list[str]] = []
    for line in lines:
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if all(re.fullmatch(r":?-{3,}:?", cell) for cell in cells):
            continue
        rows.append(cells)
    columns = max(len(row) for row in rows)
    rows = [row + [""] * (columns - len(row)) for row in rows]
    rendered = []
    for row_index, row in enumerate(rows):
        style = TABLE_HEADER if row_index == 0 else TABLE_CELL
        rendered.append([Paragraph(inline_markup(cell), style) for cell in row])
    available = A4[0] - 34 * mm
    if columns == 2:
        widths = [available * 0.38, available * 0.62]
    elif columns == 3:
        widths = [available * 0.23, available * 0.39, available * 0.38]
    else:
        widths = [available / columns] * columns
    table = Table(rendered, colWidths=widths, repeatRows=1, hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.35, GRID),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 3.2),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3.2),
        ("TOPPADDING", (0, 0), (-1, -1), 3.2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.2),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1),
         [colors.white, colors.HexColor("#F4F7F9")]),
    ]))
    return table


def cover_story(lines: list[str]) -> tuple[list, int]:
    title = ascii_typography(lines[0][2:].strip())
    subtitle = ascii_typography(lines[2].strip())
    meta = [ascii_typography(line.rstrip("  ")) for line in lines[4:7]]
    story = [Spacer(1, 28 * mm)]
    story.append(Paragraph(title, ParagraphStyle(
        "CoverTitle", parent=H1, fontSize=25, leading=29, alignment=TA_LEFT,
        textColor=NAVY, spaceAfter=12)))
    story.append(RectangleFlowable())
    story.append(Spacer(1, 8 * mm))
    story.append(Paragraph(subtitle, ParagraphStyle(
        "CoverSubtitle", parent=BODY, fontSize=13, leading=18,
        textColor=BLUE, spaceAfter=15)))
    for line in meta:
        story.append(Paragraph(inline_markup(line), ParagraphStyle(
            "CoverMeta", parent=BODY, fontSize=9.2, leading=13, textColor=MUTED)))
    story.extend([
        Spacer(1, 25 * mm),
        Paragraph("SCIENTIFIC AUDIT", ParagraphStyle(
            "CoverTag", parent=BODY, fontName="Helvetica-Bold", fontSize=9,
            leading=11, textColor=colors.white, backColor=TEAL,
            borderPadding=(5, 9, 5, 9), alignment=TA_CENTER)),
        Spacer(1, 9 * mm),
        Paragraph(
            "Publication claims, reconstruction choices, and project extensions "
            "are kept separate throughout. All numerical claims trace to "
            "source-fingerprinted JSON records.",
            ParagraphStyle("CoverNote", parent=BODY, fontSize=10, leading=14,
                           textColor=INK)),
        PageBreak(),
    ])
    return story, 7


class RectangleFlowable(Spacer):
    def __init__(self):
        super().__init__(1, 3)

    def draw(self):
        self.canv.setFillColor(TEAL)
        self.canv.rect(0, 0, A4[0] - 34 * mm, 3, fill=1, stroke=0)


def parse_markdown() -> list:
    lines = SOURCE.read_text(encoding="utf-8").splitlines()
    story, index = cover_story(lines)
    pending: list[str] = []

    def flush_paragraph():
        nonlocal pending
        if pending:
            story.append(Paragraph(inline_markup(" ".join(item.strip() for item in pending)),
                                   BODY))
            pending = []

    while index < len(lines):
        line = lines[index]
        if not line.strip():
            flush_paragraph()
            index += 1
            continue
        if line.startswith("## "):
            flush_paragraph()
            title = line[3:].strip()
            story.append(Paragraph(inline_markup(title), H2))
            if title.startswith("6.2 "):
                story.append(scaling_chart())
            if title.startswith("6.5 "):
                story.append(critical_chart())
            index += 1
            continue
        if line.startswith("### "):
            flush_paragraph()
            title = line[4:].strip()
            story.append(Paragraph(inline_markup(title), H3))
            if title.startswith("6.2 "):
                story.append(scaling_chart())
            if title.startswith("6.5 "):
                story.append(critical_chart())
            index += 1
            continue
        if line.startswith("|"):
            flush_paragraph()
            table_lines = []
            while index < len(lines) and lines[index].startswith("|"):
                table_lines.append(lines[index])
                index += 1
            story.append(table_from_lines(table_lines))
            story.append(Spacer(1, 6))
            continue
        if line.startswith("    "):
            flush_paragraph()
            code_lines = []
            while index < len(lines) and (lines[index].startswith("    ") or
                                          not lines[index].strip()):
                code_lines.append(ascii_typography(lines[index][4:])
                                  if lines[index].startswith("    ") else "")
                index += 1
            story.append(Preformatted("\n".join(code_lines).rstrip(), CODE))
            continue
        if re.match(r"^[-*] ", line):
            flush_paragraph()
            items = []
            while index < len(lines) and re.match(r"^[-*] ", lines[index]):
                items.append(ListItem(Paragraph(
                    inline_markup(lines[index][2:].strip()), BODY),
                    leftIndent=10, bulletColor=TEAL))
                index += 1
            story.append(ListFlowable(items, bulletType="bullet", start="circle",
                                      leftIndent=16, bulletFontSize=6, spaceAfter=5))
            continue
        if re.match(r"^\d+\. ", line):
            flush_paragraph()
            items = []
            while index < len(lines) and re.match(r"^\d+\. ", lines[index]):
                text = re.sub(r"^\d+\. ", "", lines[index])
                items.append(ListItem(Paragraph(inline_markup(text), BODY),
                                      leftIndent=12))
                index += 1
            story.append(ListFlowable(items, bulletType="1", leftIndent=18,
                                      bulletFontName="Helvetica-Bold", spaceAfter=5))
            continue
        pending.append(line)
        index += 1
    flush_paragraph()
    return story


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    document = AuditDocument(str(OUTPUT))
    document.build(parse_markdown())
    print(json.dumps({"output": str(OUTPUT), "bytes": OUTPUT.stat().st_size}))


if __name__ == "__main__":
    main()
