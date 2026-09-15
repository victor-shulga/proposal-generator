# Deck engine — the one canon

There is exactly **one** deck engine. Every new proposal, deck, board review or audit
presentation uses it. The others are legacy and are kept only so old client files still open.

## The canon

**One single-file HTML. The print stylesheet lives in that same file. PDF comes from headless Chrome.**

- One file, no build step, no external JS. Fonts from Google Fonts, everything else inline.
- Every slide is a `<section class="slide">`. The class name is load-bearing — the print
  block and `scripts/verify-deck.sh` both key off it.
- Screen mode is whatever the deck needs (JS `.slide.active` stepper, or CSS scroll-snap).
- Print mode is an `@media print` block **in the same file** — never a second `print.html`.

```css
@media print {
  @page { size: 1600px 900px; margin: 0; }
  html, body { width: 1600px; height: auto; overflow: visible; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .deck { height: auto; }
  .slide {
    display: flex !important;
    position: relative; inset: auto;
    width: 1600px; height: 900px; overflow: hidden;
    page-break-after: always; break-inside: avoid;
  }
  .slide:last-child { page-break-after: auto; }
  .navhint, .progress { display: none !important; }   /* screen-only chrome */
}
```

Match `@page size` to the deck's own canvas (1600×900 here, 1280×720 on the scaled-frame
decks). If the deck uses `transform: scale()` to fit the viewport, add `.frame { transform: none }`
inside `@media print` — otherwise the PDF inherits the screen scale.

## PDF

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --no-sandbox \
  --print-to-pdf="<out>.pdf" --no-pdf-header-footer \
  --virtual-time-budget=10000 --run-all-compositor-stages-before-draw \
  "file:///abs/path/to/deck.html"
```

`--virtual-time-budget` + `--run-all-compositor-stages-before-draw` are mandatory: without
them Cyrillic falls back to a serif face and half the layout is measured pre-webfont.

## Verification — never by eye

```bash
scripts/verify-deck.sh <deck.html> --w 1600 --h 900 --pdf
```

Two deterministic gates:
1. **Overflow probe** — loads the deck in a fixed W×H iframe, forces every `.slide` into the
   print geometry, and measures `scrollHeight/scrollWidth` **only after
   `await document.fonts.ready` + 400ms**. Measuring before the webfonts land gives a false
   0-overflow pass; that is what shipped two "verified" broken decks.
2. **Page count** (`--pdf`) — renders the PDF and asserts pages == slides. A deck with no
   `@media print` block collapses to one page, and this is the check that catches it.

Do not fall back to screenshots for this. The preview screenshot tool returns a blank/black
frame on programmatically-scrolled far slides; screenshots are for the cover, not for proof.

## Known trap

`background-clip: text` gradient headlines render as a **solid filled block** in print.
Override those elements to a flat colour inside `@media print`.

A responsive block written as `@media (max-width: …)` also fires while printing, because
Chrome lays out the print page at the page width (an A4 page is ~794px wide). The mobile
layout then leaks into the PDF: grids collapse to one column and pages multiply. Write
responsive rules as `@media screen and (max-width: …)`.

## Legacy engines — do not start anything new on these

| Engine | Where it still lives | Why it lost |
|---|---|---|
| `deck-stage.js` (74KB third-party web component from npm) + `render-pdf.mjs` (puppeteer) | older audit proposal and board-review decks | third-party runtime + a puppeteer resolved out of a global npm package; PDF breaks when either moves |
| Twin files `index.html` + `print.html` | an early service pitch deck (merged into one file 2026-09-07) | two files to keep in sync by hand; the print copy silently drifts |
| Scroll-snap single-file with no print styles | an early client proposal build | correct file shape, but cannot produce a PDF — and the send-proposal is exactly the artefact that flies into an inbox |
