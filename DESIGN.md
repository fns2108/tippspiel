---
name: Tippspiel Wedel
description: A private NFL pick'em pool read as a Swiss-utility record book — paper, ink, hairlines, and team colour used only where it means something.
colors:
  paper: "#fbfbfa"
  paper-dark: "#1a1917"
  panel: "#f4f4f2"
  panel-dark: "#232120"
  sunken: "#eeeeec"
  sunken-dark: "#2c2a28"
  ink: "#111112"
  ink-dark: "#ecebe8"
  ink-on: "#fbfbfa"
  ink-on-dark: "#1a1917"
  n-1: "#6b6b68"
  n-1-dark: "#a8a29a"
  n-2: "#8a8a86"
  n-2-dark: "#8b857a"
  n-3: "#c9c9c5"
  n-3-dark: "#4a463f"
  rule: "#e2e2de"
  rule-dark: "#38352f"
  correct: "#1f7a4d"
  correct-dark: "#4aa877"
  correct-soft: "#e6f2ea"
  correct-soft-dark: "#1c2a20"
  wrong: "#b03030"
  wrong-dark: "#d96a63"
  wrong-soft: "#f7e9e8"
  wrong-soft-dark: "#2e1e1b"
  live: "#a8650b"
  live-dark: "#d99b3f"
  live-soft: "#fbf0df"
  live-soft-dark: "#2c2416"
  focus: "#2f5fd0"
  focus-dark: "#7aa2f7"
typography:
  display:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "2.5rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1.45
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.45
    letterSpacing: "-0.02em"
  subtitle:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.45
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "normal"
    fontFeature: "cv05 1, ss01 1"
  meta:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.09em"
  numeric:
    fontFamily: "JetBrains Mono, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "normal"
    fontFeature: "tnum 1"
rounded:
  none: "0"
  sm: "3px"
  pill: "999px"
spacing:
  hair: "1px"
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  gutter-wide: "32px"
  tap: "44px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ink-on}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
    height: "{spacing.tap}"
  button-primary-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ink-on}"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
    height: "{spacing.tap}"
  button-secondary-hover:
    backgroundColor: "{colors.sunken}"
    textColor: "{colors.ink}"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.subtitle}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
    height: "{spacing.tap}"
    width: "100%"
  input-focus:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
  input-disabled:
    backgroundColor: "{colors.sunken}"
    textColor: "{colors.n-1}"
  chip-sort:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.n-1}"
    typography: "{typography.meta}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
  chip-sort-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ink-on}"
    typography: "{typography.meta}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
  pick-side:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "8px 10px"
    height: "{spacing.tap}"
  pick-side-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ink-on}"
    rounded: "{rounded.sm}"
    padding: "8px 10px"
    height: "{spacing.tap}"
  nav-tab:
    backgroundColor: "transparent"
    textColor: "{colors.n-1}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "0 12px"
    height: "56px"
  nav-tab-active:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "0 12px"
    height: "56px"
  stat-tile:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "12px"
  week-rail-cell:
    backgroundColor: "transparent"
    textColor: "{colors.n-1}"
    typography: "{typography.meta}"
    rounded: "{rounded.none}"
    height: "44px"
    width: "44px"
  week-rail-cell-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ink-on}"
    typography: "{typography.meta}"
    rounded: "{rounded.none}"
    height: "44px"
    width: "44px"
---

# Design System: Tippspiel Wedel

Recorded from the built interface, not from intention. Tokens live in
[`app/globals.css`](app/globals.css); the frontmatter above is the machine-readable
mirror, and this prose explains what each token is for.

## Overview

**Creative North Star: "The Record Book"**

This is a record book for one group's season, not a betting product. The week is a dense
ruled ledger: games run down the page, members run across it, and the rules between them
carry the structure that a card grid would otherwise fake. Nothing here is trying to sell
a wager — it is trying to let ten friends see, quickly and exactly, who took which side
and who was right.

The direction is **Swiss utility**, pinned by the owner from three previewed options
against one binding constraint: *it must not look vibecoded*. In practice that means a
near-monochrome ground, hairlines as the only separator, one sans on a fixed scale,
tracked 11px uppercase labels, tabular numerals everywhere a number sits in a column, and
square geometry. Team colour is the sole saturated element on the page, and it never
appears as decoration.

The mode is **Operate**. The visitor is doing a task — getting through a week of games in
a spare minute on a phone, or reading the group against itself at 02:15 on a Tuesday when
a Monday-night game finally ends in Germany. Scanability and certainty outrank expression.
The personality lives in precision: the way a spread is replaced in place by a score, the
way a losing side recedes, the way the corner badge on your pick changes from "this is
mine" to "this was right".

**Key Characteristics:**

- Near-monochrome paper-and-ink ground in both themes; the dark theme is warm graphite, not black.
- Hairline rules do the structural work that shadows do elsewhere. There is not one `box-shadow` in the codebase.
- One type family (Inter), with JetBrains Mono reserved for digits that must line up.
- Fixed type steps at roughly 1.2, never fluid, stepping up one notch above 1024px.
- Team colour is encoded information only — consensus bars, grid abbreviations, pick strips.
- Square by default; the only radius is 3px.
- Authored 16-unit SVG icon set. No emoji, no icon font.

## Colors

Restrained and near-monochrome, built as three grounds plus one ink, with a small
semantic set for state. Contrast targets are met against the actual grounds, not assumed:
`--n-1` is 5.4:1 on paper in light and 7.0:1 on graphite in dark.

### Primary

The system has no decorative accent. Its primary is the ink itself.

- **Ink** (`#111112` light / `#ecebe8` dark): primary text, and — critically —
  the *selected* fill. A chosen pick, an active week cell and an active sort chip are all
  filled with ink and reverse their text to **Ink On** (`#fbfbfa` / `#1a1917`).
  Selection is the highest-contrast event on the page because selection is what the app is for.

### Secondary

- **Team colour** (per team, resolved at runtime): the only saturated colour in the interface,
  supplied inline as `--tc-l` / `--tc-d` by [`lib/nfl/colors.ts`](lib/nfl/colors.ts) and consumed
  by `.team-fill`, `.team-text`, `.team-rule`.

### Tertiary

- **Correct** (`#1f7a4d` / `#4aa877`) and **Correct Soft**: a right pick, an active
  invite key, a success notice.
- **Wrong** (`#b03030` / `#d96a63`) and **Wrong Soft**: a wrong pick, a form error,
  the admin sync-error panel.
- **Live** (`#a8650b` / `#d99b3f`) and **Live Soft**: a game actually in progress —
  the pulsing dot, the in-progress score in the grid.
- **Focus** (`#2f5fd0` / `#7aa2f7`): the focus ring and the caret. Deliberately the one
  blue in the system, so a keyboard ring is never mistaken for content.

### Neutral

- **Paper** (`#fbfbfa` / `#1a1917`): the page ground.
- **Panel** (`#f4f4f2` / `#232120`): toolbars, sticky heads, banners, empty states, and the
  row highlight for "you" in the season table.
- **Sunken** (`#eeeeec` / `#2c2a28`): wells, bar tracks, disabled fills, hover grounds.
- **Secondary text** (`#6b6b68` / `#a8a29a`): supporting copy, inactive nav, team full names.
- **Tertiary text** (`#8a8a86` / `#8b857a`): metadata and de-emphasis. Only at 14px or bold.
- **Strong rule** (`#c9c9c5` / `#4a463f`): input borders, scrollbar thumb, the `@` glyph
  between two teams, an em-dash standing in for a missing pick.
- **Hairline** (`#e2e2de` / `#38352f`): the workhorse separator. Every list, table row,
  header and tile boundary in the app is this one value.

### Named Rules

**The Team Colour Rule.** Team colour is the only saturated colour in the interface, and it
appears only where it encodes something: the consensus bars on `/standings` and a profile,
the team abbreviation in a grid cell, the abbreviation in a post-kickoff consensus strip.
Never as a background, never as an accent, never to make a section look livelier.

**The Two Grounds Rule.** Every team colour ships as a resolved pair. Several NFL primaries
do not survive one of the two grounds — the Raiders are black, the Jets' green vanishes on
graphite, several silvers disappear on paper. `teamColors()` takes whichever of the
primary/alternate pair reads better and walks it toward white or black until it clears 3:1
against that specific ground. Both values travel inline as `--tc-l` / `--tc-d`; CSS picks one.
A unit test asserts all 32 primaries clear the bar on both grounds. **The ground constants in
`lib/nfl/colors.ts` are hard-coded copies of `--paper` and `--paper-dark`; changing either
token means changing `LIGHT_GROUND` / `DARK_GROUND` too.**

**The Inverted Ground Rule.** A selected pick button is filled with `--ink`, which inverts
locally — in dark mode that is a *light* button on a dark page. Anything inside it must use
`--ink-on` and its alpha steps (`text-ink-on/70`, `text-ink-on/55`), never the page-relative
neutrals, or it drops below contrast in exactly one of the two themes. Team logos have the
same problem and take `onInverted` on `<TeamLogo>`, which flips which of ESPN's two
renderings is displayed.

**The Warm Graphite Rule.** The dark ground is `#1a1917` — lifted well off `#000` so the
page reads as a ground rather than a void, and warm so it stays the same paper-and-ink world
as the light theme instead of becoming a separate cold one. Never darken it toward black.

## Typography

**Display Font:** Inter (variable) — there is no separate display face.
**Body Font:** Inter (variable), with `ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`.
**Label/Mono Font:** JetBrains Mono, with `ui-monospace, "SF Mono", Menlo, monospace`.

**Character:** One family, tightened as it gets larger. Product UI does not need a
display/body pair, and a second face would read as costume. Inter runs with `cv05` and
`ss01` enabled; the mono is measurement, not decoration — it appears only where digits
have to line up.

### Hierarchy

Steps are fixed at roughly 1.2 and never fluid, because product UI is read at a consistent
distance and a heading that shrinks inside a panel looks worse than one that does not move.
Each step goes up one notch above 1024px: a phone is held closer and has less room, a
monitor has both the distance and the space.

- **Display** (600, 40px → 44px, tracking −0.025em): declared as `--fs-display` and reserved
  for a single dominant number. *Not currently used by any shipped screen* — the largest rendered
  type is the headline. Do not reach for it without a real reason.
- **Headline** (600, 28px → 30px, tracking −0.025em): `h1`. One per page, always inside a `.rule-head`.
- **Title** (600, 20px → 22px, tracking −0.02em): `h2`. Section heads.
- **Subtitle** (600, 16px → 17px, tracking −0.015em): `h3`, the team abbreviation in a pick side,
  the wordmark in the header.
- **Body** (400, 14px → 15px, line-height 1.45): the UI default. Paragraphs cap at `--measure` (68ch).
- **Meta** (400, 12px → 13px): the density workhorse — 43 usages, more than any other step.
  Timestamps, spreads, counts, consensus names, table cells.
- **Label** (600, 11px → 12px, tracking 0.09em, uppercase, `--n-1`): column heads, section meta,
  state chips.

### Named Rules

**The One Family Rule.** Inter for everything. JetBrains Mono only where digits must line up:
scores, records, percentages, invite keys, clock times, season numbers. If a number is prose
rather than data, it stays in Inter.

**The Tabular Rule.** Every number in this app sits in a column with other numbers.
`font-variant-numeric: tabular-nums` is on every `table`, every `.tnum`, and every element
marked `data-numeric`. Mark the element rather than eyeballing whether it will ever be
compared.

**The Sixteen Pixel Rule.** Form inputs are 16px (`--text-md`), never smaller. Anything under
16px makes iOS Safari zoom on focus, and this pool is used on a phone more than anywhere else.

**The One Mannerism Rule.** `.label` is the single typographic flourish the system allows.
Do not invent a second one — no small caps, no letterspaced body, no italic meta.

## Layout

Everything sits on a **4px baseline grid**. `.shell` caps content at 1180px and pads 16px on
a phone, 32px from 768px up.

The picking column is deliberately measured at **48rem rather than full-bleed**: on a desktop
a stretched row would put the team name a long way from its score. Prose caps at 68ch
(`--measure`).

Responsive behaviour is **structural, not fluid**. Three breakpoints do all the work:

- **640px (sm)**: the post-kickoff consensus strip goes from one column to two; stat tiles go 2-up → 4-up.
- **768px (md)**: the desktop top nav appears and the fixed bottom tab bar disappears; shell padding widens.
- **1024px (lg)**: the whole type scale steps up one notch.

The type step-up is why `--fs-*` exists as a separate layer on `:root` and is only *referenced*
from `@theme inline`. A literal value inside `@theme` is inlined at build time, and a media
query could never reach it.

Wide tables (the grid, the season table, the invite-key table) escape the shell padding with
`-mx-4 … px-4` and scroll horizontally. The grid's first column is `sticky left-0` with a
`bg-paper` fill so the fixture stays readable while members scroll past.

### Named Rules

**The Live Edge Rule.** Any horizontal scroller wears `.edge-fade`, which masks the last 28px so
a cut-off column reads as "there is more" rather than as a broken layout. The mask is removed via
`data-at-end="true"` once the scroller bottoms out, so a fully-scrolled rail does not look
permanently faded.

**The Thumb Rule.** Interactive targets are at least `--tap` (44px). Below 768px primary navigation
is a fixed bottom bar with `env(safe-area-inset-bottom)` padding, clear of the iOS home indicator;
`body` carries the same inset so content never hides beneath it.

## Elevation & Depth

**This system has no shadows at all.** There is not a single `box-shadow` in the codebase, and
that is the point — shadows standing in for structure are the clearest tell of the look the
brief rejects.

Depth is expressed two ways, both flat:

1. **Tonal layering.** Three grounds — Paper, Panel, Sunken — do all the surface separation.
   Panel lifts a toolbar, banner, empty state or highlighted row off the page; Sunken recesses a
   bar track, a disabled field, a hover ground.
2. **Hairlines.** A 1px `--rule` border is the primary separator in the entire app. Section heads
   sit on a heavier `--ink` rule (`.rule-head`); a grid's total row sits on a 2px `--ink` rule.
   The hierarchy of a boundary is carried by its *colour weight*, not by its blur radius.

The only quasi-material effect anywhere is the sticky header and bottom tab bar, which use
`bg-paper/95` with `backdrop-blur-[2px]` — just enough that scrolled content does not read
through as noise, far too little to register as glass.

### Named Rules

**The No-Shadow Rule.** Never add a `box-shadow`, a `drop-shadow`, or a glow. If something needs
to separate from its surroundings, give it a rule; if it needs to sit above, give it Panel.

**The Three Grounds Rule.** Paper → Panel → Sunken is the entire elevation vocabulary. There is
no fourth surface. A design that seems to need one is usually a card grid in disguise.

## Shapes

The form language is **square, with one concession**. `--r` is 3px and it is the only radius in the
system; most surfaces — tables, tiles, banners, rails, section heads — have no radius at all.
The exceptions are small and deliberate: buttons, inputs, chips and pick sides take the 3px;
the live dot and the scrollbar thumb are fully round because they are dots, not panels.

Borders carry the geometry. A container is defined by `border border-rule`, not by a fill —
so an empty state, a stat tile, a push-notification row and an invite form are all the same
1px rectangle at different sizes, and the family resemblance is structural rather than styled.

The stat-tile grid is the sharpest expression of this: a `grid gap-px` on a `bg-rule` ground with
`bg-paper` children, so the hairlines between tiles are literally the ground showing through the
gaps. No borders are drawn; there are no doubled edges, and no rounding to break.

Icons are their own shape system: one 16-unit grid, 1.5 stroke, round caps and joins, `currentColor`
throughout, so every icon inherits the colour of the text it sits beside.

### Named Rules

**The Three Pixel Rule.** Radii are 3px or 0. Nothing in this app is `rounded-lg`, `rounded-xl`, or
`rounded-2xl`. A pill radius is permitted only on something that is genuinely a dot or a track.

**The Authored Icon Rule.** Icons are hand-drawn SVG on the 16-unit grid in
[`components/icons.tsx`](components/icons.tsx). No emoji, no unicode glyphs as iconography, no icon
font, no `<img>` icons. Icons are `aria-hidden` by default and become labelled graphics only when
passed a `title`.

## Components

### Buttons

- **Shape:** the system radius (`3px`), 44px minimum height, 10px/16px padding, 500 weight.
- **Primary:** filled `--ink` with `--ink-on` text and a matching border, so it holds its silhouette
  when the theme inverts.
- **Secondary:** Paper ground, `--n-3` border, Ink text. Hovers to Sunken with an `--n-2` border.
- **Hover / Focus:** primary dims to 86% opacity; secondary shifts ground. All transitions 150ms ease.
  Focus is the global 2px `--focus` ring at 2px offset.
- **Active:** `translateY(1px)`. The one physical gesture in the system.
- **Disabled:** 50% opacity, `cursor: not-allowed`.

### Inputs / Fields

- **Style:** full width, Paper ground, 1px `--n-3` border, 3px radius, 16px text, 44px minimum height.
- **Hover:** border to `--n-2`. **Focus:** border to `--ink` *plus* the `--focus` ring at 1px offset — the
  border shift alone is too quiet at hairline weight.
- **Invalid:** `[aria-invalid="true"]` turns the border `--wrong`. **Disabled:** Sunken ground, `--n-1` text.
- Labels are always `.label`, 6px above the field. Hints are 12px `--n-1` below it, wired with `aria-describedby`.

### Chips

- **Sort chips** (`TeamConsensus`): 3px radius, 12px text, `--rule` border, `--n-1` text.
- **Selected:** filled `--ink`, `--ink-on` text, 500 weight, `aria-pressed="true"`. Selection is a fill,
  never an underline or a tint.

### Cards / Containers

Cards are used **only where a card is the real object** — a stat tile, an invite-key form, a push
row, an empty state. They are never page structure.

- **Corner Style:** square (0).
- **Background:** Paper, or Panel when the container is an announcement (banner, empty state).
- **Shadow Strategy:** none. See Elevation & Depth.
- **Border:** 1px `--rule`. A banner that demands attention upgrades to 1px `--ink`.
- **Internal Padding:** 12px on tiles, 12px/10px on banner rows, 16px/32px on empty states.

### Navigation

- **Desktop (≥768px):** a 56px sticky header on `bg-paper/95`. Nav items are 14px, `--n-1`, with a
  2px transparent bottom border that becomes `--ink` and 500 weight when active — the active tab is
  drawn on the header's own rule, not floated above it.
- **Mobile (<768px):** a fixed 56px bottom tab bar, three columns, icon over an 11px uppercase label.
  Active is `--ink` + 600 weight; inactive is `--n-2`. No pill, no background swap.
- A skip link is the first focusable element and reveals itself as an `--ink` block on focus.
- The theme toggle cycles system → light → dark; "system" shows a sun with an `--n-2` dot, and before
  hydration it always renders that neutral state rather than guessing and flipping.

### The Pick Row — signature component

The whole reason the interface exists. Two team blocks facing each other across a gutter carrying
`@` or `vs`, the away side reading left-to-right and the home side mirrored (`flex-row-reverse`), so
the logos bracket the centre the way a broadcast scoreboard does. **The block is the control** —
there is no separate button and no submit step. Tapping your current pick clears it, so a game can
be left genuinely blank.

One layout serves every state:

- **Before kickoff:** each side shows its side of the spread (home-relative, negated for the away
  side) in 12px tertiary type. Context only — the spread never touches scoring.
- **Live:** a pulsing `--live` dot with the period/clock beside the kickoff time.
- **After kickoff:** the spread is replaced *in place* by the score in 20px mono. The losing side
  recedes to 55% opacity and its logo to 70%; the winner's score goes bold.
- **Selected:** the side fills with `--ink` and everything inside switches to `--ink-on` alphas.
- **The corner badge** means "your pick" before the game is final and right-or-wrong after it. It
  changes from a tick on `--ink-on` to a tick on `--correct` or a cross on `--wrong`, because a tick
  left sitting on a game you lost reads as correct. The badge mirrors to the opposite corner on the
  home side so it always points outward.
- **Consensus strip:** once locked, a hairline-topped `<dl>` names who took which side — one column
  on a phone, two from 640px. Names wrap rather than truncate, because after kickoff who backed whom
  *is* the content.

### The Week Rail

The whole season as one dense rail rather than a dropdown. 22 addressable weeks is small enough to
show at once, and seeing them laid out is itself information: which are played, which are open,
where you are. 44px cells separated by 1px gaps, horizontally scrollable under `.edge-fade`, with the
active week auto-centred on mount (scrolling the rail, never the page). The active cell is an `--ink`
fill; a completed week carries a 3px underscore beneath its number. Unscheduled weeks render as
`--n-3` text with no link — visible but inert.

### The Consensus Bar

The one chart idiom in the app, used on both `/standings` and each player's profile. **Bar length is
volume; the filled part is accuracy**, drawn in team colour on a Sunken track, 10px tall, square. A
minimum bar width of 6% keeps a single-pick team visible. The sort control switches between
most-picked, best rate and worst rate, and sorting by rate breaks ties on volume, so a team picked
once and won cannot outrank one backed twenty times. Callouts ("Most reliable", "Most burned by")
require at least three decided games so one lucky result cannot win the title.

## Do's and Don'ts

### Do:

- **Do** separate with a 1px `--rule` hairline first. Reach for Panel only when a surface genuinely
  needs to sit above the page.
- **Do** put every number that could ever appear beside another number in JetBrains Mono with
  `data-numeric`.
- **Do** use `--ink` fill to mean *selected*, in every context — pick side, week cell, sort chip.
  It is the system's one high-contrast event and it must mean one thing.
- **Do** supply both `--tc-l` and `--tc-d` via `teamColorVars()` whenever team colour is used, and let
  `.team-fill` / `.team-text` choose. Never write a team hex directly into markup.
- **Do** switch to `--ink-on` and its alpha steps inside anything filled with `--ink`, and pass
  `onInverted` to `<TeamLogo>` there.
- **Do** keep base element styles in `@layer base` and shared classes in `@layer components`.
  **Cascade layers are load-bearing here**: unlayered CSS outranks everything Tailwind emits
  regardless of specificity, and an unlayered `button { color: inherit }` silently beat every
  `text-*` utility until this was fixed.
- **Do** theme the browser's own surfaces — selection, caret, accent, scrollbar, focus ring,
  underline offset. The parts we did not draw still belong to the system.
- **Do** give any horizontal scroller `.edge-fade` and any tall table a `sticky left-0` first column
  on a `bg-paper` fill.
- **Do** keep motion at 150–250ms and confine it to state transitions. The only two authored moments
  are `.live-dot` (a game actually in progress) and `.skeleton` (content arriving instead of a
  spinner) — both report state rather than decorate. Everything collapses under
  `prefers-reduced-motion`.

### Don't:

- **Don't** add a shadow, glow, or gradient header. There are none in the codebase and there is no
  case that needs the first one.
- **Don't** use glassmorphism. The 2px backdrop blur on the two fixed bars is the ceiling.
- **Don't** build page structure out of same-size feature cards. Cards are for objects that are
  genuinely cards.
- **Don't** use emoji or unicode glyphs as iconography. Add to
  [`components/icons.tsx`](components/icons.tsx) on the 16-unit grid instead.
- **Don't** exceed a 3px radius. Nothing is `rounded-2xl`.
- **Don't** use team colour as decoration, as a section background, or as an accent. Only where it
  encodes which team.
- **Don't** put a page-relative neutral (`--n-1`, `--n-2`, `--n-3`) inside an `--ink` fill. It will
  fail contrast in exactly one theme, and it will be the theme you did not test.
- **Don't** make type fluid or introduce a second font family. The scale is fixed; the step-up at
  1024px is the entire responsive type story.
- **Don't** set a form input below 16px.
- **Don't** change `--paper` or the dark ground without updating `LIGHT_GROUND` / `DARK_GROUND` in
  [`lib/nfl/colors.ts`](lib/nfl/colors.ts) and the `themeColor` viewport entries in
  [`app/layout.tsx`](app/layout.tsx). Three places, one value.
