CREATE TABLE "point_adjustments" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"season" integer NOT NULL,
	"ordinal" smallint NOT NULL,
	"points" integer NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "point_adjustments" ADD CONSTRAINT "point_adjustments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "point_adjustments_season_idx" ON "point_adjustments" USING btree ("season");