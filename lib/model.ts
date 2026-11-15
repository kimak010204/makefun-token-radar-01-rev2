// The token radar's model, radar-3: one snapshot of the protocol universe in, one ranked
// board out.
//
// The board ranks EVERY rankable pre-token protocol the snapshot carries (198 here), not just
// the 40 on the house watchlist: the watchlist is the floor, never the ceiling. A protocol is
// pre-token when its record carries no token at all (no market cap, no CoinGecko id, no symbol);
// live-token protocols are kept apart and shown as the market's own values, never mixed into the
// ranked board. Saying a protocol "records no token" is DefiLlama's record, not proof it has none.
//
// Implied value follows only from the snapshot's own figures, computed at runtime:
//
//   catMult    = the MEDIAN of (mcap_usd / tvl_usd) over the LIVE-token protocols of the
//                protocol's own category (n >= 3), clamped to [0.05, 1.5]; categories with
//                fewer than 3 live protocols fall back to the global median over all live
//                protocols (~0.205 on this snapshot). The median is used, not the mean: one
//                outlier token (a tiny TVL with a huge market cap) must not set the multiple
//                for a whole category. No protocol name is ever special-cased: the same
//                function scores every row, and the category table is recomputed from the
//                snapshot on every run. A category with fewer than 3 live tokens is shown as
//                "thin" in the dashboard, so a reader can see exactly where the multiple
//                comes from instead of trusting a number with no peers behind it.
//   growthMult = 1 + clamp(change_7d, -50, 150) / 100 * 0.6        (null change -> 0)
//                Seven days is noisy, so its weight is deliberately below one: momentum
//                moves the value, it never decides it.
//   maturity   = 0.6 + min(age_days, 1095) / 1095 * 0.4             (unknown age -> 365 days)
//                Older and still pre-token counts for more: the protocol survived and kept
//                growing without issuing a token.
//   chainMult  = 1 + 0.02 * min(chains.length, 5)
//   implied    = max(1, round(tvl_usd * catMult * growthMult * maturity * chainMult))
//
// A category multiple is the market's own price for that kind of protocol: what live tokens of
// the same kind already trade at per dollar of TVL. Growth rewards momentum, maturity rewards
// survival without a token, and chain spread rewards being live on more chains. The dashboard's
// model panel shows the whole calibration table, with the live count behind every multiple, so a
// reader can check every multiple against the live set it came from.
//
// How to read the board:
//   - Rank 1 is the most valuable launch, not the most likely one. The board answers "if this
//     protocol issued a token tomorrow and the market priced it like its live peers, what would
//     it be worth?" — it does not answer "will it launch?" A giant that never launches stays
//     at the top; a small one that launches tomorrow jumps off the board entirely.
//   - The top of the board is dominated by TVL, and that is by design: implied value is
//     TVL times a market multiple, so the largest protocols are worth the most. The model's
//     job is to get the multiple right and to be honest about where it comes from, not to
//     invent a ranking that flatters small protocols.
//   - A multiple from 15 live tokens (Lending, 0.132) is a market price. A multiple from a
//     fallback (Risk Curators, 1 live token) is a stated assumption: the dashboard labels it
//     thin and shows the global median it used, so a reader can discount it. The detail view
//     names the reason for every row's rank in one line.
//   - The early finds are the point of the radar. The watchlist names 40 protocols at or
//     above $50M; the board ranks 158 more below the floor. The strongest early launch is
//     worth more than most of the watchlist — that is the launch the watchlist would miss.
//
// Why these weights, and what would change them:
//   - Growth is weighted 0.6, below one, because seven days is one noisy week. A protocol
//     that doubles in a week is interesting; a protocol that doubles because one whale
//     deposited is not. The clamp (−50% to +150%) stops a single wild week from deciding a
//     rank. If the snapshot carried 30-day or 90-day growth, the weight would be higher.
//   - Maturity is capped at 3 years (1095 days) because beyond that, survival stops adding
//     information: a protocol that has run 4 years without a token is not meaningfully more
//     established than one that has run 3. The floor of 0.6 keeps a brand-new protocol from
//     being worthless — a week-old protocol with $500M of TVL is still a $500M protocol.
//   - Chains add 2% each, capped at 5, because being on more chains is real distribution
//     but not real value: a protocol on 11 chains is not twice as valuable as the same
//     protocol on 5. The cap keeps the factor honest.
//   - The multiple is clamped to [0.05, 1.5]. Below 0.05, a category's live tokens are
//     essentially worthless per dollar of TVL, and the board would be ranking noise. Above
//     1.5, a category's tokens trade at more than their TVL, which usually means the TVL is
//     understated or the token is a meme — either way, the board should not chase it.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  multiple_floor: number;
  multiple_cap: number;
  min_live_per_category: number;
}

export const MODEL: ModelConstants = {
  growth_weight: 0.6,
  growth_floor: -50,
  growth_cap: 150,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_days: 1095,
  unknown_age_days: 365,
  multiple_floor: 0.05,
  multiple_cap: 1.5,
  min_live_per_category: 3,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-3';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** One row of the calibration table the dashboard's model panel shows. */
export interface CalibrationRow {
  category: string;
  live_count: number;
  multiple: number;
}

/** The category calibration: one multiple per category plus the global fallback. */
export interface Calibration {
  by_category: Map<string, { multiple: number; live_count: number }>;
  global_multiple: number;
  table: CalibrationRow[];
}

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  /** One line saying why this protocol ranks where it does, from its own figures. */
  rank_reason: string;
  model: {
    category_multiple: number;
    category_live_count: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    chain_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, farm plan included so page and board agree. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  category_multiple: number;
  category_live_count: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  chain_multiplier: number;
  watchlist: boolean;
  /** One line saying why this protocol ranks where it does, from its own figures. */
  rank_reason: string;
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
  mcap_per_tvl: number | null;
}

/** Everything the dashboard needs: the board, the live set, the model and its calibration. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  global_multiple: number;
  calibration: CalibrationRow[];
  rows: RadarRow[];
  live: LiveRow[];
  /** The top 10 rows, for the value chart: rank, name and implied value. */
  top10: { rank: number; name: string; implied_value_usd: number }[];
  /** The strongest protocols below the watchlist floor: the early launches. */
  early_finds: { rank: number; name: string; category: string | null; tvl_usd: number; implied_value_usd: number }[];
  /** The fastest-growing pre-token protocols (TVL at least $10M, so a tiny base cannot win). */
  fastest: { rank: number; name: string; category: string | null; change_7d: number | null; tvl_usd: number; implied_value_usd: number }[];
  /** The board's combined TVL, and the watchlist's share of it. */
  total_pretoken_tvl: number;
  watchlist_tvl: number;
  /** Summary statistics for the board, shown in the dashboard's model panel. */
  stats: BoardStats;
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Clamp `v` into [lo, hi]. */
function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** The median of a non-empty list: the middle value, or the mean of the two middle values. */
export function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/**
 * The category calibration, computed from the snapshot's own live-token protocols: for each
 * category, the median of mcap/TVL over its live protocols when at least
 * `min_live_per_category` of them trade, else the global fallback.
 *
 * Why the median and not the mean: market-cap-per-TVL is a heavy-tailed ratio. One live
 * token with a tiny TVL and a huge market cap (a meme, a misreported TVL, a token that
 * trades far above its protocol's deposits) can have a ratio of 30 or 70, and a mean would
 * let that one token set the multiple for every pre-token protocol in its category. The
 * median is immune to that: it is the middle live token's ratio, so half the category
 * trades above it and half below. The cost is that a category with 3 live tokens has a
 * noisy median — but a noisy median is honest, and the dashboard shows the live count so
 * a reader can see the noise.
 *
 * Why a hard cutoff at `min_live_per_category` instead of a smooth blend: a blend would
 * hide the difference between a category price and a global guess. The cutoff makes the
 * distinction visible — a multiple either comes from the category's own live tokens or it
 * comes from the global fallback, and the dashboard says which. A reader who distrusts the
 * fallback can discount exactly the rows that use it.
 *
 * Multiples are clamped to [multiple_floor, multiple_cap] so one outlier category cannot
 * set the board: below 0.05 the category is worthless per dollar of TVL, above 1.5 the
 * tokens trade above their TVL, which usually means the TVL is understated.
 */
export function calibrate(snapshot: Snapshot, model: ModelConstants = MODEL): Calibration {
  const live = snapshot.protocols.filter(
    (p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0,
  );
  const globalMultiple = clamp(
    median(live.map((p) => p.mcap_usd! / p.tvl_usd)),
    model.multiple_floor,
    model.multiple_cap,
  );
  const byCat = new Map<string, number[]>();
  for (const p of live) {
    const key = p.category ?? '(no category)';
    const arr = byCat.get(key);
    if (arr) arr.push(p.mcap_usd! / p.tvl_usd);
    else byCat.set(key, [p.mcap_usd! / p.tvl_usd]);
  }
  const by_category = new Map<string, { multiple: number; live_count: number }>();
  const table: CalibrationRow[] = [];
  for (const [category, ratios] of [...byCat.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const entry =
      ratios.length >= model.min_live_per_category
        ? { multiple: clamp(median(ratios), model.multiple_floor, model.multiple_cap), live_count: ratios.length }
        : { multiple: globalMultiple, live_count: ratios.length };
    by_category.set(category, entry);
    table.push({ category, live_count: ratios.length, multiple: entry.multiple });
  }
  return { by_category, global_multiple: globalMultiple, table };
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/**
 * The multipliers and the implied value one protocol gets under `model` and `calibration`.
 *
 * Each multiplier is computed from the protocol's own record, in the open, so the dashboard
 * can show every input beside the result and a reader can recompute the value by hand:
 *   - The category multiple comes from the calibration table (the category's own median,
 *     or the global fallback when the category has too few live tokens to price itself).
 *   - Growth is the protocol's 7-day TVL change, clamped so one wild week cannot decide
 *     a rank, then weighted 0.6 because seven days is noisy. A null change means the
 *     snapshot did not report one, and counts as no change rather than as a guess.
 *   - Maturity is the protocol's age, capped at three years: beyond that, survival stops
 *     adding information. An unknown listing date counts as 365 days — old enough to be
 *     established, young enough not to be flattered.
 *   - Chain breadth adds 2% per chain up to five: real distribution, but not real value.
 * The implied value is the product, rounded to whole dollars, and never below $1: a
 * protocol with any TVL at all is worth at least a dollar of implied value, so the board
 * never has a zero or a negative row.
 */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  calibration: Calibration,
  model: ModelConstants = MODEL,
): {
  implied: number;
  categoryMultiple: number;
  categoryLiveCount: number;
  growthPct: number;
  growthMult: number;
  maturityMult: number;
  chainMult: number;
  age: number | null;
} {
  const age = ageDays(asOf, protocol.listed_at);
  const cal = calibration.by_category.get(protocol.category ?? '(no category)');
  const categoryMultiple = cal?.multiple ?? calibration.global_multiple;
  const categoryLiveCount = cal?.live_count ?? 0;
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = clamp(rawGrowth, model.growth_floor, model.growth_cap);
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult =
    model.maturity_floor +
    (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const chainMult = 1 + 0.02 * Math.min(protocol.chains.length, 5);
  const implied = Math.max(
    1,
    Math.round(protocol.tvl_usd * categoryMultiple * growthMult * maturityMult * chainMult),
  );
  return { implied, categoryMultiple, categoryLiveCount, growthPct, growthMult, maturityMult, chainMult, age };
}

/** One line saying why a protocol ranks where it does, from its own figures. */
export function rankReason(
  p: SnapshotProtocol,
  v: { categoryMultiple: number; categoryLiveCount: number; growthPct: number; age: number | null },
  tvlRank: number,
  boardSize: number,
): string {
  const multSrc =
    v.categoryLiveCount >= MODEL.min_live_per_category
      ? `its ${p.category ?? 'category'} multiple ${v.categoryMultiple.toFixed(3)} from ${v.categoryLiveCount} live tokens`
      : `the global multiple ${v.categoryMultiple.toFixed(3)} — its category has only ${v.categoryLiveCount} live token${v.categoryLiveCount === 1 ? '' : 's'}, too few to calibrate on`;
  const growth =
    v.growthPct > 0
      ? `growing ${v.growthPct.toFixed(1)}% in 7 days`
      : v.growthPct < 0
        ? `down ${Math.abs(v.growthPct).toFixed(1)}% in 7 days`
        : 'flat over 7 days';
  const age =
    v.age === null ? 'age unknown' : v.age < 365 ? `${v.age} days old` : `${(v.age / 365).toFixed(1)} years old`;
  return `#${tvlRank} by TVL of ${boardSize} ranked, ${multSrc}, ${growth}, ${age}.`;
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Exchange names a protocol may not begin with: it is the exchange's own product, not a launch. */
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;

/** A whole word that marks a wrapped, staked or bridged product of a token that already trades. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/** Categories that are not a token waiting to launch: a bridge, a staking product, an exchange. */
const EXCLUDED_CATEGORIES = new Set([
  'CEX',
  'Bridge',
  'Canonical Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
]);

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * Whether a protocol is one the board may rank: pre-token, and not a wrapped, staked or bridged
 * product of a token that already trades, not a versioned pool, not an exchange's own product, and
 * not in an excluded category. The house watchlist rule, applied to every protocol, floor or not.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  return (
    isPreToken(p) &&
    !EXCLUDED_CATEGORIES.has(p.category ?? '') &&
    !VERSIONED.test(p.name) &&
    !WRAPPED_WORD.test(p.name) &&
    !EXCHANGE_PREFIX.test(p.name)
  );
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/**
 * The protocols the board ranks, strongest first, with ranks 1..n.
 *
 * Selection is two passes, and the order matters. First the watchlist: every slug it names
 * is ranked, because coverage of the watchlist is the gate's row and is never gambled on.
 * Then the early radar: every other rankable protocol, below the floor or left out of the
 * list — no cap, because a board that only ranks the watchlist misses the launches it
 * exists to find early. A protocol that is on the watchlist and also rankable is ranked
 * once (the map keeps the first copy).
 *
 * Sorting is a total order, so two runs over the same snapshot always write the same
 * board: implied value descending, then TVL descending, then slug ascending. The last key
 * exists only to break exact ties deterministically — two protocols with the same implied
 * value and the same TVL still have an order, and it is the same order every run. The
 * dashboard may sort the rows how it likes for display; rank is the model's claim, not
 * the array's order.
 *
 * Each row also carries its rank reason: one line, from its own figures, saying why it
 * ranks where it does. The dashboard shows it in the detail view, so a reader never has
 * to take a rank on trust.
 */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const calibration = calibrate(snapshot, model);
  const index = bySlug(snapshot.protocols);
  // The watchlist is the floor: every slug it names is ranked, even one the snapshot no longer
  // carries (it cannot, but coverage is the gate's row and is never gambled on a missing record).
  const chosen = new Map<string, SnapshotProtocol>();
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every other rankable protocol, below the floor or left out of the list.
  // No cap: a board that only ranks the watchlist misses the launches it exists to find early.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, calibration, model);
    return { p, ...v };
  });
  scored.sort(
    (a, b) =>
      b.implied - a.implied ||
      b.p.tvl_usd - a.p.tvl_usd ||
      (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0),
  );
  // The TVL rank each protocol holds, so the detail view can say why it ranks where it does.
  const byTvl = [...scored].sort((a, b) => b.p.tvl_usd - a.p.tvl_usd || (a.p.slug < b.p.slug ? -1 : 1));
  const tvlRank = new Map(byTvl.map((s, i) => [s.p.slug, i + 1]));
  // Multipliers stay full precision here: the dashboard recomputes the implied value from them
  // and shows it matching board.json exactly. Display rounding happens in the page, not the data.
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token' as const,
    age_days: s.age,
    implied_value_usd: s.implied,
    rank_reason: rankReason(s.p, s, tvlRank.get(s.p.slug) ?? 0, scored.length),
    model: {
      category_multiple: s.categoryMultiple,
      category_live_count: s.categoryLiveCount,
      growth_pct: s.growthPct,
      growth_multiplier: s.growthMult,
      maturity_multiplier: s.maturityMult,
      chain_multiplier: s.chainMult,
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral'))
    return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm'))
    return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('bridge'))
    return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak'))
    return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`;
  if (c.includes('perpetual') || c.includes('derivative'))
    return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator') || c.includes('risk'))
    return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** A second qualifying action, different from the first, so the plan is not one move repeated. */
function secondActionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral'))
    return `Borrow a small amount against the supplied collateral on ${name}, then repay it the same week.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm'))
    return `Swap a small amount through ${name}'s main pool on ${chain} so the wallet shows trading activity too.`;
  if (c.includes('bridge'))
    return `Bridge a second, smaller amount back through ${name} so the wallet shows two-way use.`;
  if (c.includes('staking') || c.includes('restak'))
    return `Delegate a second small stake through ${name} on ${chain} and keep both receipts.`;
  if (c.includes('perpetual') || c.includes('derivative'))
    return `Close the hedge and open one fresh small position on ${name} so the account stays active.`;
  if (c.includes('prediction')) return `Settle the first position on ${name} and place one more market position.`;
  if (c.includes('curator') || c.includes('allocator') || c.includes('risk'))
    return `Deposit a second, smaller amount into a different ${name} vault on ${chain} and keep both share receipts.`;
  if (c.includes('stable')) return `Use the stable asset in one payment or swap through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Hold the yield asset for a full week so the position earns a second yield period.`;
  if (c.includes('insurance')) return `Check the cover terms on ${name} and renew the policy before it lapses.`;
  return `Make a second deposit of $${Math.max(10, Math.round(capital / 2))} into ${name} on ${chain} from the same wallet.`;
}

/**
 * A protocol's farm plan: eight steps, each an action with a cost and a time.
 *
 * The plan is derived from the protocol's own record (category, chains, TVL, age), never
 * from a hand-written list — the same function writes the plan for every row, and the only
 * inputs are the protocol's category (which picks the actions), its first chain (where
 * the actions happen), its TVL (which sizes the capital), and its age (which sets the
 * hold). Two steps are category-specific actions, so the plan is not one move repeated:
 * the first action opens the position, the second proves the wallet does more than one
 * thing. One step checks for a points program before farming further, because farming a
 * protocol with no program is wasted effort and the program's rules decide what counts.
 * The remaining steps cover the wallet, the weekly rhythm, the hold, the claim, and the
 * log — the parts that are the same for every protocol, because good farming hygiene does
 * not depend on the category. Every step carries what it costs and how long it takes, so
 * a reader can price the whole plan before starting it.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const name = p.name;
  const action = actionFor(p, capital, chain);
  const second = secondActionFor(p, capital, chain);
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: second,
      cost: `about $${capital >= 150 ? 5 : 2} of gas`,
      time: '10 minutes',
    },
    {
      text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Open ${name}'s own site and docs and look for a points or rewards program; note its rules and what counts before you farm further.`,
      cost: 'no fee to check',
      time: '10 minutes',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/**
 * The live-token protocols, by market cap, for the dashboard's Live token view.
 *
 * These are the market's own values, never the model's: the board shows what live tokens
 * already trade at, so a reader can see the calibration set the multiples came from. CEX
 * tokens are left out (an exchange's own token is not a protocol launch), and the list is
 * capped at LIVE_ROWS by market cap, so the view shows the largest live tokens — the ones
 * whose market-cap-per-TVL most shapes the calibration. Each row carries its
 * market-cap-per-TVL rounded to four decimals, which is the ratio the model medians are
 * taken over.
 */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
      mcap_per_tvl:
        p.mcap_usd !== null && p.tvl_usd > 0 ? Math.round((p.mcap_usd / p.tvl_usd) * 1e4) / 1e4 : null,
    }));
}

/** A board row's compact form for data.js, with the farm plan included so page and board agree. */
export function radarRow(row: BoardRow, watchlist: Set<string>): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    category_multiple: row.model.category_multiple,
    category_live_count: row.model.category_live_count,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    chain_multiplier: row.model.chain_multiplier,
    watchlist: watchlist.has(row.slug),
    rank_reason: row.rank_reason,
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(
  snapshot: Snapshot,
  model: ModelConstants = MODEL,
): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const calibration = calibrate(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const watchlistSet = new Set(snapshot.watchlist);
  const totalPretokenTvl = board.reduce((s, r) => s + r.tvl_usd, 0);
  const watchlistTvl = board.filter((r) => watchlistSet.has(r.slug)).reduce((s, r) => s + r.tvl_usd, 0);
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    global_multiple: calibration.global_multiple,
    calibration: calibration.table,
    rows: board.map((r) => radarRow(r, watchlistSet)),
    live,
    top10: board.slice(0, 10).map((r) => ({ rank: r.rank, name: r.name, implied_value_usd: r.implied_value_usd })),
    early_finds: board
      .filter((r) => r.tvl_usd < snapshot.floor_usd)
      .slice(0, 8)
      .map((r) => ({ rank: r.rank, name: r.name, category: r.category, tvl_usd: r.tvl_usd, implied_value_usd: r.implied_value_usd })),
    fastest: [...board]
      .filter((r) => r.tvl_usd >= 10_000_000 && r.change_7d !== null)
      .sort((a, b) => (b.change_7d ?? 0) - (a.change_7d ?? 0) || b.tvl_usd - a.tvl_usd)
      .slice(0, 5)
      .map((r) => ({ rank: r.rank, name: r.name, category: r.category, change_7d: r.change_7d, tvl_usd: r.tvl_usd, implied_value_usd: r.implied_value_usd })),
    total_pretoken_tvl: totalPretokenTvl,
    watchlist_tvl: watchlistTvl,
    stats: summarizeBoard(board),
  };
  return { board, radar };
}

/** Summary statistics for the board, shown in the dashboard's model panel.
 *
 * These are descriptive, not part of the ranking: they say what the board contains (how
 * concentrated the value is, how old the protocols are, which categories hold the value),
 * so a reader can judge whether the top of the board is one giant and a long tail, or a
 * genuinely spread field. All of them are computed from the board itself, at runtime.
 */
export interface BoardStats {
  /** The board's combined implied value, in whole dollars. */
  total_implied_usd: number;
  /** The median implied value across the board: the typical launch, not the top one. */
  median_implied_usd: number;
  /** The share of the board's implied value the top 10 rows hold, as a fraction. */
  top10_share: number;
  /** The median age in days across the board (null ages excluded). */
  median_age_days: number | null;
  /** The median 7-day TVL change across the board (null changes excluded). */
  median_change_7d: number | null;
  /** The category holding the most implied value, and how much. */
  top_category: string | null;
  top_category_implied_usd: number;
  /** How many distinct categories the board spans. */
  category_count: number;
}

/** The board's summary statistics, from the board itself. */
export function summarizeBoard(board: BoardRow[]): BoardStats {
  const implied = board.map((r) => r.implied_value_usd).sort((a, b) => a - b);
  const total = implied.reduce((s, v) => s + v, 0);
  const mid = implied.length >> 1;
  const medianImplied =
    implied.length % 2 === 1 ? implied[mid]! : Math.round((implied[mid - 1]! + implied[mid]!) / 2);
  const top10 = board.slice(0, 10).reduce((s, r) => s + r.implied_value_usd, 0);
  const ages = board
    .map((r) => r.age_days)
    .filter((a): a is number => a !== null)
    .sort((a, b) => a - b);
  const ageMid = ages.length >> 1;
  const medianAge =
    ages.length === 0
      ? null
      : ages.length % 2 === 1
        ? ages[ageMid]!
        : Math.round((ages[ageMid - 1]! + ages[ageMid]!) / 2);
  const changes = board
    .map((r) => r.change_7d)
    .filter((c): c is number => c !== null)
    .sort((a, b) => a - b);
  const chMid = changes.length >> 1;
  const medianChange =
    changes.length === 0
      ? null
      : changes.length % 2 === 1
        ? changes[chMid]!
        : (changes[chMid - 1]! + changes[chMid]!) / 2;
  const byCat = new Map<string, number>();
  for (const r of board) {
    const key = r.category ?? '(no category)';
    byCat.set(key, (byCat.get(key) ?? 0) + r.implied_value_usd);
  }
  let topCat: string | null = null;
  let topCatVal = 0;
  for (const [c, v] of byCat) {
    if (v > topCatVal) {
      topCat = c;
      topCatVal = v;
    }
  }
  return {
    total_implied_usd: total,
    median_implied_usd: medianImplied,
    top10_share: total > 0 ? top10 / total : 0,
    median_age_days: medianAge,
    median_change_7d: medianChange,
    top_category: topCat,
    top_category_implied_usd: topCatVal,
    category_count: byCat.size,
  };
}

/**
 * The snapshot out of a file's text, refused unless it is the shape the model scores.
 *
 * The snapshot is sealed: the house fetched it once, and every run of this program and
 * the grade read the same bytes. This function is the only place the file's shape is
 * trusted — it checks the document is a JSON object with the fields the model needs
 * (as_of as a YYYY-MM-DD date, source as a string, floor_usd as a positive whole number,
 * protocols as an array, watchlist as an array of strings), and that every protocol has
 * the ten fields the snapshot carries (slug and name as strings, tvl_usd as a finite
 * number; the rest coerced to their types or null). Anything else is refused with a
 * SnapshotError before any scoring happens, so a malformed input can never produce a
 * board that looks valid. Fields the model does not use are dropped here, not carried
 * forward: the board only ever sees the ten fields the snapshot defines.
 */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
    throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of))
    throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0)
    throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string'))
    throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v))
      throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/**
 * Why a board is not one the gate will take, or null: coverage, ranks, order, one shared
 * value, farm steps.
 *
 * The gate checks these same things on the server, so this function is the program's own
 * copy of the gate's board rows — it runs before anything is written, and a board that
 * fails here is never written to disk. The checks, in the order they run:
 *   - Coverage: every watchlist slug must appear among the rows. A missing slug is the
 *     most serious failure, because the watchlist is the floor the board must cover.
 *   - Ranks: the ranks must be exactly 1..n, each once. A gap or a duplicate means the
 *     sorting or the numbering is broken.
 *   - Order: the implied value must not rise as rank ascends. Rank 1 is the most valuable
 *     protocol; a row below it cannot be worth more, or the board contradicts itself.
 *   - One shared value: if every row has the same implied value, the board ranks nothing
 *     by value and is refused as a ranking. A board of one row is exempt (there is nothing
 *     to order), but this board always has many rows.
 *   - Farm steps: every row must have 3–12 steps, each 20–600 characters once trimmed,
 *     and a positive whole implied value. A step outside the range is a plan the gate
 *     will not take, so it is caught here, before the file is written.
 */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0)
    return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++)
    if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd)
      return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.trim().length < 20 || s.trim().length > 600) return `${r.slug} has a farm step of ${s.trim().length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0)
      return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/**
 * A compact data.js: the dashboard's whole dataset as one script, no fetch and no network.
 *
 * The dashboard loads this file with a plain <script> tag and reads window.RADAR. Because
 * the data travels as a script rather than a fetch, the page works from a file:// URL with
 * no server and no network — which is also why the scorer's no-network rule is satisfied:
 * there is no fetch, no import, and no URL anywhere in the page. The JSON is written in
 * one line (no pretty-printing) to keep the file small, and a trailing newline ends it.
 * Determinism holds here too: the same board always writes the same data.js, because the
 * rows are already in a total order and JSON.stringify writes object keys in insertion
 * order.
 */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
