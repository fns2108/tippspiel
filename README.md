# Pick'em

A private NFL pick'em pool. Runs free on Vercel Hobby with a Neon Postgres database.

---

## Deploy on Vercel

### 1. Put the code on GitHub

```bash
git init
git add .
git commit -m "NFL pick'em pool"
gh repo create nfl-pickem --private --source=. --push
```

Without the `gh` CLI, create an empty private repo on github.com and follow the two commands
it shows you. `.env.local` is gitignored, so no secrets go up. The 64 team logos in
`public/teams/` **are** committed on purpose — they need to exist at build time.

### 2. Create the database

At [neon.tech](https://neon.tech), create a project. Region: Frankfurt (`eu-central-1`), so
it sits beside the app.

Copy the connection string and **take the pooled one** — its host contains `-pooler`:

```
postgresql://user:pass@ep-xyz-123-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require
```

The non-pooled string opens a fresh connection per request and will exhaust the free tier's
connection limit on a Sunday.

### 3. Create the schema and load the season

Run these from your laptop against the Neon URL.

```bash
export DATABASE_URL="postgresql://...-pooler...neon.tech/neondb?sslmode=require"

npm install
npm run db:migrate    # creates the tables
npm run seed:teams    # 32 teams + logos
npm run sync          # this season's schedule, scores and lines
npm run invite -- "the group" 10
```

Write down the invite key it prints.

### 4. Deploy

Import the repo at [vercel.com/new](https://vercel.com/new). Vercel detects Next.js — do not
change the build settings. Before clicking Deploy, add the environment variables:

| Variable | Value | Notes |
|---|---|---|
| `DATABASE_URL` | the pooled Neon string | required; the app will not start without it |
| `ADMIN_USERNAMES` | `Stolten` | the **complete** admin list, checked on every request |
| `CRON_SECRET` | `openssl rand -base64 32` | required, or the cron endpoint stays shut |

Leave `NFL_SEASON` unset — it derives from the date. Apply all four to Production, Preview
and Development.

`ADMIN_USERNAMES` is authoritative: anyone not named in it is a normal member whatever the
database says, and admin cannot be granted from inside the app. Leave it empty only on a
brand-new install, where the first account to register becomes admin so you can get in at
all — then set it and redeploy.

The app is pinned to the `fra1` region in [`vercel.json`](vercel.json) so the functions run
beside the database.

### 5. Register

Open `https://your-app.vercel.app/register?key=YOUR-KEY` and create your account with the
exact name you put in `ADMIN_USERNAMES`. Send everyone else a link from `/admin`, which has
a copy button next to each key.

### Reminders (optional)

```bash
npx web-push generate-vapid-keys
```

Add `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT`
(`mailto:you@example.com`) to Vercel and redeploy. Members turn reminders on from their own
profile page. Without these the app is fully functional — the picks page still shows an
open-games banner. On iPhone, notifications only work once the site is added to the Home
Screen; the app says so when it detects it.

### Updating

```bash
git push
```

Vercel rebuilds on every push to the default branch. Re-run `npm run db:migrate` only when a
change adds a migration.

---

## Commands

There is no local database. Every command talks to the Neon database in `DATABASE_URL`, so
**anything you run touches live data**.

```bash
export DATABASE_URL="postgresql://...-pooler...neon.tech/neondb?sslmode=require"
```

| Command | What it does |
|---|---|
| `npm run status` | Row counts, last sync, current week. Read-only. |
| `npm run check:espn` | Checks the upstream feed end to end. Read-only. |
| `npm test` | Unit tests: scoring, locking, colour contrast, passwords. No database. |
| `npm run sync` | Refreshes the current season's schedule, scores and lines. |
| `npm run sync -- 2025` | Same, for a specific season. |
| `npm run invite -- "label" 10` | Prints a new invite key with 10 uses. |
| `npm run db:migrate` | Applies pending migrations. |
| `npm run db:generate` | Generates a migration after changing `lib/db/schema.ts`. |
| `npm run backfill` | Replays the completed 2025 season and verifies scoring. |
| `npm run share:preview -- demo` | Draws the weekly share image to `/tmp` from a fixture. No database. |
| `npm run share:preview -- 2025 5` | Same, from real data for one week. |

`npm run backfill` needs `npm run sync -- 2025` first. It picks a whole real season for four
synthetic members and checks every weekly record against an independently computed count,
exercising shared ties, playoff rounds, drawn games and missed picks. Run it after touching
`lib/queries.ts`. It removes its synthetic members afterwards.

`npm run share:preview` renders the same PNG the `/share` page serves, so the layout can be
checked out of season without a played week behind it. It only reads.

Day-to-day there is nothing to run: scores refresh when someone loads a page, and locking,
reveal and scoring are computed from the clock on every read. `/admin` covers invite keys,
forcing a resync, and correcting a result by hand if the feed ever gets one wrong. `/share`
turns a week into an image for the group chat.
