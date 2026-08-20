# Pick'em

A private NFL pick'em pool. Invite-only accounts, per-game locking at kickoff, weekly and
season winners, and an analytics page. Free to run.

- **Scoring** — one point per correct outright winner. The spread is shown as context and
  never affects scoring. A drawn game counts for nobody.
- **Locking** — each game locks at its own kickoff, so Sunday games stay editable all week.
- **Reveal** — you can only see other members' picks on a game once that game has kicked off.
- **Winners** — most correct in a week wins the week, ties shared. Most correct across the
  regular season and playoffs wins the season.

---

## Run it locally

```bash
npm install
npm run db:migrate     # creates a local Postgres in .pglite/
npm run seed:teams     # 32 teams + logos
npm run sync           # this season's schedule, scores and lines
npm run invite         # prints an invite key — you need one to register
npm run dev
```

Open http://localhost:3000, register with the key you just printed, and you are the admin
(the first account always is).

With no `DATABASE_URL` set, the app runs on [PGlite](https://pglite.dev) — real Postgres
compiled to WASM, stored in `.pglite/`. Nothing to install and nothing to sign up for.

> **One process at a time.** PGlite allows a single process to hold its data directory, so
> stop `npm run dev` before running `npm run sync` or any other script — you get a clear
> error rather than corruption if you forget. Next's dev server can also spin up more than
> one worker, so on rare occasions PGlite aborts anyway. Nothing in the local database is
> precious, so the fix is to rebuild it:
>
> ```bash
> npm run db:reset
> ```
>
> If you would rather not think about any of this, point `DATABASE_URL` at a Neon database
> for development too. The restriction disappears entirely and it is the same free tier
> production uses.

Optional demo data — six members with the password `password`, so the standings and grid
have something to render while you work:

```bash
npm run sync -- 2025   # a completed season
npm run seed:demo
```

---

## Deploy it

Free on Vercel's Hobby plan with a Neon Postgres database.

**1. Database.** Create a project at [neon.tech](https://neon.tech) and copy the **pooled**
connection string (its host contains `-pooler`).

**2. Push to GitHub**, then import the repo at [vercel.com/new](https://vercel.com/new).

**3. Environment variables** in the Vercel project:

| Variable | Value |
|---|---|
| `DATABASE_URL` | the pooled Neon string |
| `CRON_SECRET` | `openssl rand -base64 32` |
| `ADMIN_USERNAMES` | **your name** — see below |
| `DISPLAY_TZ` | `Europe/Berlin` (server-render fallback; the browser still shows local time) |
| `NFL_SEASON` | leave unset — it derives from the date |

**4. Migrate and seed** against production, once:

```bash
DATABASE_URL="<the pooled string>" npm run db:migrate
DATABASE_URL="<the pooled string>" npm run seed:teams
DATABASE_URL="<the pooled string>" npm run sync
DATABASE_URL="<the pooled string>" npm run invite -- "for the group" 10
```

That last command prints a key good for ten accounts and the link to send round.

`vercel.json` already registers the daily cron. Nothing else to configure.

### Reminders (optional)

```bash
npx web-push generate-vapid-keys
```

Add `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT`
(`mailto:you@example.com`) to Vercel and redeploy. Members turn reminders on from their own
profile page. Without these the app is fully functional — the picks page still shows an
open-games banner.

On iPhone, notifications only work if the site is added to the Home Screen first. The app
tells people this when it detects it.

---

## Running the season

Mostly it runs itself.

- **Scores** refresh when someone loads a page and the data has gone stale — every 20
  seconds while games are live. Vercel's free plan only allows one scheduled job per day, so
  whoever is watching is what keeps it current. That is exactly the right moment for it.
- **Locking, reveal and scoring never depend on a background job.** They are computed from
  the clock when a page is read, so nothing can leak a pick early or accept a late one.
- **Standings are computed, never stored**, so a corrected result can't leave a stale total.

**`/admin`** (admins only) covers the rest: generate and revoke invite keys, force a resync,
and correct a result by hand if the feed ever gets one wrong. A corrected game stops being
touched by the sync until you release it.

### Who is an admin

`ADMIN_USERNAMES` decides, and it is checked on every request rather than stored on the
account. When it is set it is the **complete** list — anyone not named in it is a normal
member, whatever the database says, and admin cannot be granted from inside the app. Set it
to your own name:

```
ADMIN_USERNAMES=Stolten
```

Leave it empty only on a brand-new install, where the first account to register becomes
admin so you can get in at all. Once you have registered, set the variable and redeploy.

Want tighter live scores? Point a free pinger like [cron-job.org](https://cron-job.org) at
`https://your-app.vercel.app/api/cron` with an `Authorization: Bearer <CRON_SECRET>` header.
Everything there is idempotent, so calling it often is safe and won't send duplicate
reminders.

---

## Where the data comes from

ESPN's public scoreboard API — schedule, home/away, live scores, final results, and
DraftKings spread and over/under. Free, no key, no account.

It is undocumented, so it could change without notice. Everything that touches it lives in
[`lib/espn/client.ts`](lib/espn/client.ts) behind a normalizer, pages always fall back to
the last data that was stored, and a failed sync never breaks a render.

```bash
npm run check:espn     # is the feed still shaped the way we expect?
```

If it ever breaks for good, that one file gets rewritten. The admin result-override screen
means a season can still be scored by hand in the meantime.

---

## Layout

```
app/(app)/         picks, grid, standings, profile, admin
app/(auth)/        login, register
app/actions/       server actions — every write goes through one of these
lib/espn/          the only code that knows ESPN's shape
lib/queries.ts     scoring and standings, computed from raw rows
lib/nfl/           season/week model, team colour resolution
components/        UI, including the authored icon set
scripts/           setup, sync, checks
```

## Tests

```bash
npm test           # unit tests: scoring model, colours, formatting, passwords
npm run check:espn # live check against the upstream feed
npm run backfill   # replays the completed 2025 season and verifies scoring
```

`npm run backfill` is the strong one: it picks a whole real season for four synthetic
members and checks every weekly record against an independently computed count, exercising
shared ties, playoff rounds, drawn games and missed picks. Run it after touching anything in
`lib/queries.ts`.
