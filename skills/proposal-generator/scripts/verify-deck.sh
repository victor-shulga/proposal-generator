#!/usr/bin/env bash
# verify-deck.sh — deterministic render check for a canonical single-file HTML deck.
#
#   ./verify-deck.sh <deck.html> [--w 1600] [--h 900] [--pdf]
#
# Stage 1 (always): overflow probe. Loads the deck in a fixed W×H iframe, forces every
#   .slide into the same geometry the @media print block uses, and measures overflow
#   ONLY AFTER `await document.fonts.ready` + 400ms — webfont metrics differ from the
#   fallback, and measuring early gives a false 0-overflow pass.
# Stage 2 (--pdf): renders the PDF with headless Chrome and asserts the page count
#   equals the slide count (a missing @media print block collapses the deck to 1 page).
#
# Exit 0 = clean. Exit 1 = overflow, page error, or page-count mismatch.

set -uo pipefail

CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
DECK=""; W=1600; H=900; DO_PDF=0

while [ $# -gt 0 ]; do
  case "$1" in
    --w) W="$2"; shift 2 ;;
    --h) H="$2"; shift 2 ;;
    --pdf) DO_PDF=1; shift ;;
    -*) echo "unknown flag: $1" >&2; exit 2 ;;
    *) DECK="$1"; shift ;;
  esac
done

[ -n "$DECK" ] || { echo "usage: verify-deck.sh <deck.html> [--w N] [--h N] [--pdf]" >&2; exit 2; }
[ -f "$DECK" ] || { echo "no such file: $DECK" >&2; exit 2; }
[ -x "$CHROME" ] || { echo "Chrome not found at: $CHROME (override with CHROME=...)" >&2; exit 2; }

DECK_ABS="$(cd "$(dirname "$DECK")" && pwd)/$(basename "$DECK")"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

DECK_URL="file://$(python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1]))' "$DECK_ABS")"

cat > "$TMP/probe.html" <<PROBE
<!DOCTYPE html><meta charset="utf-8">
<style>html,body{margin:0}iframe{width:${W}px;height:${H}px;border:0}</style>
<iframe id="f" src="${DECK_URL}"></iframe>
<pre id="R">PENDING</pre>
<script>
const W=${W}, H=${H};
const out = r => document.getElementById('R').textContent = JSON.stringify(r);
const errs = [];
(async () => {
  try {
    const f = document.getElementById('f');
    await new Promise(r => f.addEventListener('load', r, {once:true}));
    const w = f.contentWindow, d = f.contentDocument;
    if (!d) return out({error:'cross-origin iframe — run Chrome with --allow-file-access-from-files'});
    w.addEventListener('error', e => errs.push(String(e.message)));
    if (d.fonts && d.fonts.ready) await d.fonts.ready;
    await new Promise(r => setTimeout(r, 400));
    const slides = [...d.querySelectorAll('.slide')];
    // force the print geometry: every slide laid out in its own W×H page box
    for (const s of slides) {
      s.style.setProperty('display','flex','important');
      s.style.position='relative'; s.style.inset='auto';
      s.style.width=W+'px'; s.style.height=H+'px'; s.style.overflow='visible';
    }
    d.documentElement.style.overflow='visible';
    if (d.body) { d.body.style.height='auto'; d.body.style.overflow='visible'; }
    void d.body.offsetHeight;
    await new Promise(r => setTimeout(r, 100));
    const over = slides.map((s,i) => ({
      n: i+1,
      y: s.scrollHeight - H,
      x: s.scrollWidth  - W,
    })).filter(o => o.y > 1 || o.x > 1);
    out({slides: slides.length, overflow: over, errors: errs.slice(0,5)});
  } catch (e) { out({error: String(e)}); }
})();
</script>
PROBE

DOM="$("$CHROME" --headless --disable-gpu --no-sandbox --hide-scrollbars \
  --allow-file-access-from-files \
  --window-size="$((W+40)),$((H+200))" \
  --virtual-time-budget=10000 --run-all-compositor-stages-before-draw \
  --dump-dom "file://$TMP/probe.html" 2>/dev/null)"

RESULT="$(printf '%s' "$DOM" | python3 -c '
import sys, re, html
m = re.search(r"<pre id=\"R\">(.*?)</pre>", sys.stdin.read(), re.S)
print(html.unescape(m.group(1)) if m else "{\"error\":\"probe did not report\"}")
')"

RC=0
python3 - "$RESULT" "$W" "$H" <<'PY' || RC=1
import sys, json
try:
    r = json.loads(sys.argv[1])
except Exception:
    print("FAIL  probe returned no JSON:", sys.argv[1][:200]); sys.exit(1)
W, H = sys.argv[2], sys.argv[3]
if r.get("error"):
    print("FAIL ", r["error"]); sys.exit(1)
if r.get("slides", 0) == 0:
    print("FAIL  no .slide elements found — canonical decks mark every slide `.slide`"); sys.exit(1)
bad = False
for o in r.get("overflow", []):
    print(f"FAIL  slide {o['n']} overflows {W}x{H}: +{o['y']}px vertical, +{o['x']}px horizontal")
    bad = True
for e in r.get("errors", []):
    print("FAIL  page error:", e); bad = True
if bad: sys.exit(1)
print(f"OK    {r['slides']} slides, no overflow at {W}x{H}, no page errors")
PY

if [ "$DO_PDF" = "1" ]; then
  SLIDES="$(printf '%s' "$RESULT" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("slides",0))')"
  "$CHROME" --headless --disable-gpu --no-sandbox \
    --print-to-pdf="$TMP/out.pdf" --no-pdf-header-footer \
    --virtual-time-budget=10000 --run-all-compositor-stages-before-draw \
    "$DECK_URL" >/dev/null 2>&1
  if [ ! -s "$TMP/out.pdf" ]; then
    echo "FAIL  PDF was not produced"; RC=1
  else
    PAGES="$(grep -a -c '/MediaBox' "$TMP/out.pdf" || true)"
    if [ "$PAGES" != "$SLIDES" ]; then
      echo "FAIL  PDF has $PAGES page(s) but the deck has $SLIDES slide(s) — check the @media print block"
      RC=1
    else
      echo "OK    PDF renders $PAGES pages, one per slide"
    fi
  fi
fi

exit $RC
