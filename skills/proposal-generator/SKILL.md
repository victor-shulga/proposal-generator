---
name: proposal-generator
description: >
  Generates two client-ready sales proposals as single-file HTML — built on the client's
  own brand/design system — and deploys them to Netlify. Variant A = CALL DECK (the client
  presents it on a call: a scroll-snap slide deck following Viktor Shulga's high-ticket
  proposal framework). Variant B = SEND PROPOSAL (a self-contained document that sells
  without a human). Optionally first CRITIQUES the client's existing quotes/proposals
  (quote-vs-proposal reframe). Reusable across ALL of Viktor's clients. Trigger when Viktor says: "зроби пропоузал для [client]",
  "proposal for [client]", "пропоузал-генератор", "два варіанти пропоузала (дзвінок / надсилання)",
  "просмаж пропоузали / quotes", "build a proposal", or pastes a client's existing quotes
  and asks to turn them into proposals. NOT for the design system itself (that is the
  separate design-system-generator) and NOT for cold-email/LinkedIn sequences.
---

# Proposal Generator

Turns a client's brand into two proposals that do two different jobs, split by **how the
proposal reaches the buyer**. Reusable for every client of Viktor's. A gold-standard reference
build (call-deck.html + send-proposal.html + index.html) lives in the local
workspace under `<client>-proposals/`.

## The two variants (never a send×ICP matrix)

- **A · CALL DECK** (`call-deck.html`) — the client **presents it** (discovery / intro /
  screen-share). A visual aid: big type, light copy, the rep carries the argument. **Built on
  Viktor's high-ticket proposal framework** — see `reference/call-deck-framework.md`.
- **B · SEND PROPOSAL** (`send-proposal.html`) — it **travels alone** (email, follow-up,
  forwarded internally). Self-contained: heavier copy, objections pre-handled, full scope +
  pricing + CTA. Structure in `reference/send-proposal-structure.md`.
- **`index.html`** — a small chooser linking both.

**ICP layer = swap, not multiply.** Don't build N decks per persona. Swap only **3 blocks**
per ICP / work-type: (1) problem framing, (2) case study, (3) scope/pricing. Structure &
design stay fixed.

---

## Step 0 — Inputs & confirm

Gather (ask only what's missing):
1. **Client** + their **brand/design system** — reuse tokens from a system built via
   `design-system-generator` (e.g. `<client>-design-system/index.html`) if it exists; else
   extract colours/fonts from their site first.
2. **Existing quotes/proposals?** If Viktor provides any → run **Step 1 critique** first.
3. **Which variants** — default **both** A + B.

## Step 1 — Critique existing (if provided)

Run `reference/critique-checklist.md`. The core reframe: most firms send a **quote**
(what + how much), not a **proposal** (why you, why us, why now, what's the risk — *then*
what + how much). Diagnose the gaps, state what's worth keeping (real scope/exclusions/
pricing substance plugs straight into the Scope + Pricing sections), then build.

## Step 2 — Pull brand tokens

Take the CSS-variable scale + 3-font system from the client's design system. Both proposals
must look like the same brand as the site — reuse the exact `--ink-*`, accent scale, fonts,
and hero motif (blueprint grid, dot grid, etc.).

## Step 2b — The deck engine (canon, non-negotiable)

**One single-file HTML · `@media print` in that same file · PDF from headless Chrome.**
Full spec, print-block template, Chrome flags and legacy list: `reference/deck-engine.md`.

- Every slide is `<section class="slide">`. The class is load-bearing (print block + checker).
- Never a second `print.html`. Never `deck-stage.js`. Never puppeteer.
- Both variants get the print block — the send proposal is the one that flies into an inbox,
  so it must be able to become a PDF.

## Step 3 — Build A · Call deck

Vertical scroll-snap deck, full-viewport slides, arrow-key nav + progress bar + slide
counter — plus the `@media print` block from `reference/deck-engine.md` in the same file.
Follow `reference/call-deck-framework.md` exactly (Viktor's order):
**Cover → Why-us-for-THEM (ICP/UseCase/Benefit) → Challenge (+ buyer-quote card) →
Alternatives (NOT ROI) → Solution (the client's signature method) → Pricing (2-3 tiers,
each scope+timeline+outcome) → Expected results (timeline) → How we work (3-4 steps) →
Relevant cases (matched, exact numbers) → Next step.**

## Step 4 — Build B · Send proposal

Same canvas as the call deck: every anatomy section is a `<section class="slide">` at
**1600×900**, and the `@media print` block uses `@page { size: 1600px 900px }` from
`reference/deck-engine.md`. Never A4 or another paper size, even when the client's old quote
was a Word/A4 file: the old file is input for content, not a format to copy. On screen the
slides stack vertically under a sticky top bar (wordmark + CTA) and a progress bar; scale them
to the viewport with `zoom` only when the window is narrower than 1600px, and reset it to 1 in
print. The send proposal differs from the deck by density (heavier copy, tables, FAQ), not by
page format. Per `reference/send-proposal-structure.md`: **Cover → Summary → The situation → Our approach →
Scope → Proof (2 cases + quote) → Why [client] → Investment (pricing table) →
FAQ/objections → How we start.**

## Step 5 — Conventions (BOTH variants)

- **Placeholders** the rep fills per deal — bracketed, obvious: `[Contact]`, `[Company]`,
  `[project]`, `[sector]`, `[Date]`, `[Name]`, `[email]`, `[phone]`, and `£X,XXX` figures.
- **Pricing = 2-3 tiers/options**, never one. Each = scope + timeline + outcome. Include a
  lower-involvement entry option for low-trust first projects.
- **PDF cost-breakdown button at the pricing** — a `.doc-btn` ("PDF · See the full cost
  breakdown →") linking `[link-to-cost-breakdown-pdf]`, so the lead can open the detailed
  line-by-line costing in-browser. (PDF, not Excel — opens without download.)
- **No ROI-projection slide** (correlates with −27% close). Use operational outcomes only.
- Per [[feedback_white_background]] the white-BG rule is LinkedIn-only; dark brand sections
  are fine in proposals.

## Step 6 — Verify, then deploy

### 6a · Verify the render — deterministically, not by eye

```bash
scripts/verify-deck.sh <client>-proposals/call-deck.html --w 1600 --h 900 --pdf
scripts/verify-deck.sh <client>-proposals/send-proposal.html --w 1600 --h 900 --pdf
```

Both gates must print `OK`. The script loads the file in a fixed W×H iframe, forces every
`.slide` into the print geometry, and measures overflow **only after
`await document.fonts.ready` + 400ms** — a probe that runs before the webfonts land reports a
false 0-overflow pass. With `--pdf` it also renders the PDF and asserts pages == slides,
which is what catches a missing `@media print` block.

Do **not** substitute a screenshot or a hand-written geometry eval. The preview screenshot
tool returns a blank/black frame on programmatically-scrolled far slides; keep screenshots
for showing Viktor the cover.

Optional visual pass: copy to `/tmp/<client>-prop/`, add a `.claude/launch.json` entry on the
next free 460X/461X port (check existing — many are taken), `preview_start` → resize 1280×860
→ `preview_console_logs` (expect none) → screenshot the cover.

### 6b · Export the PDF

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --no-sandbox \
  --print-to-pdf="<client>-proposal.pdf" --no-pdf-header-footer \
  --virtual-time-budget=10000 --run-all-compositor-stages-before-draw \
  "file:///abs/path/<client>-proposals/send-proposal.html"
```

### 6c · Deploy to Netlify

`netlify-cli` walks UP the directory tree and reuses a parent `.netlify/state.json` — from a
new subfolder it will silently deploy your content over a DIFFERENT live client site. So
**`--site <UUID>` on every single deploy**, and `--site` takes the ID, never the name
(see [[reference_netlify_parent_link_trap]], [[reference_npm_cache_root_owned]],
[[feedback_share_via_netlify]]).

```bash
export npm_config_cache="$HOME/.npm-claude"

# first time only — create the site, then pin its UUID so re-deploys are safe
npx --yes netlify-cli sites:create --name <client>-proposals   # copy the "Project ID" UUID
mkdir -p <client>-proposals/.netlify
printf '{"siteId":"%s"}\n' "$SITE_ID" > <client>-proposals/.netlify/state.json

# every deploy, first one included
npx --yes netlify-cli deploy --prod --dir <client>-proposals --site "$SITE_ID"
```

Confirm the deploy log's Production URL is `<client>-proposals.netlify.app` and not some
other client's site. If it is not, you just clobbered them — redeploy the victim's real
source folder to its own siteId immediately.

## Step 7 — Memory

Record the proposal build under the client's project memory: file path, port, Netlify URL,
which variants, and the ICP-swap axis chosen.

---

## Reference files
- `reference/deck-engine.md` — **the canonical deck engine**: single-file HTML, in-file `@media print`, headless-Chrome PDF, the verification gates, and the legacy engines not to start from
- `scripts/verify-deck.sh` — the deterministic render check used in Step 6a
- `reference/call-deck-framework.md` — Viktor's high-ticket proposal framework, slide-by-slide + principles
- `reference/send-proposal-structure.md` — the self-contained send-document anatomy
- `reference/critique-checklist.md` — the quote-vs-proposal critique used to roast existing proposals
