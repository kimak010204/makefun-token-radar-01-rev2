# Token Radar — rev-2 (model radar-3)

Which pre-token protocol is worth farming next? This entry reads a sealed snapshot of
every protocol DefiLlama tracks, ranks the ones that record no token by what their launch
would be worth, and hands in a web dashboard with the board, a detail view for every
protocol, and the steps to farm each one.

## What the board is

- **198 protocols ranked** — the 40 on the house watchlist, plus 158 early ones below the
  $50M watchlist floor. The watchlist is the floor, never the ceiling: the radar exists to
  find the launches below it.
- **Top launch: Steakhouse Financial, $510.3M implied.** Then Sentora Curator ($483.5M),
  Gauntlet ($306.3M), Veda ($290.3M) and USDD ($152.8M). The top three are Risk Curators
  with the largest pre-token TVL in the snapshot.
- **24 live-token protocols set aside** — they already trade, so the board shows the
  market's own value for them, never a model's. Their market-cap-per-TVL is what
  calibrates every category multiple.

## The model (radar-3)

```
implied = TVL × category multiple × growth × maturity × chains
```

- **Category multiple:** the median of market-cap / TVL over the live tokens of the
  protocol's own category (at least 3 live tokens; fewer, and the global median 0.214 is
  used). Clamped to 0.05–1.5. The median, not the mean: one token with a tiny TVL and a
  huge market cap must not set the multiple for a whole category.
- **Growth:** 1 + clamp(7-day TVL change, −50%, +150%) / 100 × 0.6. Seven days is noisy,
  so its weight is deliberately below one: momentum moves the value, it never decides it.
- **Maturity:** 0.6 + min(age in days, 1095) / 1095 × 0.4. Older and still pre-token
  counts for more; unknown age counts as 365 days.
- **Chains:** 1 + 0.02 × min(chains, 5).

The model is computed at runtime from the snapshot's own figures — TVL, seven-day growth,
age, chains — never from a hand-kept list of names. Every multiple is shown in the
dashboard's calibration table with the live count behind it, so a reader can see exactly
where each number comes from. A category with fewer than 3 live tokens is labelled thin
and falls back to the global median, openly, instead of pretending one token speaks for
the category.

### What the model does not do

It does not predict whether or when a token is issued. A protocol's implied value is
what its token would be worth if its record stayed as it is. A protocol can sit at the
top of this board for years and never launch, and a small one can launch tomorrow — the
board ranks value, not likelihood.

## The dashboard

- **Stats strip:** protocols ranked, pre-token TVL tracked ($20.71B), watchlist covered
  (40/40), top launch.
- **Top-10 chart:** the ten most valuable launches as bars, so the value distribution
  reads at a glance.
- **Board:** sortable by rank, name, TVL, 7-day change, age or implied value; filterable
  by search, category, chain, and watchlist-only; a detail view for every protocol.
- **Early finds:** the strongest launches below the $50M floor, and the fastest growers
  (TVL ≥ $10M) — the launches the watchlist never names.
- **Live tokens tab:** the calibration set, with market cap and market-cap-per-TVL.
- **Model panel:** the formula, the reasoning for each factor, the full calibration
  table, and what the model does not do.
- **Detail view:** why the protocol ranks where it does (TVL rank, which multiple and
  why, growth, age), the full model breakdown with a page-side recompute that must match
  board.json exactly, and an 8-step farm plan with costs and times.

## Farm plans

Eight steps per protocol, derived from its own record (category, chains, TVL, age):

1. A fresh wallet, seed kept offline.
2. The category's main action on its first chain, with capital sized by TVL.
3. A second, different qualifying action for the same category.
4. One qualifying action each week.
5. Check the protocol's own site and docs for a points or rewards program.
6. Hold at least N days (longer for younger protocols).
7. Claim only from the protocol's own published link — never pay to claim.
8. Keep a farm log.

## How to run

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
```

Node 22.18 or later, standard library only. Two runs over the same snapshot write
identical bytes: no clock, no randomness, no network. The program refuses to write a
board the gate would refuse (missing watchlist slugs, a rank out of order, an implied
value that rises with rank, a farm plan outside 3–12 steps or 20–600 characters).

## Files

- `main.ts` — the entrypoint: argument parsing, the gate check, the file copies, the
  dossier, and the run summary.
- `lib/model.ts` — the model, the calibration, the farm plans, the board, and the
  dashboard data.
- `vendor/makefun-board.ts` — the kit's dossier library, copied byte for byte.
- `dashboard/` — the page: `index.html`, `app.css`, `app.js` (no network, no framework).
- `screenshots/` — the board, a protocol's detail view, and a filtered view, all
  rendered from this dashboard at 1440×900.

## Rev-2 changes (vs rev-1, model radar-2)

- **True median** instead of the upper median for category multiples and the global
  fallback — the standard statistic, less inflated by small categories. Top-5 order
  unchanged; values slightly lower (Steakhouse $531.5M → $510.3M).
- **Rank reason:** every row carries one line saying why it ranks where it does
  (TVL rank, which multiple and why, growth, age), shown in the detail view.
- **Stats strip and top-10 chart** on the board, so the value distribution reads at
  a glance.
- **Early finds section:** strongest below the floor, and the fastest growers.
- **Farm plans grew from 6 to 8 steps:** a second category-specific action, and a
  step to check for a points program before farming further.
- **Model panel** now explains why a median, why a fallback, and what the model does
  not do.
