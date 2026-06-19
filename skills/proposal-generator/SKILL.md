---
name: proposal-generator
description: >
  Generates two client-ready sales proposals as single-file HTML — built on the client's
  own brand/design system — and deploys them to Netlify. Variant A = CALL DECK (the client
  presents it on a call: a scroll-snap slide deck following Viktor Shulga's high-ticket
  proposal framework). Variant B = SEND PROPOSAL (a self-contained document that sells
  without a human). Optionally first CRITIQUES the client's existing quotes/proposals
  (quote-vs-proposal reframe). Reusable across ALL B2B Global clients — first reference
  build was Karno Energy. Trigger when Viktor says: "зроби пропоузал для [client]",
  "proposal for [client]", "пропоузал-генератор", "два варіанти пропоузала (дзвінок / надсилання)",
  "просмаж пропоузали / quotes", "build a proposal", or pastes a client's existing quotes
  and asks to turn them into proposals. NOT for the design system itself (that is the
  separate design-system-generator) and NOT for cold-email/LinkedIn sequences.
---

# Proposal Generator

Turns a client's brand into two proposals that do two different jobs, split by **how the
proposal reaches the buyer**. Reusable for every B2B Global client. Gold-standard reference
build: **Karno Energy** — `~/Desktop/B2B Global/karno-proposals/` and live at
https://karno-proposals.netlify.app (call-deck.html + send-proposal.html + index.html).

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

## Step 3 — Build A · Call deck

Vertical scroll-snap deck, full-viewport slides, arrow-key nav + progress bar + slide
counter. Follow `reference/call-deck-framework.md` exactly (Viktor's order):
**Cover → Why-us-for-THEM (ICP/UseCase/Benefit) → Challenge (+ buyer-quote card) →
Alternatives (NOT ROI) → Solution (the client's signature method) → Pricing (2-3 tiers,
each scope+timeline+outcome) → Expected results (timeline) → How we work (3-4 steps) →
Relevant cases (matched, exact numbers) → Next step.**

## Step 4 — Build B · Send proposal

Scrolling document, sticky top bar with wordmark + CTA, progress bar. Per
`reference/send-proposal-structure.md`: **Cover → Summary → The situation → Our approach →
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

## Step 6 — Preview & deploy

Local: copy to `/tmp/<client>-prop/`, `/tmp/serve_<client>prop.py`, add a `.claude/launch.json`
entry on the next free 460X/461X port (check existing — many are taken). `preview_start` →
resize 1280×860 → `preview_console_logs` (expect none) → screenshot the cover. NOTE: the
preview screenshot tool returns a blank/black frame on programmatically-scrolled far slides
— verify those slides with a **geometry eval** (element rects, overflow check) instead.

Deploy (per [[feedback_share_via_netlify]], [[reference_npm_cache_root_owned]]):
```bash
cd <client>-proposals && export npm_config_cache="$HOME/.npm-claude"
npx --yes netlify-cli deploy --dir . --prod
SID=$(python3 -c "import json;print(json.load(open('.netlify/state.json'))['siteId'])")
npx --yes netlify-cli api updateSite --data "{\"site_id\":\"$SID\",\"body\":{\"name\":\"<client>-proposals\"}}"
```

## Step 7 — Memory

Record the proposal build under the client's project memory: file path, port, Netlify URL,
which variants, and the ICP-swap axis chosen.

---

## Reference files
- `reference/call-deck-framework.md` — Viktor's high-ticket proposal framework, slide-by-slide + principles
- `reference/send-proposal-structure.md` — the self-contained send-document anatomy
- `reference/critique-checklist.md` — the quote-vs-proposal critique used to roast existing proposals
