CREATE TABLE "pool_settings" (
	"season" integer PRIMARY KEY NOT NULL,
	"buy_in_cents" integer DEFAULT 0 NOT NULL,
	"season_prize_cents" integer DEFAULT 0 NOT NULL,
	"include_playoffs" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
