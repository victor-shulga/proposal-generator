# Proposal tracking

Answers the questions a static PDF never can: did they open it, who else did, did they reach the
price, and when is the right moment to follow up. Built for the SEND proposal (it travels alone);
add it to the call deck too when the deck is left behind after the call.

## Pieces

| Piece | Where | What it does |
|---|---|---|
| Worker + D1 | `tracker/` in the plugin repo | stores beacons, decides alerts, pings Telegram, optionally raises a CRM signal |
| `scripts/track.js` | pasted inline into the proposal | open, seconds per slide, button clicks; no cookies, no third-party script |
| `scripts/proposal-track.py` | CLI | register a proposal, print per-recipient links, print the snippet, read the report |
| Dashboard | `tracker/public/index.html`, served at the Worker root `/` | the same as the CLI with a UI: proposals, who read what, seconds per slide, event feed, new proposal form with links and snippet, archive. Asks for `ADMIN_TOKEN` once, keeps it in that browser |

Config lives outside the repo: `~/.config/proposal-tracker/endpoint` (Worker URL) and
`~/.config/proposal-tracker/admin_token` (the Worker's `ADMIN_TOKEN`).

## Per proposal (4 steps)

1. **Mark what matters in the HTML.**
   - Pricing / Investment slide: `<section class="slide" data-track="pricing">`. This name is load-bearing:
     the Worker alerts when a recipient spends 10s+ on it.
   - Other slides worth watching: any `data-track="<name>"` (e.g. `cases`, `faq`), otherwise they show as «слайд N».
   - Every CTA and the PDF cost-breakdown button: `data-track="<label>"` (e.g. `data-track="Book a call"`,
     `data-track="Cost breakdown PDF"`). A click = instant alert.
2. **Register it and get the links** (one link per person, never one shared link):
   ```bash
   scripts/proposal-track.py add <client>-<deal> --url https://<client>-proposals.netlify.app/send-proposal.html \
     --label "<Client> · <deal>" --to "Jane Doe (CEO)" --to "John Roe (CFO)" [--crm <twenty-company-id>]
   ```
   Id: lowercase, digits, dashes. Re-running `add` with a new `--to` adds a person and keeps the old tokens.
3. **Paste the snippet** right before `</body>`:
   ```bash
   scripts/proposal-track.py snippet <client>-<deal>   # 2 <meta> tags for <head> + one inline <script>
   ```
4. **Mute your own browser** before checking the live page: open it once with `?pt=off`
   (`?pt=on` undoes it). The snippet is also silent on `file://`, in headless Chrome (verify-deck, PDF export)
   and when `navigator.webdriver` is set, so Step 6 checks never pollute the numbers.

Send each person their own `?r=<token>` link. The rep (or the client's sales team) sends it, not us.

## What arrives in Telegram

| Alert | Fires when | Read it as |
|---|---|---|
| 👀 first open | first visit on that person's link | it landed, nothing more |
| 🔁 came back | new visit after 6h+ of silence | they are weighing it: follow up today |
| 📨 new device | same link, a device not seen before | forwarded to a colleague: ask who else is involved |
| 💰 reading pricing | pricing slide on screen 10s+ in total | price is being judged: offer the cost breakdown or a call |
| ✅ button | any `data-track` button clicked | act now |

One alert per kind per person per 6h, so a long read does not flood the chat.

## CRM signal (optional)

If the proposal was registered with `--crm <company-id>` and the Worker has `TWENTY_URL` + `TWENTY_KEY`,
the first intent alert (came back, forwarded, pricing, button; not a bare first open) creates one signal
`signalCode=F12`, weight 5, `expiresAt` +14 days, status NEW. Only one open F12 per account at a time.

## Report

```bash
scripts/proposal-track.py report <id>   # per person: visits, devices, total read time, top slides, clicks, who never opened
scripts/proposal-track.py list
```

Use the report as input for `reply-objection-handler` (lost-proposal or ghost follow-up): the slide they
re-read is the objection to answer.

## Honesty rules

- Time is counted only while a slide is ≥50% on screen AND the tab is visible. A tab left open in the
  background counts zero.
- «New device» can be the same person on their phone. Say «схоже, переслали», never «переслали».
- Corporate mail scanners do not run JavaScript, so they do not create fake opens. Link previews in
  Slack/LinkedIn do not either.
- No open ≠ not read: a PDF export or a screenshot shared internally is invisible here.

## Setting up the Worker (once)

```bash
cd tracker
cp wrangler.example.jsonc wrangler.jsonc          # wrangler.jsonc is gitignored
npx wrangler d1 create proposal-track             # put the id into wrangler.jsonc
npx wrangler d1 execute proposal-track --remote --file=schema.sql
npx wrangler secret put ADMIN_TOKEN               # same value as ~/.config/proposal-tracker/admin_token
npx wrangler secret put TELEGRAM_BOT_TOKEN        # optional
npx wrangler secret put TELEGRAM_CHAT_ID          # optional
npx wrangler secret put TWENTY_KEY                # optional, with TWENTY_URL in vars
./deploy.sh                                      # copies scripts/track.js to public/t.js, then wrangler deploy
```

Local UI check without the live token: `.dev.vars` with `ADMIN_TOKEN=<test value>`, `npx wrangler d1 execute <db> --local --file=schema.sql`,
`npx wrangler dev`, seed with POSTs to `/admin/proposals` and `/e`. Archive instead of delete: `POST /admin/archive {id}`.
