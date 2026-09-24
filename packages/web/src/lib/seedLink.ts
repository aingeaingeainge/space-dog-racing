import type { Difficulty, GameLength, PlayerSetup, SeasonSetup, Toggles } from '@sdr/engine';

/**
 * A whole season in a link: `?seed=12345&players=h,normal,normal,hard`.
 *
 * The app has no router and needs none — `App` switches on state through `screenFor`, so there is
 * exactly one path and nothing to rewrite. This is query parsing on the title screen and nothing
 * else, which is also why no `_redirects` file belongs in the build.
 *
 * A link *fills the New Season screen in*; it never starts a season and never touches the save.
 * That is the whole reason it is parsed here into a setup rather than handed to `newSeason`: the
 * player still presses Start, so a link opened in a tab where a season is half-played cannot
 * overwrite `sdr.save.v1` behind their back.
 *
 * Toggles ride along because the game already tells the player they must: "a shared seed only
 * replays the same way with the same toggles". A link that dropped them would be a link that
 * quietly does not reproduce the season it claims to.
 */

export interface SharedSeason {
  seed: number;
  players: PlayerSetup[];
  toggles: Partial<Toggles>;
  /** The game's length (GDD_V3 §2.1), if the link names one: `len=3` seasons, `len=t60000`. */
  length?: GameLength;
}

/**
 * `h` is human. Hard is spelled out, because `h` cannot mean both — that ambiguity is the one
 * real trap in a scheme this small, so `e`/`n` get shorthand and hard does not.
 */
const AI_TOKENS: Record<string, Difficulty> = {
  e: 'easy',
  easy: 'easy',
  n: 'normal',
  normal: 'normal',
  hard: 'hard',
};
const HUMAN_TOKENS = ['h', 'human'];

const TOGGLE_TOKENS: Record<string, keyof Toggles> = {
  nobet: 'betting',
  notrade: 'trading',
  casual: 'casualEvents',
};

const MAX_STABLES = 8;

function tokenFor(p: PlayerSetup): string {
  if (p.kind === 'human') return 'h';
  return p.difficulty ?? 'normal';
}

/** The roster as a link would spell it, e.g. `h,normal,normal,hard,hard,normal`. */
export function playersParam(players: readonly PlayerSetup[]): string {
  return players.map(tokenFor).join(',');
}

/** Only the toggles that are *not* at their defaults, so a default season gets a short link. */
export function togglesParam(toggles: Partial<Toggles> | undefined): string {
  if (!toggles) return '';
  const on: string[] = [];
  if (toggles.betting === false) on.push('nobet');
  if (toggles.trading === false) on.push('notrade');
  if (toggles.casualEvents) on.push('casual');
  return on.join(',');
}

/**
 * A game's length as a link spells it (GDD_V3 §2.1): nothing for one season, `3` for three,
 * `t60000` for a race to 60,000. Without it a shared seed would replay a different game.
 */
export function lengthParam(length: GameLength | undefined): string {
  if (!length) return '';
  if (length.kind === 'target') return `t${length.worth}`;
  return length.seasons === 1 ? '' : String(length.seasons);
}

function parseLength(raw: string | null): GameLength | undefined {
  if (!raw) return undefined;
  const t = raw.trim().toLowerCase();
  const n = Number(t.startsWith('t') ? t.slice(1) : t);
  if (!Number.isInteger(n) || n <= 0) return undefined;
  if (t.startsWith('t')) return { kind: 'target', worth: n };
  return n >= 1 && n <= 5 ? { kind: 'seasons', seasons: n } : undefined;
}

/** The link for a season, given where the game is served from. */
export function seasonLinkFor(setup: SeasonSetup, base: string): string {
  const params = new URLSearchParams();
  params.set('seed', String(setup.seed));
  params.set('players', playersParam(setup.players));
  const t = togglesParam(setup.toggles);
  if (t) params.set('toggles', t);
  const len = lengthParam(setup.length);
  if (len) params.set('len', len);
  const clean = base.split('?')[0]!.split('#')[0]!;
  return `${clean}?${params.toString()}`;
}

/**
 * Read a shared season out of a query string. Returns null unless there is a usable seed, and
 * ignores anything it does not understand rather than refusing the link — a roster with one
 * mistyped stable should still open, with that stable dropped, instead of dumping the player on
 * a blank title screen with no explanation.
 */
export function parseSeasonLink(search: string): SharedSeason | null {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search);
  } catch {
    return null;
  }
  const rawSeed = params.get('seed');
  if (rawSeed === null) return null;
  const seed = Number(rawSeed);
  if (!Number.isFinite(seed) || Math.abs(seed) > Number.MAX_SAFE_INTEGER) return null;

  const players: PlayerSetup[] = [];
  const raw = params.get('players');
  if (raw) {
    for (const part of raw.split(',')) {
      const token = part.trim().toLowerCase();
      if (!token) continue;
      if (HUMAN_TOKENS.includes(token)) players.push({ name: '', kind: 'human' });
      else if (AI_TOKENS[token])
        players.push({ name: '', kind: 'ai', difficulty: AI_TOKENS[token] });
      if (players.length >= MAX_STABLES) break;
    }
  }

  const toggles: Partial<Toggles> = {};
  const rawToggles = params.get('toggles');
  if (rawToggles) {
    for (const part of rawToggles.split(',')) {
      const key = TOGGLE_TOKENS[part.trim().toLowerCase()];
      if (!key) continue;
      // `nobet` and `notrade` name the *off* state of a toggle that defaults on.
      toggles[key] = key === 'betting' || key === 'trading' ? false : true;
    }
  }

  const length = parseLength(params.get('len'));
  return { seed: Math.trunc(seed), players, toggles, ...(length ? { length } : {}) };
}
