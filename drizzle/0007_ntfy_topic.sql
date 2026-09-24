DROP TABLE "push_subscriptions" CASCADE;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "ntfy_topic" text;