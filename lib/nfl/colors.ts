/**
 * Team colours are the only saturated colour in the interface, so they have to
 * survive both grounds. Several NFL primaries do not on their own: the Raiders
 * are black, the Jets' green vanishes on a dark ground, and a handful of whites
 * and silvers disappear on paper.
 *
 * For each team we resolve two values — one for the light ground, one for the
 * dark — by taking whichever of the primary/alternate pair reads better and
 * then nudging it until it clears a contrast floor against that ground.
 */

const LIGHT_GROUND = [0xfb, 0xfb, 0xfa] as const;
const DARK_GROUND = [0x1a, 0x19, 0x17] as const;

/** Swatches are non-text, so the 3:1 non-text floor is the right bar. */
const MIN_CONTRAST = 3.0;

type RGB = readonly [number, number, number];

function parseHex(hex: string | null | undefined): RGB | null {
  if (!hex) return null;
  const clean = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

const toHex = (rgb: RGB) =>
  "#" + rgb.map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, "0")).join("");

function luminance([r, g, b]: RGB): number {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(a: RGB, b: RGB): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/**
 * Walks the colour toward white (on a dark ground) or black (on a light one)
 * until it clears the contrast floor. Preserves hue far better than swapping in
 * a neutral would.
 */
function ensureContrast(color: RGB, ground: RGB): RGB {
  if (contrast(color, ground) >= MIN_CONTRAST) return color;

  const groundIsDark = luminance(ground) < 0.5;
  const target: RGB = groundIsDark ? [255, 255, 255] : [0, 0, 0];

  for (let t = 0.08; t <= 1; t += 0.08) {
    const candidate = mix(color, target, t);
    if (contrast(candidate, ground) >= MIN_CONTRAST) return candidate;
  }
  return target;
}

function resolveFor(ground: RGB, primary: RGB | null, alternate: RGB | null): string {
  const candidates = [primary, alternate].filter((c): c is RGB => c !== null);
  if (candidates.length === 0) return toHex(ensureContrast([0x77, 0x77, 0x77], ground));

  // Prefer the primary when it already clears the bar; otherwise take whichever
  // of the pair is closer, then nudge it.
  const passing = candidates.find((c) => contrast(c, ground) >= MIN_CONTRAST);
  if (passing) return toHex(passing);

  const best = candidates.reduce((a, b) => (contrast(a, ground) >= contrast(b, ground) ? a : b));
  return toHex(ensureContrast(best, ground));
}

export type TeamColors = { light: string; dark: string };

export function teamColors(color: string | null, altColor: string | null): TeamColors {
  const primary = parseHex(color);
  const alternate = parseHex(altColor);
  return {
    light: resolveFor(LIGHT_GROUND, primary, alternate),
    dark: resolveFor(DARK_GROUND, primary, alternate),
  };
}

/**
 * Inline custom properties consumed by `.team-fill` / `.team-text` in
 * globals.css, which pick the right one per theme.
 */
export function teamColorVars(
  color: string | null,
  altColor: string | null,
): React.CSSProperties {
  const { light, dark } = teamColors(color, altColor);
  return { "--tc-l": light, "--tc-d": dark } as React.CSSProperties;
}
