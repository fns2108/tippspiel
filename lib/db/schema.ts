import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/* ---------------------------------------------------------------- people */

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    /** As typed at registration; this is what gets rendered. */
    username: text("username").notNull(),
    /** Lowercased copy, uniquely indexed. Avoids depending on the citext extension. */
    usernameLower: text("username_lower").notNull(),
    passwordHash: text("password_hash").notNull(),
    isAdmin: boolean("is_admin").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    usernameLowerIdx: uniqueIndex("users_username_lower_idx").on(t.usernameLower),
  }),
);

export const inviteKeys = pgTable("invite_keys", {
  code: text("code").primaryKey(),
  /** Free-text note so the owner remembers who a key was cut for. */
  label: text("label"),
  maxUses: integer("max_uses").notNull().default(1),
  usedCount: integer("used_count").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const inviteRedemptions = pgTable(
  "invite_redemptions",
  {
    code: text("code")
      .notNull()
      .references(() => inviteKeys.code, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    redeemedAt: timestamp("redeemed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.code, t.userId] }),
  }),
);

export const sessions = pgTable(
  "sessions",
  {
    /** SHA-256 of the cookie token. The raw token never touches the database. */
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("sessions_user_idx").on(t.userId),
  }),
);

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    endpoint: text("endpoint").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("push_subscriptions_user_idx").on(t.userId),
  }),
);

/* ------------------------------------------------------------- NFL data */

export const teams = pgTable("teams", {
  /** ESPN team id, e.g. "25". */
  id: text("id").primaryKey(),
  abbrev: text("abbrev").notNull(),
  location: text("location").notNull(),
  name: text("name").notNull(),
  displayName: text("display_name").notNull(),
  color: text("color"),
  altColor: text("alt_color"),
});

/**
 * One NFL game. `seasonType` follows ESPN: 2 = regular season, 3 = postseason.
 * Regular weeks are 1..18; postseason weeks are 1..5 and are presented as
 * Wild Card / Divisional / Conference / Pro Bowl / Super Bowl.
 */
export const games = pgTable(
  "games",
  {
    /** ESPN event id. */
    id: text("id").primaryKey(),
    season: integer("season").notNull(),
    seasonType: smallint("season_type").notNull(),
    week: smallint("week").notNull(),
    kickoff: timestamp("kickoff", { withTimezone: true }).notNull(),

    homeTeamId: text("home_team_id")
      .notNull()
      .references(() => teams.id),
    awayTeamId: text("away_team_id")
      .notNull()
      .references(() => teams.id),
    neutralSite: boolean("neutral_site").notNull().default(false),

    /** 'pre' | 'in' | 'post' */
    status: text("status").notNull().default("pre"),
    /** Human detail from ESPN, e.g. "Q4 1:42", "Final/OT". */
    statusDetail: text("status_detail"),
    homeScore: integer("home_score"),
    awayScore: integer("away_score"),

    /** Null until the game is final. Also null on a draw — see `isTie`. */
    winnerTeamId: text("winner_team_id").references(() => teams.id),
    isTie: boolean("is_tie").notNull().default(false),

    /**
     * Home-relative spread (negative = home favored), frozen at the last value
     * the feed published. ESPN drops odds once a game starts, so the sync only
     * ever writes these when the payload actually carries them.
     */
    spread: numeric("spread", { precision: 4, scale: 1 }),
    spreadDetail: text("spread_detail"),
    overUnder: numeric("over_under", { precision: 4, scale: 1 }),

    /** Set when an admin corrects a result by hand; the sync then leaves it alone. */
    manualOverride: boolean("manual_override").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    weekIdx: index("games_week_idx").on(t.season, t.seasonType, t.week),
    kickoffIdx: index("games_kickoff_idx").on(t.kickoff),
  }),
);

export const picks = pgTable(
  "picks",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    gameId: text("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.gameId] }),
    gameIdx: index("picks_game_idx").on(t.gameId),
  }),
);

/**
 * Login and registration throttling. Kept in Postgres rather than in memory
 * because serverless instances do not share state — an in-memory counter would
 * reset on every cold start, which is exactly when a guesser gets through.
 */
export const authAttempts = pgTable("auth_attempts", {
  /** e.g. "register:203.0.113.7" or "login:finn" */
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
});

/** Throttles ESPN fetches. One row per (season, seasonType, week) plus 'teams'. */
export const syncState = pgTable("sync_state", {
  key: text("key").primaryKey(),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }).notNull().defaultNow(),
  lastError: text("last_error"),
});

export type User = typeof users.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type Game = typeof games.$inferSelect;
export type Pick = typeof picks.$inferSelect;
export type InviteKey = typeof inviteKeys.$inferSelect;
