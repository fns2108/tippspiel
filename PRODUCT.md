# Product

<!-- impeccable:product-schema 1 -->

## Platform

web (mobile-first; installable as a PWA so iOS can receive push reminders)

## Stack

delegated — Next.js 15 App Router + TypeScript, Tailwind v4 (CSS-first `@theme`),
Drizzle ORM on Postgres (Neon free tier), hand-rolled scrypt session auth, deployed on
Vercel Hobby in `fra1`, beside the database. Chosen for zero running cost and
push-to-deploy; the owner explicitly left framework and backend to be decided, asking only
that it be cheap and easy to deploy.

**One database, no local mode.** There is no embedded or local development database. Every
environment — the deployment, a migration, a script on the owner's laptop — connects to the
same Neon Postgres, so the SQL that runs in development is the SQL that runs in production.
The owner asked for this explicitly after an embedded local database corrupted itself twice.
The cost is accepted knowingly: anything run on a laptop touches live data, so there are no
destructive convenience scripts (no reset, no demo seeding) for one to be run by mistake.

## Users

A single private group of roughly ten friends who follow the NFL from Germany, plus the
owner, who also administers the pool.

Two jobs, in very different postures:

- **Picking** — done in a spare minute on a phone, often days apart, sometimes minutes
  before kickoff. The user wants to get through a full week of games with as little
  friction as possible and be certain their picks were saved.
- **Watching and settling up** — done on a Sunday evening or Monday morning, comparing
  their week against everyone else's. This is the social payoff and the reason the pool
  exists.

Because the group is in Central European Time, US kickoffs land in the German evening,
night, and early morning. A Monday night game is Tuesday 02:15 locally.

## Product Purpose

A season-long NFL pick'em pool for one group of friends. Each week every member picks the
outright winner of every game; one point per correct pick. There is a winner each week
(most correct picks that week, ties shared) and an overall winner at the end of the season
(most correct picks across the regular season and playoffs).

Success is that the group actually uses it for a whole season without the owner having to
chase anyone or fix scores by hand.

## Positioning

Private and invite-only by construction, not as a setting. Accounts require an invite key
the owner generates, so the pool is exactly the people he chose — no public leaderboards,
no strangers, no accounts to moderate.

Two things distinguish it from a generic pick'em app:

- **Per-game locking.** Each game locks at its own kickoff rather than the whole week
  locking Thursday night, so Sunday games stay editable all week.
- **Kickoff-gated reveal.** Nobody can see anyone else's pick on a game until that game
  kicks off. This is a correctness guarantee enforced on the server, not a UI affordance.

## Operating Context

- The season runs September through early February: 18 regular-season weeks plus four
  playoff rounds, all included in the same competition.
- Games cluster into three windows per week — Thursday night, the Sunday block, and Monday
  night — with occasional international morning games and a Friday or Saturday slate late
  in the season.
- Teams have bye weeks, so the number of games per week varies (typically 13–16).
- Kickoff times move: the NFL flexes games between windows during the season.
- Schedule, scores, and betting lines come from ESPN's public undocumented scoreboard API.
  It is free and needs no key, but it can change without notice, so it is isolated behind
  one adapter module and the app always falls back to last-known stored state.

## Capabilities and Constraints

Confirmed functionality:

- Invite-key registration, username + password login, session cookies.
- A picking page listing the current week's games with team names, logos, home/away, and
  the current point spread shown as context only.
- Straight-up scoring: one point per correct outright winner. A drawn game counts for
  nobody. The spread never affects scoring.
- Per-game lock at that game's kickoff, enforced server-side on every write.
- Other members' picks on a game become readable only once that game has kicked off.
- Weekly winner (most correct that week; ties are shared, all tied members are winners)
  and a season winner on the same rule.
- Playoff rounds count as additional weeks with their own weekly winners and roll into the
  season total.
- Analytics: live and past weekly rankings, the season table, and per-team consensus —
  how often the group picked each team and how often that was correct.
- Pick reminders: an in-app banner for unpicked games plus optional web push.
- Admin: generate and revoke invite keys, force a data resync, override a game result if
  the upstream feed is ever wrong.

Explicitly excluded by the owner:

- No against-the-spread scoring, no confidence points, no weekly tiebreaker guess.
- No auto-filling of missed picks — a forgotten week simply scores zero.

Constraints:

- Must be free to run. No paid odds provider, no paid cron, no paid database tier.
- Vercel's free plan limits scheduled jobs to once per day, so live score freshness is
  driven by on-demand revalidation on page load rather than a cron.
- Correctness (locking, reveal, scoring) must never depend on a background job having run.
- No local database and no local-only code path. `DATABASE_URL` is required everywhere and
  the app refuses to start without it.

Terminology: *week* means an NFL week including playoff rounds; *pick* is one member's
chosen team for one game; *lock* is the moment a game stops accepting picks and starts
showing everyone's; *the grid* is the all-members-by-all-games view of a week.

## Brand Commitments

- Working name: NFL pick'em pool (project folder "Tippspiel Website"). No logo or existing
  brand assets exist.
- Interface language is German, addressing members informally (*du*). Two English words
  are pinned by the owner and must not be translated: **Picks** and **Standings**, including
  where they appear inside German sentences. NFL proper nouns stay English too — Wild Card,
  Divisional, Conference, Super Bowl, team names — because the group reads them that way.
  Dates, times and number formats render German (`de-DE`), always in the viewer's local
  timezone.
- Binding aesthetic constraint from the owner: **it must not look "vibecoded."** He chose a
  Swiss-utility direction — strict grid, tight sans typography, generous whitespace,
  near-monochrome with team colors carrying all the color.

## Evidence on Hand

- ESPN scoreboard API, verified live during planning: returns kickoff, home/away, neutral
  site, live score and clock, final winner, and DraftKings spread + over/under. The 2026
  Week 1 schedule and lines are already published; the opener is Wed Sep 9, 2026.
- ESPN teams endpoint: all 32 teams with primary and alternate colors and both light and
  dark logo variants. These logos are real assets and are downloaded at seed time.
- The completed 2025 season, including playoffs, is available from the same API and is the
  test corpus for scoring, weekly winners, and shared ties.
- There are no users, picks, testimonials, or historical pool results yet. The first season
  starts empty and nothing may fabricate past standings or member names.
