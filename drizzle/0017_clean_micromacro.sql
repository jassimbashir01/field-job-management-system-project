CREATE TYPE "public"."holiday_status" AS ENUM('sent', 'viewed', 'accepted', 'rejected');--> statement-breakpoint
CREATE TABLE "holiday_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"note" text,
	"status" "holiday_status" DEFAULT 'sent' NOT NULL,
	"manager_note" text,
	"viewed_at" timestamp with time zone,
	"viewed_by_user_id" uuid,
	"decided_at" timestamp with time zone,
	"decided_by_user_id" uuid,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "holiday_requests" ADD CONSTRAINT "holiday_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holiday_requests" ADD CONSTRAINT "holiday_requests_viewed_by_user_id_users_id_fk" FOREIGN KEY ("viewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holiday_requests" ADD CONSTRAINT "holiday_requests_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holiday_requests" ADD CONSTRAINT "holiday_requests_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "holiday_requests_user_id_index" ON "holiday_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "holiday_requests_status_index" ON "holiday_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "holiday_requests_start_date_end_date_index" ON "holiday_requests" USING btree ("start_date","end_date");