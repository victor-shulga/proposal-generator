# Proposal Generator — B2B Global

A Claude Code plugin that turns a client's brand into **two sales proposals** and deploys them
to Netlify. Reusable across every B2B Global client. Sibling of
[design-system-generator](https://github.com/victor-shulga/design-system-generator) — the
design system feeds the brand, this builds the proposals on top of it.

First reference build: **Karno Energy** — https://karno-proposals.netlify.app

---

## Two variants, split by how the proposal reaches the buyer

| | When to use | Format |
|---|---|---|
| **A · Call deck** | The client **presents it** — discovery / intro / screen-share | Scroll-snap slide deck, arrow-key nav |
| **B · Send proposal** | It **travels alone** — email, follow-up, forwarded | Self-contained scrolling document |

**Variant A** follows Viktor Shulga's high-ticket proposal framework:
**Why-us-for-them → Challenge (+ buyer quote) → Alternatives (not ROI) → Solution →
Pricing (2-3 tiers) → Expected results → How we work → Relevant cases → Next step.**

**Variant B** is the self-contained document:
**Summary → Situation → Approach → Scope → Proof → Why-us → Investment (table) → FAQ → CTA.**

It can also **critique the client's existing quotes first** (the quote-vs-proposal reframe).

## Principles baked in
- No "about us" opener and no ROI-projection slide (correlates with ~27% lower close).
- Always 2-3 pricing options, each with scope + timeline + outcome.
- A **PDF cost-breakdown button** at the pricing so the lead can read the detailed costing.
- **ICP layer = swap 3 blocks** (problem framing / case study / scope-price), not N decks.
- Built on the client's own design system; deal-specific fields are `[bracketed]` placeholders.

## Use
> зроби пропоузал для [client] · proposal for [client] · просмаж ці quotes

The skill confirms inputs (brand, existing quotes, which variants), optionally critiques the
current quotes, builds A + B on the client's brand, previews, and deploys to
`https://<client>-proposals.netlify.app`.

## Install
```bash
cp -R skills/proposal-generator ~/.claude/skills/          # or:
/plugin marketplace add victor-shulga/proposal-generator
/plugin install proposal-generator
```

## Structure
```
.claude-plugin/{plugin.json, marketplace.json}
skills/proposal-generator/
  SKILL.md
  reference/
    call-deck-framework.md       # Viktor's high-ticket framework, slide-by-slide
    send-proposal-structure.md   # self-contained send-document anatomy
    critique-checklist.md        # quote-vs-proposal critique
scripts/validate.sh · .github/workflows/ci.yml
```

## License
MIT © 2026 Victor Shulga / B2B Global
